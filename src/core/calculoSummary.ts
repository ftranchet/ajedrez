// Resumen de Cálculo (E7) para el Panel: hacer estos ejercicios debe dejar un
// rastro medible. Desde ADR-0015 hay un solo ejercicio con dos presets y un
// solo formato de intento (`CalculoAttempt`), y cada preset se resume con su
// propia vara: el forzado con la precisión de la línea declarada, el abierto
// con cobertura, profundidad vista y brecha de evaluación. Las varas **no se
// promedian entre sí** — un número que mezcle una posición con respuesta
// verificable y otra sin ella sube o baja según el contenido servido, no según
// el cálculo del usuario. Puras y testeables.
import type { CalculoAttempt } from './types';

const dePreset = (attempts: CalculoAttempt[], preset: CalculoAttempt['preset']) =>
  attempts.filter((attempt) => attempt.preset === preset);

const tiempoValido = (tiempoMs: number | undefined) =>
  typeof tiempoMs === 'number' && Number.isFinite(tiempoMs) && tiempoMs >= 0 ? tiempoMs : null;

export interface ForzadoResumen {
  total: number;
  correctas: number;
  /** Proporción de líneas declaradas correctas, 0–1. */
  precision: number;
}

/** Preset forzado (RF-7.1): la línea declarada contra la verificada. */
export function resumenForzado(attempts: CalculoAttempt[]): ForzadoResumen | null {
  const propios = dePreset(attempts, 'forzado');
  if (propios.length === 0) return null;
  const correctas = propios.filter((attempt) => attempt.correcta).length;
  return { total: propios.length, correctas, precision: correctas / propios.length };
}

export interface AbiertoResumen {
  /** Fecha de la última toma, ISO 8601. */
  fecha: string;
  total: number;
  /** Última toma: la mejor jugada del motor estaba entre las candidatas. */
  cobertura: boolean;
  /** Última toma: plies de la variante principal declarados seguidos; null si no se midió. */
  profundidadVista: number | null;
  /** Última toma: distancia entre la evaluación declarada y la del motor; null si no se pudo medir. */
  brechaEvaluacion: number | null;
  /**
   * Cuánto duró la última toma (RF-7.3). El preset abierto entrena
   * profundidad, así que el tiempo dedicado es su métrica de proceso, no una
   * carrera. `null` en tomas anteriores a que se registrara.
   */
  tiempoMsUltima: number | null;
  /**
   * Media de la brecha de evaluación de las tomas que la tienen medida, que es
   * la señal de si el juicio se está calibrando. `null` mientras no haya
   * ninguna: los intentos convertidos del formato viejo no la traen, porque no
   * se guardaba la evaluación del motor (ADR-0015, punto 6).
   */
  brechaMedia: number | null;
}

/** Preset abierto (RF-7.2): tres números que se leen por separado. */
export function resumenAbierto(attempts: CalculoAttempt[]): AbiertoResumen | null {
  const propios = dePreset(attempts, 'abierto');
  if (propios.length === 0) return null;
  const ultimo = [...propios].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const brechas = propios
    .map((attempt) => attempt.brechaEvaluacion)
    .filter((brecha): brecha is number => typeof brecha === 'number');
  return {
    fecha: ultimo.fecha,
    total: propios.length,
    cobertura: ultimo.cobertura ?? false,
    profundidadVista: typeof ultimo.profundidadVista === 'number' ? ultimo.profundidadVista : null,
    brechaEvaluacion: typeof ultimo.brechaEvaluacion === 'number' ? ultimo.brechaEvaluacion : null,
    tiempoMsUltima: tiempoValido(ultimo.tiempoMs),
    brechaMedia: brechas.length > 0 ? brechas.reduce((suma, brecha) => suma + brecha, 0) / brechas.length : null,
  };
}
