// Criterio de cálculo (E9, RF-9.2): el ejercicio "¿esta posición pide cálculo
// profundo o alcanza con una jugada sólida?", que recicla el contenido ya
// verificado del Radar (E5) —los tipos ofensiva/defensa/envenenada exigen
// vigilancia táctica; tranquila/genuina premian no forzar nada—. Entrena la
// calibración del esfuerzo: reconocer cuándo una posición merece que te
// detengas a calcular. NO tiene nada que ver con un reloj (la app juega sin
// reloj): antes esto se disparaba y medía con un cronómetro invisible, lo que
// era incoherente; ahora el disparador es la fuga táctica de partidas reales
// (core/prescriptor.ts) y el Panel solo resume la precisión del ejercicio.
import type { TipoRadar, TriageAttempt } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

// --- RF-9.3: resumen del criterio en el Panel (E11/E12) ---

export interface ResumenCriterio {
  /** Ejercicios "¿pide cálculo o alcanza?" resueltos en la ventana. */
  total: number;
  correctos: number;
  /** Proporción de aciertos, 0–1. */
  precision: number;
  ventanaDias: number;
}

/**
 * Precisión del ejercicio de criterio en la ventana reciente (por defecto 30
 * días), para el Panel. Es una lectura del último mes, no acumulada de siempre.
 * Null si no hubo ningún ejercicio en la ventana —no inventa nada—.
 */
export function resumenCriterio(attempts: TriageAttempt[], now: Date = new Date(), ventanaDias = 30): ResumenCriterio | null {
  const desde = now.getTime() - ventanaDias * DAY_MS;
  const hasta = now.getTime();
  const recientes = attempts.filter((a) => {
    const t = new Date(a.fecha).getTime();
    return Number.isFinite(t) && t >= desde && t <= hasta;
  });
  if (recientes.length === 0) return null;
  const correctos = recientes.filter((a) => a.correcta).length;
  return { total: recientes.length, correctos, precision: correctos / recientes.length, ventanaDias };
}

// --- RF-9.2: decisión sobre contenido del Radar ---

const NECESITA_CALCULO: Record<TipoRadar, boolean> = {
  ofensiva: true,
  defensa: true,
  envenenada: true,
  tranquila: false,
  genuina: false,
};

export type DecisionTriage = 'calcular' | 'alcanza';

/** ¿La posición de este tipo del Radar exige cálculo profundo, o alcanza con una jugada sólida? (RF-9.2). */
export function decisionCorrecta(tipo: TipoRadar): DecisionTriage {
  return NECESITA_CALCULO[tipo] ? 'calcular' : 'alcanza';
}
