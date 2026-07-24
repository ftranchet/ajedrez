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

  // Borde clásico de `(getDay() + 6) % 7`: el domingo es el ÚLTIMO día de la
  // semana (lunes a domingo), no el primero. Si se calculara mal, el domingo
  // "reiniciaría" la semana y una partida del lunes anterior dejaría de contar.
  it('el domingo sigue perteneciendo a la semana que arrancó el lunes', () => {
    const domingo = new Date(2026, 6, 26, 22); // domingo 26/07, cierre de esa semana
    const delLunes = game({ analizada: true, fecha: new Date(2026, 6, 20, 9).toISOString() });
    expect(partidaLentaSemanal([delLunes], domingo)).toBe('completa');

    // Y el lunes siguiente ya es una semana nueva: esa misma partida no cuenta.
    const lunesSiguiente = new Date(2026, 6, 27, 9);
    expect(partidaLentaSemanal([delLunes], lunesSiguiente)).toBe('sin-jugar');
  });

  it('una partida del mismo lunes a la madrugada entra en la semana en curso', () => {
    const lunes = new Date(2026, 6, 20, 23, 30);
    const madrugada = game({ fecha: new Date(2026, 6, 20, 0, 5).toISOString() });
    expect(partidaLentaSemanal([madrugada], lunes)).toBe('sin-analizar');
  });
});
