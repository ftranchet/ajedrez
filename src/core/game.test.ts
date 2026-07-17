import { describe, expect, it } from 'vitest';
import { buildGameRecord, deriveResult } from './game';

describe('deriveResult', () => {
  it('mate al blanco (mueven blancas y están en mate) → 0-1', () => {
    expect(deriveResult({ isCheckmate: true, isStalemate: false, isDraw: false, turn: 'w' })).toBe('0-1');
  });

  it('mate al negro → 1-0', () => {
    expect(deriveResult({ isCheckmate: true, isStalemate: false, isDraw: false, turn: 'b' })).toBe('1-0');
  });

  it('ahogado → tablas', () => {
    expect(deriveResult({ isCheckmate: false, isStalemate: true, isDraw: true, turn: 'w' })).toBe('1/2-1/2');
  });

  it('tablas por regla (50 jugadas, repetición, material) → tablas', () => {
    expect(deriveResult({ isCheckmate: false, isStalemate: false, isDraw: true, turn: 'b' })).toBe('1/2-1/2');
  });

  it('abandono del blanco → 0-1, incluso si nadie está en mate', () => {
    expect(deriveResult({ isCheckmate: false, isStalemate: false, isDraw: false, turn: 'w', resignedBy: 'w' })).toBe('0-1');
  });

  it('abandono del negro → 1-0', () => {
    expect(deriveResult({ isCheckmate: false, isStalemate: false, isDraw: false, turn: 'b', resignedBy: 'b' })).toBe('1-0');
  });

  it('partida sin terminar → *', () => {
    expect(deriveResult({ isCheckmate: false, isStalemate: false, isDraw: false, turn: 'w' })).toBe('*');
  });
});

describe('buildGameRecord', () => {
  it('arma el registro con analizada=false y fecha ISO', () => {
    const g = buildGameRecord({
      pgn: '1. e4 e5 *',
      resultado: '*',
      tiemposPorJugadaMs: [1200, 800],
      fuente: 'local',
      ritmo: 'sin-reloj',
    });
    expect(g.analizada).toBe(false);
    expect(g.id).toBeTruthy();
    expect(new Date(g.fecha).toString()).not.toBe('Invalid Date');
    expect(g.tiemposPorJugadaMs).toEqual([1200, 800]);
  });
});
