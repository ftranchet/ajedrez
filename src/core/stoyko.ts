// Ejercicio de Stoyko semanal (E7, RF-7.2): ante una posición rica y sin
// reloj, el usuario anota todas las jugadas candidatas que consideraría,
// cada una con su evaluación, antes de comparar con el motor. A diferencia
// del Radar o de Cálculo comprometido (RF-7.1), acá no hay una única
// "solución": el acierto es haber tenido la mejor jugada del motor entre las
// candidatas, no haberla elegido como la primera o la única.
import type { EvalSymbol, Profile, StoykoItem } from './types';

/** Enfriamiento semanal: 7 días desde la última vez que se completó (RF-7.2). */
const ENFRIAMIENTO_DIAS = 7;

export interface Candidata {
  jugada: string; // UCI
  evaluacion: EvalSymbol;
}

/** true si nunca se hizo o ya pasó el enfriamiento de 7 días (RF-7.2). */
export function stoykoDisponible(profile: Pick<Profile, 'stoykoUltimaCompletadaEn'>, ahora: Date = new Date()): boolean {
  const ultima = profile.stoykoUltimaCompletadaEn;
  if (!ultima) return true;
  const proxima = new Date(ultima).getTime() + ENFRIAMIENTO_DIAS * 24 * 60 * 60 * 1000;
  return ahora.getTime() >= proxima;
}

/** Fecha ISO en que vuelve a estar disponible; null si ya lo está. */
export function stoykoProximaDisponibleEn(profile: Pick<Profile, 'stoykoUltimaCompletadaEn'>): string | null {
  const ultima = profile.stoykoUltimaCompletadaEn;
  if (!ultima || stoykoDisponible(profile)) return null;
  return new Date(new Date(ultima).getTime() + ENFRIAMIENTO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Acierto de Stoyko: alguna de las candidatas que el usuario escribió
 * coincide con la primera jugada de la variante principal del motor. No
 * importa el orden en que las anotó ni cuántas otras candidatas haya escrito.
 */
export function stoykoAcierto(item: StoykoItem, candidatas: Candidata[]): boolean {
  return candidatas.some((c) => c.jugada === item.mejorLinea[0]);
}
