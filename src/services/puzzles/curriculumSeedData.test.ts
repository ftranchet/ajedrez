// Re-verifica en CI lo que scripts/verify-curriculum-patrones.mjs verificó al
// autorar el contenido (RF-6.1): si alguien edita el FEN o la solución a
// mano, esto lo detecta antes de mergear. No repite todo el razonamiento por
// patrón, solo las propiedades verificables genéricamente: la solución es
// legal y, para los cuatro patrones de mate, es mate forzado.
import { Chess, type Square } from 'chess.js';
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

  // Invariante del motivo, no solo "la jugada es legal": una posición de
  // descubierta donde la pieza que se mueve NO tapaba a la que da jaque no
  // enseña el motivo —el jaque ya estaba— y además vuelve correctas casi todas
  // las jugadas de esa pieza. Fue un bug real (2026-07). `scripts/verify-
  // curriculum-patrones.mjs` lo comprueba al autorar; acá se re-chequea en CI.
  it.each(seedCurriculumItems.filter((i) => i.patternKey === 'descubierta'))(
    '$nombre: la pieza que se mueve tapaba a la que da el jaque descubierto',
    (item) => {
      const chess = new Chess(item.fen);
      const reyNegro = chess.board().flat().find((sq) => sq && sq.type === 'k' && sq.color === 'b')!.square;
      // Antes de mover, ninguna pieza blanca da jaque (si no, no hay nada que descubrir).
      expect(chess.attackers(reyNegro, 'w')).toHaveLength(0);

      const [from, to] = [item.solucion[0].slice(0, 2), item.solucion[0].slice(2, 4)];
      chess.move({ from, to });
      const atacantes = chess.attackers(reyNegro, 'w');
      // Tras mover hay jaque, y lo da otra pieza (la que estaba tapada), no la movida.
      expect(chess.isCheck()).toBe(true);
      expect(atacantes.length).toBeGreaterThan(0);
      expect(atacantes).not.toContain(to);
    },
  );

  // Rayos X (enfilada): tras el jaque el rey debe moverse y dejar caer la pieza
  // de atrás. Si no queda capturable, la posición no demuestra el motivo.
  it.each(seedCurriculumItems.filter((i) => i.patternKey === 'rayos-x'))(
    '$nombre: tras el jaque, la pieza de atrás queda capturable',
    (item) => {
      const chess = new Chess(item.fen);
      const destino = item.solucion[0].slice(2, 4);
      chess.move({ from: item.solucion[0].slice(0, 2), to: destino });
      expect(chess.isCheck()).toBe(true);
      const respuestas = chess.moves({ verbose: true });
      expect(respuestas.length).toBeGreaterThan(0);
      for (const respuesta of respuestas) {
        const copia = new Chess(chess.fen());
        copia.move(respuesta);
        const capturaLaDama = copia
          .moves({ square: destino as Square, verbose: true })
          .some((m) => m.captured === 'q');
        expect(capturaLaDama).toBe(true);
      }
    },
  );
});
