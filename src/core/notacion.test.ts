import { describe, expect, it } from 'vitest';
import { aEspanol, aIngles, interpretarJugada, lineaAEspanol } from './notacion';

// Posición tras 1.e4 e5 2.Cf3 Cc6, la misma que usan los tests de cálculo.
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

describe('traducción de letras de pieza (FIDE, Apéndice C: idioma del jugador)', () => {
  it('traduce las cinco piezas y deja la casilla intacta', () => {
    expect(aEspanol('Nf3')).toBe('Cf3');
    expect(aEspanol('Bc4')).toBe('Ac4');
    expect(aEspanol('Rae1')).toBe('Tae1');
    expect(aEspanol('Qxd8')).toBe('Dxd8');
    expect(aEspanol('Kg1')).toBe('Rg1');
  });

  it('la jugada de peón no lleva letra y no se toca', () => {
    expect(aEspanol('e4')).toBe('e4');
    expect(aEspanol('exd5')).toBe('exd5');
  });

  it('el enroque es igual en los dos idiomas', () => {
    expect(aEspanol('O-O')).toBe('O-O');
    expect(aEspanol('O-O-O')).toBe('O-O-O');
  });

  it('la coronación traduce la pieza coronada, no la casilla', () => {
    expect(aEspanol('e8=Q')).toBe('e8=D');
    expect(aEspanol('exd8=N+')).toBe('exd8=C+');
  });

  it('conserva los sufijos de jaque y mate', () => {
    expect(aEspanol('Qh5#')).toBe('Dh5#');
    expect(aEspanol('Nf7+')).toBe('Cf7+');
  });

  it('ida y vuelta: traducir y volver deja la jugada igual', () => {
    for (const san of ['Nf3', 'Bc4', 'Rae1', 'Qxd8', 'Kg1', 'e4', 'exd5', 'O-O', 'e8=Q']) {
      expect(aIngles(aEspanol(san))).toBe(san);
    }
  });
});

describe('interpretarJugada', () => {
  it('acepta algebraica española', () => {
    expect(interpretarJugada(FEN, [], 'Ac4')).toEqual({ uci: 'f1c4', san: 'Ac4' });
    expect(interpretarJugada(FEN, [], 'd4')).toEqual({ uci: 'd2d4', san: 'd4' });
  });

  it('sigue aceptando UCI, que era el formato anterior y no es ambiguo', () => {
    expect(interpretarJugada(FEN, [], 'f1c4')).toEqual({ uci: 'f1c4', san: 'Ac4' });
  });

  // "Re1" es rey en español y torre en inglés, y las dos pueden ser legales a
  // la vez: aceptar los dos idiomas sería elegir en silencio por el usuario.
  it('rechaza la algebraica inglesa con un error propio, no con "formato inválido"', () => {
    expect(interpretarJugada(FEN, [], 'Bc4')).toEqual({ error: 'notacion-inglesa' });
    expect(interpretarJugada(FEN, [], 'Nc3')).toEqual({ error: 'notacion-inglesa' });
  });

  it('una jugada bien escrita pero ilegal se distingue de una mal escrita', () => {
    expect(interpretarJugada(FEN, [], 'Ac8')).toEqual({ error: 'ilegal' });
    expect(interpretarJugada(FEN, [], 'zzz')).toEqual({ error: 'formato' });
    expect(interpretarJugada(FEN, [], '')).toEqual({ error: 'formato' });
  });

  it('no exige el "+" de jaque: anticiparlo no es tarea de quien anota', () => {
    // 3.Ac4 Cf6 4.Axf7+ da jaque; se acepta con el signo y sin él.
    const linea = ['f1c4', 'g8f6'];
    expect(interpretarJugada(FEN, linea, 'Axf7')).toMatchObject({ uci: 'c4f7', san: 'Axf7+' });
    expect(interpretarJugada(FEN, linea, 'Axf7+')).toMatchObject({ uci: 'c4f7' });
  });

  it('valida contra la posición que dejó el ply anterior, no contra la inicial', () => {
    // Ac4 es legal en la posición inicial de la línea, pero no después de jugarla.
    expect(interpretarJugada(FEN, [], 'Ac4')).toMatchObject({ uci: 'f1c4' });
    expect(interpretarJugada(FEN, ['f1c4'], 'Ac4')).toEqual({ error: 'ilegal' });
  });

  it('acepta el enroque escrito con ceros, que es como se anota a mano', () => {
    const linea = ['f1c4', 'f8c5'];
    expect(interpretarJugada(FEN, linea, '0-0')).toMatchObject({ uci: 'e1g1', san: 'O-O' });
    expect(interpretarJugada(FEN, linea, 'O-O')).toMatchObject({ uci: 'e1g1' });
  });
});

describe('lineaAEspanol', () => {
  it('convierte una línea guardada en UCI a algebraica española', () => {
    expect(lineaAEspanol(FEN, ['f1c4', 'f8c5', 'e1g1'])).toEqual(['Ac4', 'Ac5', 'O-O']);
  });

  it('corta en el primer ply que no se puede jugar, sin romperse', () => {
    expect(lineaAEspanol(FEN, ['f1c4', 'a1a8'])).toEqual(['Ac4']);
  });
});
