import { describe, expect, it } from 'vitest';
import type { GameRecord, RadarAttempt } from './types';
import { detectOverfitting } from './overfitting';

const NOW = new Date('2026-03-01T12:00:00.000Z');

function attempt(id: string, daysAgo: number, difficulty: number, ownError = false): RadarAttempt {
  return {
    id,
    itemId: id,
    tipo: 'ofensiva',
    rating: 1500,
    dificultadNormalizada: ownError ? undefined : difficulty,
    origenContenido: ownError ? 'error-propio' : 'catalogo',
    errorCardId: ownError ? `card-${id}` : undefined,
    acierto: true,
    fecha: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  };
}

function game(id: string, daysAgo: number, rating: number, ritmo: GameRecord['ritmo'] = 'rapida'): GameRecord {
  return {
    id,
    pgn: '1. e4 e5 *',
    fuente: 'manual',
    ritmo,
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: false,
    fecha: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    jugadorColor: 'w',
    ratingUsuario: rating,
  };
}

describe('detectOverfitting (RF-12.3)', () => {
  it('detecta cuando el nivel interno sube y el Elo de partidas no acompaña', () => {
    const attempts = [
      attempt('b1', 55, 40), attempt('b2', 52, 42), attempt('b3', 49, 41),
      attempt('r1', 10, 55), attempt('r2', 7, 57), attempt('r3', 2, 56),
    ];
    const games = [game('g1', 52, 1500), game('g2', 4, 1492)];
    expect(detectOverfitting(attempts, games, NOW)).toMatchObject({
      status: 'overfitting',
      internalDelta: 15,
      gameRatingDelta: -8,
    });
  });

  it('no alerta si el Elo real acompaña la mejora interna', () => {
    const attempts = [
      attempt('b1', 55, 40), attempt('b2', 52, 42), attempt('b3', 49, 41),
      attempt('r1', 10, 55), attempt('r2', 7, 57), attempt('r3', 2, 56),
    ];
    const games = [game('g1', 52, 1500), game('g2', 4, 1525)];
    expect(detectOverfitting(attempts, games, NOW)).toMatchObject({ status: 'aligned', gameRatingDelta: 25 });
  });

  it('no alerta por una variación interna menor al umbral', () => {
    const attempts = [
      attempt('b1', 55, 50), attempt('b2', 52, 50), attempt('b3', 49, 50),
      attempt('r1', 10, 53), attempt('r2', 7, 53), attempt('r3', 2, 53),
    ];
    expect(detectOverfitting(attempts, [game('g1', 52, 1500), game('g2', 4, 1490)], NOW).status).toBe('aligned');
  });

  it('exige evidencia en ambos extremos y no usa errores propios ni bullet', () => {
    const attempts = [
      attempt('b1', 55, 40), attempt('b2', 52, 40), attempt('b3', 49, 40),
      attempt('r1', 10, 60, true), attempt('r2', 7, 60, true), attempt('r3', 2, 60, true),
    ];
    const result = detectOverfitting(attempts, [game('g1', 52, 1500), game('g2', 4, 1400, 'bullet')], NOW);
    expect(result).toEqual({
      status: 'insufficient',
      evidence: { radarBaselineSamples: 3, radarRecentSamples: 0, gameBaselineSamples: 1, gameRecentSamples: 0 },
    });
  });
});
