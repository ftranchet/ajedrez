// Currículo base (E6): patrones tácticos y finales elementales con estado
// espaciado propio (RF-6.3), reutilizando el mismo planificador FSRS que la
// Cola Universal (ADR-0003) detrás del puerto de `core/scheduler.ts`. A
// diferencia de una tarjeta de error (que nace de un fallo), un elemento del
// currículo se sirve proactivamente hasta demostrar la técnica tres veces
// seguidas y espaciadas ("automatización"), después de lo cual deja de
// aparecer en la sesión.
import { Chess } from 'chess.js';
import type { CurriculumItem, CurriculumProgress, PatternKey } from './types';
import { isDue, newFsrsState, reviewFsrsState } from './scheduler';

const DEMOSTRACIONES_PARA_AUTOMATIZAR = 3;

/** Progreso inicial de un elemento nunca visto: nuevo, disponible de inmediato. */
export function newCurriculumProgress(itemId: string, now: Date = new Date()): CurriculumProgress {
  return { id: itemId, fsrs: newFsrsState(now), demostracionesLimpias: 0, updatedAt: now.toISOString() };
}

export function isAutomatizado(progress: CurriculumProgress): boolean {
  return progress.demostracionesLimpias >= DEMOSTRACIONES_PARA_AUTOMATIZAR;
}

/**
 * Aplica el resultado de una demostración (RF-6.3): una demostración limpia
 * suma al contador y espacia la reaparición (como un acierto FSRS); un fallo
 * reinicia el contador a cero y la reaparición se adelanta (como un fallo
 * FSRS) — automatizar exige rachas limpias, no un promedio.
 */
export function reviewCurriculumProgress(progress: CurriculumProgress, limpia: boolean, now: Date = new Date()): CurriculumProgress {
  return {
    ...progress,
    fsrs: reviewFsrsState(progress.fsrs, limpia, now),
    demostracionesLimpias: limpia ? progress.demostracionesLimpias + 1 : 0,
    updatedAt: now.toISOString(),
  };
}

/**
 * Elementos que corresponde servir hoy: nunca vistos, o vencidos y todavía
 * no automatizados. Un elemento automatizado no vuelve a aparecer aunque su
 * FSRS marque vencido (RF-6.3: automatizar es un techo, no un ciclo eterno).
 */
export function dueCurriculumItems(
  items: CurriculumItem[],
  progressById: Map<string, CurriculumProgress>,
  now: Date = new Date(),
): CurriculumItem[] {
  return items.filter((item) => {
    const progress = progressById.get(item.id);
    if (!progress) return true;
    if (isAutomatizado(progress)) return false;
    return isDue(progress.fsrs, now);
  });
}

const UMBRAL_CIEGAS = 0.8;
// No activar el modificador con una racha corta y casual: unas pocas
// repeticiones alcanzan para que el 80% de acierto signifique algo.
const REPS_MINIMAS_CIEGAS = 3;

export type NivelCiegas = 'normal' | 'fantasma' | 'coordenadas';

/**
 * Modificador a ciegas progresivo (RF-6.5): sobre un patrón con más de 80%
 * de acierto histórico (y unas pocas repeticiones, para no activarlo con una
 * sola casualidad), sube la dificultad deseable (Bjork) ocultando primero
 * las piezas ("fantasma") y, si el usuario sigue acertando limpio camino a
 * la automatización (RF-6.3), también las coordenadas de las piezas.
 */
export function nivelCiegas(progress: CurriculumProgress | undefined): NivelCiegas {
  if (!progress || progress.fsrs.reps < REPS_MINIMAS_CIEGAS) return 'normal';
  const tasaAcierto = (progress.fsrs.reps - progress.fsrs.lapses) / progress.fsrs.reps;
  if (tasaAcierto <= UMBRAL_CIEGAS) return 'normal';
  return progress.demostracionesLimpias >= 2 ? 'coordenadas' : 'fantasma';
}

function uciAObjeto(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined };
}

/**
 * ¿La jugada del usuario demuestra el patrón? (RF-6.1). Se juzga por el
 * resultado, no por la casilla exacta registrada: un patrón cuya solución
 * canónica es mate se demuestra con cualquier mate legal —hay posiciones con
 * varios mates en 1 (p. ej. "Mate de dama y rey" admite Dg7#, Dg8#, Dh1# y
 * Dh2#)— y rechazar un mate válido sería un falso error que además cortaría la
 * racha hacia la automatización. Para el resto de los patrones (motivos
 * tácticos) se exige coincidir con alguna jugada registrada en la solución.
 */
export function esDemostracionLimpia(fen: string, jugadaUci: string, solucion: string[]): boolean {
  if (solucion.includes(jugadaUci)) return true;
  const canonica = solucion[0];
  if (!canonica) return false;
  try {
    const referencia = new Chess(fen);
    referencia.move(uciAObjeto(canonica));
    if (!referencia.isCheckmate()) return false;
    const delUsuario = new Chess(fen);
    delUsuario.move(uciAObjeto(jugadaUci));
    return delUsuario.isCheckmate();
  } catch {
    return false;
  }
}

/**
 * Reordena una lista de elementos vencidos para que ningún patrón se sirva
 * en bloque (RF-6.1: "el sistema nunca sirve bloques monotemáticos"),
 * repartiendo en round-robin entre los patrones presentes.
 */
export function interleaveByPattern(items: CurriculumItem[]): CurriculumItem[] {
  const porPatron = new Map<PatternKey, CurriculumItem[]>();
  for (const item of items) {
    const lista = porPatron.get(item.patternKey) ?? [];
    lista.push(item);
    porPatron.set(item.patternKey, lista);
  }
  const baldes = [...porPatron.values()];
  const resultado: CurriculumItem[] = [];
  let indice = 0;
  while (resultado.length < items.length) {
    const balde = baldes[indice % baldes.length];
    const siguiente = balde.shift();
    if (siguiente) resultado.push(siguiente);
    indice++;
  }
  return resultado;
}
