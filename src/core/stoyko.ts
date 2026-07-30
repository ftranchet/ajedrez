// Cadencia del preset abierto del cálculo declarado (E7, RF-7.2): una vez por
// semana. El criterio de aprobación del ejercicio vive en `core/calculo.ts`
// desde ADR-0015 —acá quedó lo que es propio de la cadencia—, porque el
// enfriamiento semanal es lo único que distingue a este preset del corto en
// términos de planificación.
import type { EvalSymbol, Profile } from './types';

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
export function stoykoProximaDisponibleEn(
  profile: Pick<Profile, 'stoykoUltimaCompletadaEn'>,
  now: Date = new Date(),
): string | null {
  const ultima = profile.stoykoUltimaCompletadaEn;
  if (!ultima || stoykoDisponible(profile, now)) return null;
  return new Date(new Date(ultima).getTime() + ENFRIAMIENTO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

