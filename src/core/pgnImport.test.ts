import { describe, expect, it } from 'vitest';
import { buildGameRecord } from './game';
import { parsePastedPgn, partidaYaGuardada, ritmoDelPgn } from './pgnImport';

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
    expect(result).toEqual({ ok: true, pgn: PGN_CON_RESULTADO, resultado: '1-0', plyCount: 7, tiemposPorJugadaMs: [] });
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
      tiemposPorJugadaMs: [],
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

  // B14: chess.js lee una sola partida y rechaza el texto entero si trae más;
  // el mensaje decía "no es un PGN válido", y era falso.
  describe('varias partidas', () => {
    it('detecta varias partidas con encabezados y dice cuántas', () => {
      const tres = [
        '[Event "A"]\n[Result "1-0"]\n\n1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 1-0',
        '[Event "B"]\n[Result "0-1"]\n\n1. d4 d5 0-1',
        '[Event "C"]\n[Result "*"]\n\n1. c4 *',
      ].join('\n\n');
      expect(parsePastedPgn(tres)).toEqual({ ok: false, error: 'varias-partidas', partidas: 3 });
    });

    it('detecta varias partidas sin encabezados, separadas por su resultado', () => {
      expect(parsePastedPgn('1. e4 e5 1-0\n\n1. d4 d5 0-1')).toEqual({
        ok: false,
        error: 'varias-partidas',
        partidas: 2,
      });
    });

    it('detecta un encabezado nuevo aunque la partida anterior no cierre con resultado', () => {
      expect(parsePastedPgn('[Event "A"]\n\n1. e4 e5\n\n[Event "B"]\n\n1. d4 d5')).toEqual({
        ok: false,
        error: 'varias-partidas',
        partidas: 2,
      });
    });

    it('texto suelto después del resultado no es otra partida: sigue siendo inválido', () => {
      expect(parsePastedPgn('1. e4 e5 1-0 gracias por la partida')).toEqual({ ok: false, error: 'invalido' });
    });
  });

  describe('relojes [%clk]', () => {
    it('llena lo que tardó cada jugada con el índice del ply y 0 donde no hay dato', () => {
      // 3+2. Blancas: 3:00 → 2:58 → 2:40; negras: 3:00 → 2:55 → 2:56.
      const pgn = [
        '[Event "Rated Blitz game"]',
        '[TimeControl "180+2"]',
        '',
        '1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Nf3 { [%eval 0.2] [%clk 0:02:58] }',
        '2... Nc6 { [%clk 0:02:55] } 3. Bb5 { [%clk 0:02:40] } 3... a6 { [%clk 0:02:56] } *',
      ].join('\n');
      const result = parsePastedPgn(pgn);
      expect(result.ok && result.tiemposPorJugadaMs).toEqual([0, 0, 4_000, 7_000, 20_000, 1_000]);
    });

    it('lee el formato de Chess.com, sin espacios y con décimas', () => {
      const pgn = '[TimeControl "600"]\n\n1. e4 {[%clk 0:09:59.9]} 1... e5 {[%clk 0:09:58.1]} 2. Nf3 {[%clk 0:09:50.4]} 2... Nc6 {[%clk 0:09:30]} *';
      const result = parsePastedPgn(pgn);
      expect(result.ok && result.tiemposPorJugadaMs).toEqual([0, 0, 9_500, 28_100]);
    });

    it('los relojes de una variante no se cuelan en la línea principal', () => {
      const pgn = '[TimeControl "180+0"]\n\n1. e4 { [%clk 0:03:00] } (1. d4 { [%clk 0:01:00] } d5) 1... e5 { [%clk 0:03:00] } 2. Nf3 { [%clk 0:02:50] } *';
      const result = parsePastedPgn(pgn);
      expect(result.ok && result.tiemposPorJugadaMs).toEqual([0, 0, 10_000]);
    });

    it('sin un TimeControl a finish no se leen: sin incremento conocido la resta no mide nada', () => {
      const jugadas = '1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Nf3 { [%clk 0:02:50] } *';
      for (const pgn of [jugadas, `[TimeControl "?"]\n\n${jugadas}`, `[TimeControl "40/5400+30:1800+30"]\n\n${jugadas}`]) {
        const result = parsePastedPgn(pgn);
        expect(result.ok && result.tiemposPorJugadaMs).toEqual([]);
      }
    });
  });
});

describe('ritmoDelPgn', () => {
  it('prellena el ritmo desde el TimeControl del encabezado', () => {
    expect(ritmoDelPgn('[Event "x"]\n[TimeControl "180+2"]\n\n1. e4 e5 *')).toEqual({ ritmo: 'blitz', timeControl: '180+2' });
    expect(ritmoDelPgn('\n  [TimeControl "900+10"]\n\n1. e4 *')).toEqual({ ritmo: 'rapida', timeControl: '900+10' });
  });

  it('null si no hay TimeControl o no se puede leer', () => {
    expect(ritmoDelPgn('1. e4 e5 *')).toBeNull();
    expect(ritmoDelPgn('[TimeControl "?"]\n\n1. e4 *')).toBeNull();
    expect(ritmoDelPgn('')).toBeNull();
  });
});

describe('partidaYaGuardada', () => {
  const ENCABEZADOS = [
    '[Event "Rated Blitz game"]',
    '[Site "https://lichess.org/AbCdEfGh"]',
    '[Date "2026.07.17"]',
    '[White "fran"]',
    '[Black "rival"]',
    '[Result "1-0"]',
    '[UTCDate "2026.07.17"]',
    '[UTCTime "18:30:05"]',
    '[TimeControl "180+2"]',
  ];
  const CON_RELOJES = `${ENCABEZADOS.join('\n')}\n\n1. e4 { [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Qh5 { [%clk 0:02:58] } 2... Nc6 { [%clk 0:02:55] } 3. Bc4 { [%clk 0:02:50] } 3... Nf6 { [%clk 0:02:40] } 4. Qxf7# { [%clk 0:02:49] } 1-0`;
  const guardada = (pgn: string) =>
    buildGameRecord({ pgn, resultado: '1-0', tiemposPorJugadaMs: [], fuente: 'manual', ritmo: 'blitz', jugadorColor: 'w' });

  it('el mismo PGN dos veces es la misma partida', () => {
    expect(partidaYaGuardada(CON_RELOJES, [guardada(CON_RELOJES)])).toBe(true);
  });

  it('la misma partida exportada sin relojes, con comentarios, NAGs y otro espaciado también', () => {
    const otraExportacion = `${[...ENCABEZADOS].reverse().join('\n')}\n\n1.e4 e5 2.Qh5 {¿apurado?} Nc6 $2\n3.Bc4 Nf6?? 4.Qxf7# 1-0`;
    expect(partidaYaGuardada(otraExportacion, [guardada(CON_RELOJES)])).toBe(true);
  });

  it('las mismas jugadas en otra fecha u otra hora son otra partida', () => {
    const otraHora = CON_RELOJES.replace('18:30:05', '18:41:12');
    const otroDia = CON_RELOJES.replaceAll('2026.07.17', '2026.07.18');
    expect(partidaYaGuardada(otraHora, [guardada(CON_RELOJES)])).toBe(false);
    expect(partidaYaGuardada(otroDia, [guardada(CON_RELOJES)])).toBe(false);
  });

  it('los mismos encabezados con otras jugadas son otra partida', () => {
    const otra = `${ENCABEZADOS.join('\n')}\n\n1. d4 d5 2. c4 1-0`;
    expect(partidaYaGuardada(otra, [guardada(CON_RELOJES)])).toBe(false);
  });

  it('sin encabezados, compara solo las jugadas', () => {
    const suelta = '1. e4 e5 2. Nf3 Nc6';
    expect(partidaYaGuardada('1. e4 e5 2. Nf3 {hola} Nc6 *', [guardada(suelta)])).toBe(true);
    expect(partidaYaGuardada('1. e4 e5 2. Nf3 Nf6 *', [guardada(suelta)])).toBe(false);
  });

  it('no se confunde con guardadas ilegibles ni con una lista vacía', () => {
    expect(partidaYaGuardada(CON_RELOJES, [])).toBe(false);
    expect(partidaYaGuardada('1. e4 e5 *', [guardada('esto no es un pgn')])).toBe(false);
  });
});
