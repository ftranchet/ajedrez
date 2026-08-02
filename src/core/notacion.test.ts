import { describe, expect, it } from 'vitest';
import { aIngles, aNotacion, interpretarJugada, lineaANotacion } from './notacion';

// Casi todos los casos son sobre la notación española, que es el default; el
// último bloque cubre la preferencia en inglés.
const enEspanol = (san: string) => aNotacion(san, 'es');
const lineaEnEspanol = (fen: string, linea: string[]) => lineaANotacion(fen, linea, 'es');

// Posición tras 1.e4 e5 2.Cf3 Cc6, la misma que usan los tests de cálculo.
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

describe('traducción de letras de pieza (FIDE, Apéndice C: idioma del jugador)', () => {
  it('traduce las cinco piezas y deja la casilla intacta', () => {
    expect(enEspanol('Nf3')).toBe('Cf3');
    expect(enEspanol('Bc4')).toBe('Ac4');
    expect(enEspanol('Rae1')).toBe('Tae1');
    expect(enEspanol('Qxd8')).toBe('Dxd8');
    expect(enEspanol('Kg1')).toBe('Rg1');
  });

  it('la jugada de peón no lleva letra y no se toca', () => {
    expect(enEspanol('e4')).toBe('e4');
    expect(enEspanol('exd5')).toBe('exd5');
  });

  it('el enroque es igual en los dos idiomas', () => {
    expect(enEspanol('O-O')).toBe('O-O');
    expect(enEspanol('O-O-O')).toBe('O-O-O');
  });

  it('la coronación traduce la pieza coronada, no la casilla', () => {
    expect(enEspanol('e8=Q')).toBe('e8=D');
    expect(enEspanol('exd8=N+')).toBe('exd8=C+');
  });

  it('conserva los sufijos de jaque y mate', () => {
    expect(enEspanol('Qh5#')).toBe('Dh5#');
    expect(enEspanol('Nf7+')).toBe('Cf7+');
  });

  it('ida y vuelta: traducir y volver deja la jugada igual', () => {
    for (const san of ['Nf3', 'Bc4', 'Rae1', 'Qxd8', 'Kg1', 'e4', 'exd5', 'O-O', 'e8=Q']) {
      expect(aIngles(enEspanol(san), 'es')).toBe(san);
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
  it('con la app en español, rechaza la inglesa con un error propio, no con "formato inválido"', () => {
    expect(interpretarJugada(FEN, [], 'Bc4')).toEqual({ error: 'otro-idioma' });
    expect(interpretarJugada(FEN, [], 'Nc3')).toEqual({ error: 'otro-idioma' });
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

describe('lineaANotacion', () => {
  it('convierte una línea guardada en UCI a algebraica española', () => {
    expect(lineaEnEspanol(FEN, ['f1c4', 'f8c5', 'e1g1'])).toEqual(['Ac4', 'Ac5', 'O-O']);
  });

  it('corta en el primer ply que no se puede jugar, sin romperse', () => {
    expect(lineaEnEspanol(FEN, ['f1c4', 'a1a8'])).toEqual(['Ac4']);
  });
});

describe('preferencia de idioma (RNF-9)', () => {
  it('en inglés muestra las iniciales inglesas y no traduce', () => {
    expect(aNotacion('Nf3', 'en')).toBe('Nf3');
    expect(aNotacion('Qxd8', 'en')).toBe('Qxd8');
    expect(lineaANotacion(FEN, ['f1c4', 'f8c5', 'e1g1'], 'en')).toEqual(['Bc4', 'Bc5', 'O-O']);
  });

  it('en inglés acepta la inglesa y rechaza la española, simétrico al default', () => {
    expect(interpretarJugada(FEN, [], 'Bc4', 'en')).toEqual({ uci: 'f1c4', san: 'Bc4' });
    expect(interpretarJugada(FEN, [], 'Ac4', 'en')).toEqual({ error: 'otro-idioma' });
  });

  // Las dos notaciones comparten la letra R con significados distintos (rey en
  // español, torre en inglés): por eso nunca se aceptan las dos a la vez.
  it('la R se resuelve según el idioma elegido, sin adivinar', () => {
    const fen = '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1';
    expect(interpretarJugada(fen, [], 'Ra8', 'en')).toMatchObject({ uci: 'a1a8' }); // torre
    expect(interpretarJugada(fen, [], 'Rd1', 'es')).toMatchObject({ uci: 'e1d1' }); // rey
  });

  it('UCI se acepta en los dos idiomas y devuelve la jugada en el elegido', () => {
    expect(interpretarJugada(FEN, [], 'f1c4', 'es')).toEqual({ uci: 'f1c4', san: 'Ac4' });
    expect(interpretarJugada(FEN, [], 'f1c4', 'en')).toEqual({ uci: 'f1c4', san: 'Bc4' });
  });
});
