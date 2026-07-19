import { describe, expect, it } from 'vitest';
import type { CurriculumItem } from './types';
import { FINAL_DRAW_HOLD_MOVES, evaluateFinalTechnique } from './finales';

const win: CurriculumItem = {
  id: 'win', tipo: 'final', patternKey: 'final-rey-peon', nombre: 'Gana', fen: '', solucion: [],
  resultadoEsperado: 'gana', ladoUsuario: 'w',
};
const draw: CurriculumItem = {
  id: 'draw', tipo: 'final', patternKey: 'final-philidor', nombre: 'Tablas', fen: '', solucion: [],
  resultadoEsperado: 'tablas', ladoUsuario: 'b',
};
const state = { gameOver: false, draw: false, winner: null, promoted: false, userMoves: 1 } as const;

describe('evaluateFinalTechnique', () => {
  it('mantiene un final ganado si Stockfish sigue claramente peor', () => {
    expect(evaluateFinalTechnique(win, state, { move: 'e7d7', cp: -600, mateIn: null })).toBe('continuar');
  });

  it('marca pérdida de la técnica cuando una ganada cae a igualdad', () => {
    expect(evaluateFinalTechnique(win, state, { move: 'e7d7', cp: 0, mateIn: null })).toBe('perdido');
  });

  it('promocionar demuestra la conversión', () => {
    expect(evaluateFinalTechnique(win, { ...state, promoted: true }, null)).toBe('demostrado');
  });

  it('Philidor se demuestra sosteniendo tablas durante doce jugadas propias', () => {
    expect(
      evaluateFinalTechnique(
        draw,
        { ...state, userMoves: FINAL_DRAW_HOLD_MOVES },
        { move: 'e5f4', cp: 12, mateIn: null },
      ),
    ).toBe('demostrado');
  });

  it('detecta cuando el atacante quiebra Philidor', () => {
    expect(evaluateFinalTechnique(draw, state, { move: 'e5f4', cp: 300, mateIn: null })).toBe('perdido');
  });
});
