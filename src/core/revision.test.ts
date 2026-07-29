import { describe, expect, it } from 'vitest';
import { casillasDeUci, revisionDelError } from './revision';

const fen = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';

describe('casillasDeUci', () => {
  it('separa origen y destino, con o sin pieza de promoción', () => {
    expect(casillasDeUci('a1a8')).toEqual(['a1', 'a8']);
    expect(casillasDeUci('e7e8q')).toEqual(['e7', 'e8']);
  });

  it('descarta lo que no es una jugada UCI', () => {
    expect(casillasDeUci('')).toBeNull();
    expect(casillasDeUci(null)).toBeNull();
    expect(casillasDeUci('Ta8')).toBeNull();
    expect(casillasDeUci('z9a1')).toBeNull();
  });
});

describe('revisionDelError', () => {
  it('arma la revelación con la posición de la decisión', () => {
    expect(revisionDelError(fen, 'a1a7', 'a1a8')).toEqual({
      fen,
      jugada: ['a1', 'a7'],
      correcta: ['a1', 'a8'],
      jaque: false,
    });
  });

  // El tablero rebobina: el jaque que corresponde es el de la posición
  // revelada, no el que dejó la jugada equivocada.
  it('registra si en esa posición había jaque', () => {
    expect(revisionDelError('6k1/5ppp/8/8/8/8/8/R4RK1 b - - 0 1', 'g8h8', 'g8f8')?.jaque).toBe(false);
    expect(revisionDelError('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', 'g8h7', 'g8g7')?.jaque).toBe(true);
  });

  it('sirve sin la jugada del usuario: la flecha que importa es la correcta', () => {
    expect(revisionDelError(fen, null, 'a1a8')?.jugada).toBeNull();
  });

  it('no revela nada sin jugada correcta ni sin posición', () => {
    expect(revisionDelError(fen, 'a1a7', undefined)).toBeNull();
    expect(revisionDelError('', 'a1a7', 'a1a8')).toBeNull();
  });
});
