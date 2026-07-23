// Resumen de Cálculo (E7) para el Panel: hacer estos ejercicios debe dejar un
// rastro medible. Línea comprometida (RF-7.1) mide la disciplina de calcular la
// línea entera; Stoyko (RF-7.2) mide si tuviste la mejor jugada entre tus
// candidatas. Puras y testeables.
import type { CompromisoAttempt, StoykoAttempt } from './types';

export interface CompromisoResumen {
  total: number;
  correctas: number;
  /** Proporción de líneas declaradas correctas, 0–1. */
  precision: number;
}

export function resumenCompromiso(attempts: CompromisoAttempt[]): CompromisoResumen | null {
  if (attempts.length === 0) return null;
  const correctas = attempts.filter((a) => a.correcta).length;
  return { total: attempts.length, correctas, precision: correctas / attempts.length };
}

export interface StoykoResumen {
  /** Fecha de la última toma, ISO 8601. */
  fecha: string;
  acierto: boolean;
  total: number;
}

export function resumenStoyko(attempts: StoykoAttempt[]): StoykoResumen | null {
  if (attempts.length === 0) return null;
  const ultimo = [...attempts].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return { fecha: ultimo.fecha, acierto: ultimo.acierto, total: attempts.length };
}
