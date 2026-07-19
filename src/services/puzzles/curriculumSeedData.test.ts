// Re-verifica en CI lo que scripts/verify-curriculum-patrones.mjs verificó al
// autorar el contenido (RF-6.1): si alguien edita el FEN o la solución a
// mano, esto lo detecta antes de mergear. No repite todo el razonamiento por
// patrón, solo las propiedades verificables genéricamente: la solución es
// legal y, para los cuatro patrones de mate, es mate forzado.
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { seedCurriculumItems } from './curriculumSeedData';

const PATRONES_DE_MATE = new Set(['mate-pasillo', 'mate-escalera', 'mate-dama-rey', 'mate-coz']);

describe('seedCurriculumItems', () => {
  it('no tiene ids repetidos', () => {
    const ids = seedCurriculumItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(seedCurriculumItems.filter((i) => i.tipo === 'patron'))('$nombre: la solución es legal desde el FEN', (item) => {
    const chess = new Chess(item.fen);
    expect(chess.isCheck()).toBe(false);
    const [from, to] = [item.solucion[0].slice(0, 2), item.solucion[0].slice(2, 4)];
    const legal = chess.moves({ verbose: true }).some((m) => m.from === from && m.to === to);
    expect(legal).toBe(true);
  });

  it.each(seedCurriculumItems.filter((i) => i.tipo === 'final'))('$nombre: define una posición legal y el objetivo del usuario', (item) => {
    const chess = new Chess(item.fen);
    expect(chess.isGameOver()).toBe(false);
    expect(item.solucion).toEqual([]);
    expect(item.resultadoEsperado).toMatch(/^(gana|tablas)$/);
    expect(item.ladoUsuario).toMatch(/^(w|b)$/);
  });

  it.each(seedCurriculumItems.filter((i) => PATRONES_DE_MATE.has(i.patternKey)))('$nombre: la solución es mate forzado', (item) => {
    const chess = new Chess(item.fen);
    const [from, to] = [item.solucion[0].slice(0, 2), item.solucion[0].slice(2, 4)];
    chess.move({ from, to });
    expect(chess.isCheckmate()).toBe(true);
  });
});
