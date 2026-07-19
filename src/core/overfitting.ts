// Detector de sobreajuste (RF-12.3). Compara dos instrumentos distintos:
// dificultad normalizada del catálogo del Radar y Elo real de partidas
// rápidas/clásicas. Si falta cualquiera, no infiere: devuelve insuficiente.
import type { GameRecord, RadarAttempt } from './types';

export const OVERFITTING_WINDOW_DAYS = 56;
export const OVERFITTING_INTERNAL_GAIN_THRESHOLD = 5;
const EDGE_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OverfittingEvidence {
  radarBaselineSamples: number;
  radarRecentSamples: number;
  gameBaselineSamples: number;
  gameRecentSamples: number;
}

export type OverfittingResult =
  | { status: 'insufficient'; evidence: OverfittingEvidence }
  | {
      status: 'aligned' | 'overfitting';
      /** Cambio en percentiles de dificultad del catálogo, no Elo. */
      internalDelta: number;
      /** Cambio de Elo real entre los extremos de la ventana. */
      gameRatingDelta: number;
      evidence: OverfittingEvidence;
    };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function inRange(iso: string, start: number, end: number): boolean {
  const timestamp = new Date(iso).getTime();
  return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
}

/**
 * Usa las primeras y últimas dos semanas de una ventana de ocho semanas. Se
 * requieren al menos 3 posiciones de catálogo y 1 partida rated en cada
 * extremo. El umbral de +5 percentiles evita alertar por ruido mínimo.
 */
export function detectOverfitting(
  attempts: RadarAttempt[],
  games: GameRecord[],
  now: Date = new Date(),
): OverfittingResult {
  const end = now.getTime();
  const start = end - OVERFITTING_WINDOW_DAYS * DAY_MS;
  const baselineEnd = start + EDGE_WINDOW_DAYS * DAY_MS;
  const recentStart = end - EDGE_WINDOW_DAYS * DAY_MS;

  const catalogAttempts = attempts.filter(
    (attempt) =>
      attempt.origenContenido !== 'error-propio' &&
      attempt.dificultadNormalizada !== undefined,
  );
  const radarBaseline = catalogAttempts
    .filter((attempt) => inRange(attempt.fecha, start, baselineEnd))
    .map((attempt) => attempt.dificultadNormalizada as number);
  const radarRecent = catalogAttempts
    .filter((attempt) => inRange(attempt.fecha, recentStart, end))
    .map((attempt) => attempt.dificultadNormalizada as number);

  // Bullet y partidas sin reloj no representan el rating de partidas lentas
  // que el Panel usa como métrica primaria. Sin rating real, se excluyen.
  const ratedGames = games.filter(
    (game) =>
      (game.ritmo === 'rapida' || game.ritmo === 'clasica') &&
      game.ratingUsuario !== undefined,
  );
  const gameBaseline = ratedGames
    .filter((game) => inRange(game.fecha, start, baselineEnd))
    .map((game) => game.ratingUsuario as number);
  const gameRecent = ratedGames
    .filter((game) => inRange(game.fecha, recentStart, end))
    .map((game) => game.ratingUsuario as number);

  const evidence: OverfittingEvidence = {
    radarBaselineSamples: radarBaseline.length,
    radarRecentSamples: radarRecent.length,
    gameBaselineSamples: gameBaseline.length,
    gameRecentSamples: gameRecent.length,
  };
  if (radarBaseline.length < 3 || radarRecent.length < 3 || gameBaseline.length < 1 || gameRecent.length < 1) {
    return { status: 'insufficient', evidence };
  }

  const internalDelta = median(radarRecent) - median(radarBaseline);
  const gameRatingDelta = median(gameRecent) - median(gameBaseline);
  const status = internalDelta >= OVERFITTING_INTERNAL_GAIN_THRESHOLD && gameRatingDelta <= 0
    ? 'overfitting'
    : 'aligned';
  return { status, internalDelta, gameRatingDelta, evidence };
}
