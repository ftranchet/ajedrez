import { describe, expect, it } from 'vitest';
import { partidaLentaSemanal } from './slowGame';
import type { GameRecord } from './types';

function game(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: crypto.randomUUID(),
    pgn: '1. e4 e5 *',
    fuente: 'local',
    ritmo: 'clasica',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: false,
    fecha: '2026-07-22T10:00:00.000Z', // miércoles de la semana del 20–26
    ...overrides,
  };
}

describe('partidaLentaSemanal (RF-11.7)', () => {
  const ahora = new Date(2026, 6, 22, 20); // miércoles 22/07 (semana lun 20 – dom 26), local

  it('sin partidas lentas esta semana', () => {
    expect(partidaLentaSemanal([], ahora)).toBe('sin-jugar');
    // Una partida de la semana pasada no cuenta.
    expect(partidaLentaSemanal([game({ fecha: new Date(2026, 6, 15, 10).toISOString() })], ahora)).toBe('sin-jugar');
    // Blitz/bullet no cuentan como lenta.
    expect(partidaLentaSemanal([game({ ritmo: 'blitz', fecha: new Date(2026, 6, 21, 10).toISOString() })], ahora)).toBe('sin-jugar');
  });

  it('jugada esta semana pero sin analizar', () => {
    const g = game({ analizada: false, fecha: new Date(2026, 6, 21, 10).toISOString() });
    expect(partidaLentaSemanal([g], ahora)).toBe('sin-analizar');
  });

  it('jugada y analizada esta semana = completa', () => {
    const g = game({ analizada: true, fecha: new Date(2026, 6, 21, 10).toISOString() });
    expect(partidaLentaSemanal([g], ahora)).toBe('completa');
  });
});
