// Currículo base (E6): patrones tácticos y finales elementales con estado
// espaciado propio (RF-6.3), reutilizando el mismo planificador FSRS que la
// Cola Universal (ADR-0003) detrás del puerto de `core/scheduler.ts`. A
// diferencia de una tarjeta de error (que nace de un fallo), un elemento del
// currículo se sirve proactivamente hasta demostrar la técnica tres veces
// seguidas y espaciadas ("automatización"), después de lo cual deja de
// aparecer en la sesión.
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
