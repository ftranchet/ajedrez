import { describe, expect, it } from 'vitest';
import type { CurriculumItem } from './types';
import { FINAL_DRAW_HOLD_MOVES, evaluateFinalTechnique, objetivoDeFinal } from './finales';

const win: CurriculumItem = {
  id: 'win', tipo: 'final', patternKey: 'final-rey-peon', nombre: 'Gana', fen: '8/8/8/4k3/8/4K3/4P3/8 b - - 0 1', solucion: [],
  resultadoEsperado: 'gana', ladoUsuario: 'w', objetivo: 'coronar',
};
const mate: CurriculumItem = {
  id: 'mate', tipo: 'final', patternKey: 'final-torre', nombre: 'Mate de torre', fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1', solucion: [],
  resultadoEsperado: 'gana', ladoUsuario: 'w', objetivo: 'mate',
};
const draw: CurriculumItem = {
  id: 'draw', tipo: 'final', patternKey: 'final-philidor', nombre: 'Tablas', fen: '8/4k3/r7/4K3/4P3/8/8/7R b - - 0 1', solucion: [],
  resultadoEsperado: 'tablas', ladoUsuario: 'b',
};
const state = { gameOver: false, draw: false, winner: null, promoted: false, userMoves: 1 } as const;

describe('objetivoDeFinal', () => {
  it('respeta lo declarado por el catálogo', () => {
    expect(objetivoDeFinal(mate)).toBe('mate');
    expect(objetivoDeFinal(win)).toBe('coronar');
  });

  // Los ítems sembrados antes de que existiera el campo siguen en la base de
  // datos de quien ya usaba la app hasta que se repuebla el catálogo.
  it('lo deduce de la posición cuando el ítem no lo declara', () => {
    expect(objetivoDeFinal({ ...mate, objetivo: undefined })).toBe('mate');
    expect(objetivoDeFinal({ ...win, objetivo: undefined })).toBe('coronar');
    expect(objetivoDeFinal({ ...win, objetivo: undefined, fen: '8/4p3/4k3/8/8/8/8/4K3 w - - 0 1', ladoUsuario: 'b' })).toBe('coronar');
  });
});

describe('evaluateFinalTechnique', () => {
  it('mantiene un final ganado si Stockfish sigue claramente peor', () => {
    expect(evaluateFinalTechnique(win, state, { move: 'e7d7', cp: -600, mateIn: null })).toBe('continuar');
  });

  it('marca pérdida de la técnica cuando una ganada cae a igualdad', () => {
    expect(evaluateFinalTechnique(win, state, { move: 'e7d7', cp: 0, mateIn: null })).toBe('perdido');
  });

  it('coronar demuestra la conversión si la posición sigue decidida', () => {
    expect(evaluateFinalTechnique(win, { ...state, promoted: true }, { move: 'e7d7', cp: null, mateIn: -6 })).toBe('demostrado');
    expect(evaluateFinalTechnique(win, { ...state, promoted: true }, { move: 'e7d7', cp: -900, mateIn: null })).toBe('demostrado');
  });

  // El error clásico de Lucena: se corona y en la jugada siguiente un jaque en
  // la espalda enfila la dama. Coronar era terminal por sí solo, así que la
  // app felicitaba por una técnica que en la partida se pierde.
  it('coronar y quedar sin ventaja no demuestra nada', () => {
    expect(evaluateFinalTechnique(win, { ...state, promoted: true }, { move: 'g2g8', cp: -20, mateIn: null })).toBe('perdido');
  });

  it('coronar ahogando al rival es técnica perdida, no demostración', () => {
    expect(evaluateFinalTechnique(win, { ...state, promoted: true, gameOver: true, draw: true }, null)).toBe('perdido');
  });

  it('espera la evaluación antes de dar por buena una coronación', () => {
    expect(evaluateFinalTechnique(win, { ...state, promoted: true }, null)).toBe('continuar');
  });

  // El bug que cerraba los mates elementales sin que el usuario demostrara
  // nada: a profundidad 18 Stockfish ve el mate contra sí mismo después de
  // casi cualquier primera jugada, y eso se tomaba como técnica demostrada.
  it('en un mate elemental, que el motor vea el mate no alcanza: hay que darlo', () => {
    expect(evaluateFinalTechnique(mate, state, { move: 'e5d5', cp: null, mateIn: -14 })).toBe('continuar');
    expect(evaluateFinalTechnique(mate, state, { move: 'e5d5', cp: -8115, mateIn: null })).toBe('continuar');
    expect(evaluateFinalTechnique(mate, { ...state, gameOver: true, winner: 'w' }, null)).toBe('demostrado');
  });

  it('en un mate elemental, ahogar o llegar a las 50 jugadas pierde la técnica', () => {
    expect(evaluateFinalTechnique(mate, { ...state, gameOver: true, draw: true }, null)).toBe('perdido');
  });

  it('detecta que el rival pasó a dar mate', () => {
    expect(evaluateFinalTechnique(win, state, { move: 'e7d7', cp: null, mateIn: 3 })).toBe('perdido');
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

  it('defendiendo tablas, ganar también sostiene el resultado pedido', () => {
    expect(evaluateFinalTechnique(draw, { ...state, gameOver: true, winner: 'b' }, null)).toBe('demostrado');
  });
});
