import { describe, expect, it } from 'vitest';
import { parsePastedPgn } from './pgnImport';

// Jaque mate del pastor verificado con chess.js: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#.
const PGN_CON_RESULTADO = '[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0';
const PGN_SIN_RESULTADO = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Ba6 bxa6';

describe('parsePastedPgn', () => {
  it('rechaza texto vacío', () => {
    expect(parsePastedPgn('   ')).toEqual({ ok: false, error: 'vacio' });
  });

  it('rechaza PGN inválido', () => {
    expect(parsePastedPgn('esto no es un pgn')).toEqual({ ok: false, error: 'invalido' });
  });

  it('rechaza un PGN sin jugadas', () => {
    expect(parsePastedPgn('[Result "*"]\n\n*')).toEqual({ ok: false, error: 'sin-jugadas' });
  });

  it('extrae el resultado del header cuando está presente', () => {
    const result = parsePastedPgn(PGN_CON_RESULTADO);
    expect(result).toEqual({ ok: true, pgn: PGN_CON_RESULTADO, resultado: '1-0', plyCount: 7 });
  });

  it('usa "*" cuando no hay header de resultado', () => {
    const result = parsePastedPgn(PGN_SIN_RESULTADO);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resultado).toBe('*');
      expect(result.plyCount).toBe(8);
    }
  });

  it('recorta espacios en blanco alrededor del PGN', () => {
    const result = parsePastedPgn(`\n\n  ${PGN_SIN_RESULTADO}  \n`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pgn).toBe(PGN_SIN_RESULTADO);
  });
});
