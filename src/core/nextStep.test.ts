import { describe, expect, it } from 'vitest';
import { recomendarProximoPaso } from './nextStep';
import type { GameRecord } from './types';

function game(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: crypto.randomUUID(),
    pgn: '1. e4 e5 2. Nf3 Nc6 *',
    fuente: 'local',
    ritmo: 'clasica',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: true,
    fecha: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('recomendarProximoPaso (RF-11.7)', () => {
  const ahora = new Date('2026-07-22T12:00:00.000Z');

  it('sin partidas, recomienda jugar la primera', () => {
    expect(recomendarProximoPaso([], ahora).kind).toBe('jugar-primera');
  });

  it('con una partida sin analizar, recomienda analizarla', () => {
    const games = [game({ analizada: true, fecha: '2026-07-22T00:00:00.000Z' }), game({ analizada: false, fecha: '2026-07-21T00:00:00.000Z' })];
    expect(recomendarProximoPaso(games, ahora).kind).toBe('analizar');
  });

  it('ignora partidas vacías (sin jugadas) para "analizar"', () => {
    const games = [game({ analizada: false, pgn: '*', fecha: '2026-07-22T00:00:00.000Z' })];
    expect(recomendarProximoPaso(games, ahora).kind).toBe('al-dia');
  });

  it('si analizó todo pero hace varios días que no juega, recomienda jugar con los días', () => {
    const games = [game({ analizada: true, fecha: '2026-07-18T00:00:00.000Z' })]; // 4 días
    const rec = recomendarProximoPaso(games, ahora);
    expect(rec.kind).toBe('jugar');
    expect(rec.dias).toBe(4);
  });

  it('si jugó y analizó al día, queda "al día"', () => {
    const games = [game({ analizada: true, fecha: '2026-07-22T00:00:00.000Z' })];
    expect(recomendarProximoPaso(games, ahora).kind).toBe('al-dia');
  });
});
