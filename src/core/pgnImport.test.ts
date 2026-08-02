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

  it('extrae ratings y fecha reales de los headers para medir transferencia', () => {
    const pgn = '[Date "2025.12.31"]\n[WhiteElo "1512"]\n[BlackElo "1498"]\n\n1. e4 e5 *';
    expect(parsePastedPgn(pgn)).toEqual({
      ok: true,
      pgn,
      resultado: '*',
      plyCount: 2,
      whiteElo: 1512,
      blackElo: 1498,
      playedAt: '2025-12-31T12:00:00.000Z',
    });
  });

  // Todo lo que vuelve a reproducir el PGN guardado (services/analysis/
  // gameAnalyzer.ts y ui/state/analysisStore.ts) arranca de un `new Chess()`
  // estándar. Una partida con posición inicial propia cuyas jugadas también
  // sean legales desde la posición normal se analizaría *en silencio* sobre
  // otro tablero, así que no entra.
  describe('posición inicial no estándar', () => {
    it('rechaza un PGN con SetUp/FEN', () => {
      const pgn = '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *';
      expect(parsePastedPgn(pgn)).toEqual({ ok: false, error: 'posicion-inicial-no-estandar' });
    });

    it('rechaza un FEN suelto aunque no venga el SetUp', () => {
      // chess.js respeta el FEN igual, con o sin SetUp: el rechazo no puede
      // depender de que el generador del PGN haya puesto los dos headers.
      const pgn = '[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 *';
      expect(parsePastedPgn(pgn)).toEqual({ ok: false, error: 'posicion-inicial-no-estandar' });
    });

    it('rechaza SetUp sin FEN: se declara no estándar y no dice desde dónde', () => {
      expect(parsePastedPgn('[SetUp "1"]\n\n1. e4 e5 *')).toEqual({
        ok: false,
        error: 'posicion-inicial-no-estandar',
      });
    });

    it('rechaza variantes de Lichess aunque las jugadas sean legales', () => {
      // El caso peligroso: "From Position" con jugadas que también valen desde
      // la posición inicial. Sin el header, el análisis salía sin avisar.
      const pgn = '[Variant "From Position"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]\n\n1. e4 e5 *';
      expect(parsePastedPgn(pgn)).toEqual({ ok: false, error: 'posicion-inicial-no-estandar' });
      expect(parsePastedPgn('[Variant "Chess960"]\n\n1. e4 e5 *')).toEqual({
        ok: false,
        error: 'posicion-inicial-no-estandar',
      });
    });

    it('acepta el FEN de la posición inicial estándar y el Variant "Standard"', () => {
      // Muchos exportadores escriben los headers igual en partidas normales:
      // rechazarlas sería un falso positivo sobre la vía de importación real.
      const conFen = parsePastedPgn(
        '[Variant "Standard"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]\n\n1. e4 e5 *',
      );
      expect(conFen.ok).toBe(true);
      expect(parsePastedPgn('[Variant "Standard"]\n\n1. e4 e5 *').ok).toBe(true);
    });
  });

  it('ignora ratings y fechas inválidos en vez de inventar valores', () => {
    const result = parsePastedPgn('[Date "2025.02.31"]\n[WhiteElo "?"]\n[BlackElo "99999"]\n\n1. e4 e5 *');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.whiteElo).toBeUndefined();
      expect(result.blackElo).toBeUndefined();
      expect(result.playedAt).toBeUndefined();
    }
  });
});
