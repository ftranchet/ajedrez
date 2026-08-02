import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { computeDests, sanDeLinea } from './chessBoardUtils';

// Este módulo no tenía tests, y alimenta tres pantallas distintas: el mapa de
// destinos de todos los tableros, y la notación de las líneas que se revelan en
// Cálculo comprometido y en Stoyko. El bug de promoción de abajo vivió acá sin
// que nada lo detectara.
describe('sanDeLinea', () => {
  // La notación de salida es la algebraica española (FIDE, Apéndice C): es la
  // que la app muestra y la que pide para escribir.
  it('traduce una línea UCI a algebraica española', () => {
    expect(sanDeLinea('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'e7e5', 'g1f3'])).toEqual([
      'e4',
      'e5',
      'Cf3',
    ]);
  });

  /**
   * El defecto real, encontrado en la ronda C sobre el catálogo del Radar:
   * `lichess-004LZ` corona con `c2c1q` y el emparejamiento ignoraba la pieza,
   * así que chess.js devolvía la primera jugada c2→c1, que es `c1=N`. El
   * caballo da jaque donde la dama no lo da, con lo cual el resto de la línea
   * quedaba ilegal y desaparecía de la pantalla.
   */
  it('respeta la pieza de promoción: c1=D y c1=C son jugadas distintas', () => {
    const fen = '4k3/8/8/8/8/7K/2p5/8 b - - 0 1';
    expect(sanDeLinea(fen, ['c2c1q'])).toEqual(['c1=D']);
    expect(sanDeLinea(fen, ['c2c1n'])).toEqual(['c1=C']);
    expect(sanDeLinea(fen, ['c2c1r'])).toEqual(['c1=T']);
    expect(sanDeLinea(fen, ['c2c1b'])).toEqual(['c1=A']);
  });

  it('la promoción equivocada rompía el resto de la línea', () => {
    // Coronar en caballo da jaque al rey de a2; coronar en dama, no. Con el
    // jaque encima, la jugada siguiente de las blancas se vuelve ilegal.
    // La posición y la línea son las de `lichess-004LZ` en el catálogo.
    const fen = '8/7R/5p2/p7/7P/2p5/3k2N1/1K6 b - - 0 48';
    const conDama = sanDeLinea(fen, ['c3c2', 'b1a2', 'c2c1q', 'h7d7', 'd2e2']);
    expect(conDama).toHaveLength(5);
    expect(conDama[2]).toBe('c1=D');
    // Con la promoción a caballo, la línea moría en la tercera jugada.
    expect(sanDeLinea(fen, ['c3c2', 'b1a2', 'c2c1n', 'h7d7', 'd2e2'])).toHaveLength(3);
  });

  it('sin sufijo de promoción toma la jugada legal que corresponda', () => {
    // Una jugada normal no lleva sufijo y no debe verse afectada.
    expect(sanDeLinea('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1', ['a1a8'])).toEqual(['Ta8+']);
  });

  it('corta en la primera jugada ilegal en vez de tirar', () => {
    // Un feedback a medias es preferible a una pantalla rota.
    expect(sanDeLinea('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['e2e4', 'a1a8', 'e7e5'])).toEqual(['e4']);
  });

  it('una línea vacía devuelve una lista vacía', () => {
    expect(sanDeLinea('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [])).toEqual([]);
  });

  it('el enroque sale con su notación, no como jugada del rey', () => {
    expect(sanDeLinea('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1g1'])).toEqual(['O-O']);
    expect(sanDeLinea('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1c1'])).toEqual(['O-O-O']);
  });
});

describe('computeDests', () => {
  it('agrupa los destinos legales por casilla de origen', () => {
    const dests = computeDests(new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
    // 16 piezas que pueden mover: 8 peones y 2 caballos.
    expect(dests.size).toBe(10);
    expect(dests.get('e2')).toEqual(['e3', 'e4']);
    expect(dests.get('g1')?.sort()).toEqual(['f3', 'h3']);
    expect(dests.get('e1')).toBeUndefined();
  });

  it('una posición sin jugadas legales no ofrece ningún destino', () => {
    // Mate del loco: las negras están ahogadas de opciones legales.
    const dests = computeDests(new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'));
    expect(dests.size).toBe(0);
  });

  it('las cuatro promociones de un mismo peón colapsan en un solo destino', () => {
    // chessground pide destino, no pieza: la elección de coronación la resuelve
    // el diálogo de promoción, no este mapa.
    const dests = computeDests(new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'));
    expect(dests.get('a7')).toEqual(['a8']);
  });
});
