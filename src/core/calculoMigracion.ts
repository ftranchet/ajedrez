// Conversión de los intentos de cálculo al formato unificado (ADR-0015, punto
// 6). Vive en `core` y no dentro de la migración de Dexie porque es una regla
// de dominio —qué significa un intento viejo en el modelo nuevo— y porque así
// se puede testear sin base de datos.
//
// La conversión no descarta ningún campo: un intento de línea comprometida es
// una rama de N plies con su primer ply divergente; uno de Stoyko, N ramas de
// un ply con su evaluación, su confianza y su tiempo.
import type { CalculoAttempt, CompromisoAttempt, StoykoAttempt } from './types';

export function compromisoAAttempt(viejo: CompromisoAttempt, solucion?: string[]): CalculoAttempt {
  return {
    id: viejo.id,
    preset: 'forzado',
    itemId: viejo.itemId,
    // La línea declarada no se guardaba: solo el ply donde se desvió. Se
    // reconstruye lo que se puede afirmar —los plies correctos, cuando el
    // catálogo todavía tiene el ítem— y nada más. Inventar los plies
    // equivocados sería fabricar datos del usuario.
    ramas: [{ linea: (solucion ?? []).slice(0, viejo.primerErrorEn ?? viejo.profundidad) }],
    correcta: viejo.correcta,
    primerErrorEn: viejo.primerErrorEn,
    ...(viejo.tiempoMs !== undefined ? { tiempoMs: viejo.tiempoMs } : {}),
    fecha: viejo.fecha,
  };
}

export function stoykoAAttempt(viejo: StoykoAttempt): CalculoAttempt {
  return {
    id: viejo.id,
    preset: 'abierto',
    itemId: viejo.itemId,
    ramas: viejo.candidatas.map((candidata) => ({
      linea: [candidata.jugada],
      evaluacion: candidata.evaluacion,
    })),
    // `acierto` del formato viejo era exactamente la cobertura: si la mejor
    // jugada del motor estaba entre las candidatas.
    cobertura: viejo.acierto,
    // La profundidad no se puede recuperar: las candidatas eran de un ply. Un
    // acierto vale 1 ply visto; no haberla tenido, 0.
    profundidadVista: viejo.acierto ? 1 : 0,
    // La brecha tampoco: no se guardaba la evaluación del motor de esa
    // posición, así que queda declarada como desconocida en vez de calculada
    // con un dato que no existe.
    brechaEvaluacion: null,
    confianzaDeclarada: viejo.confianzaDeclarada,
    ...(viejo.tiempoMs !== undefined ? { tiempoMs: viejo.tiempoMs } : {}),
    fecha: viejo.fecha,
  };
}

/** Ordenados por fecha, como los lee el Panel. */
export function unificarIntentosDeCalculo(
  compromiso: CompromisoAttempt[],
  stoyko: StoykoAttempt[],
  solucionPorItem: Map<string, string[]> = new Map(),
): CalculoAttempt[] {
  return [
    ...compromiso.map((viejo) => compromisoAAttempt(viejo, solucionPorItem.get(viejo.itemId))),
    ...stoyko.map(stoykoAAttempt),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
