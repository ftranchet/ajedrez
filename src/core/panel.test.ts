import { describe, expect, it } from 'vitest';
import { erroresGravesPorPartidaMediaMovil, mejoraErroresGraves, ratingDePartidasLentas } from './panel';
import type { Color, GameAnalysis, GameRecord, MoveAnalysisEntry } from './types';

function jugada(clasificacion: MoveAnalysisEntry['clasificacion'], ladoQueMueve: Color = 'w'): MoveAnalysisEntry {
  return {
    ply: 0,
    san: 'e4',
    fenAntes: 'startpos',
    ladoQueMueve,
    jugadaUsuario: 'e2e4',
    jugadaMotor: 'e2e4',
    cpAntes: 0,
    cpDespues: 0,
    cpPerdidos: 0,
    clasificacion,
  };
}

function analisisCon(clasificaciones: MoveAnalysisEntry['clasificacion'][]): GameAnalysis {
  // Todas las jugadas de blancas por defecto: los tests que no prueban el
  // filtro por color usan jugadorColor 'w', así cuentan como del usuario.
  return { jugadas: clasificaciones.map((c) => jugada(c, 'w')), comparacionEvaluaciones: [], analizadaEn: new Date().toISOString() };
}

// jugadorColor null = omitir el campo (JS dispara el default con `undefined`).
function game(id: string, fecha: string, analisis?: GameAnalysis, jugadorColor: Color | null = 'w'): GameRecord {
  return {
    id,
    pgn: '1. e4 *',
    fuente: 'local',
    ritmo: 'sin-reloj',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: !!analisis,
    fecha,
    analisis,
    ...(jugadorColor ? { jugadorColor } : {}),
  };
}

describe('erroresGravesPorPartidaMediaMovil', () => {
  it('sin partidas analizadas, devuelve null', () => {
    expect(erroresGravesPorPartidaMediaMovil([game('g1', '2026-01-01')])).toBeNull();
  });

  it('cuenta solo jugadas grave/error, no imprecisión ni buena', () => {
    const g = game('g1', '2026-01-01', analisisCon(['grave', 'error', 'imprecision', 'buena', 'buena']));
    expect(erroresGravesPorPartidaMediaMovil([g])).toBe(2);
  });

  it('promedia entre varias partidas analizadas', () => {
    const games = [
      game('g1', '2026-01-01', analisisCon(['grave', 'grave'])), // 2
      game('g2', '2026-01-02', analisisCon(['error'])), // 1
      game('g3', '2026-01-03', analisisCon([])), // 0
    ];
    expect(erroresGravesPorPartidaMediaMovil(games)).toBe(1);
  });

  it('ignora partidas sin analizar', () => {
    const games = [game('g1', '2026-01-01', analisisCon(['grave'])), game('g2', '2026-01-02')];
    expect(erroresGravesPorPartidaMediaMovil(games)).toBe(1);
  });

  it('respeta la ventana, quedándose con las más recientes', () => {
    const games = [
      game('viejo', '2026-01-01', analisisCon(['grave', 'grave', 'grave'])), // fuera de ventana
      game('nuevo1', '2026-01-10', analisisCon([])),
      game('nuevo2', '2026-01-11', analisisCon([])),
    ];
    expect(erroresGravesPorPartidaMediaMovil(games, 2)).toBe(0);
  });

  it('cuenta solo los errores del usuario, no los del motor (RF-1.3): filtra por jugadorColor', () => {
    // Partida con 2 errores de blancas y 3 de negras; el usuario jugó blancas.
    const analisis: GameAnalysis = {
      jugadas: [
        jugada('grave', 'w'),
        jugada('grave', 'b'),
        jugada('error', 'w'),
        jugada('grave', 'b'),
        jugada('error', 'b'),
      ],
      comparacionEvaluaciones: [],
      analizadaEn: new Date().toISOString(),
    };
    const g = game('g1', '2026-01-01', analisis, 'w');
    expect(erroresGravesPorPartidaMediaMovil([g])).toBe(2); // solo los de blancas
  });

  it('excluye de la media las partidas sin jugadorColor (no se puede atribuir el error)', () => {
    const sinColor = game('importada', '2026-01-02', analisisCon(['grave', 'grave']), null);
    const conColor = game('local', '2026-01-01', analisisCon(['error']), 'w');
    // Solo cuenta la local: 1 error / 1 partida = 1. La importada no infla ni diluye.
    expect(erroresGravesPorPartidaMediaMovil([sinColor, conColor])).toBe(1);
  });

  it('si ninguna partida tiene jugadorColor, devuelve null', () => {
    const games = [game('g1', '2026-01-01', analisisCon(['grave']), null)];
    expect(erroresGravesPorPartidaMediaMovil(games)).toBeNull();
  });
});

describe('mejoraErroresGraves (RF-13.2)', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');

  it('celebra una baja real y suficiente frente a los 30 días anteriores', () => {
    const games = [
      game('old-1', '2026-06-01T12:00:00.000Z', analisisCon(['grave', 'grave', 'error'])),
      game('old-2', '2026-06-05T12:00:00.000Z', analisisCon(['grave', 'error', 'grave'])),
      game('old-3', '2026-06-10T12:00:00.000Z', analisisCon(['error', 'grave', 'grave'])),
      game('new-1', '2026-06-25T12:00:00.000Z', analisisCon(['grave', 'error'])),
      game('new-2', '2026-07-05T12:00:00.000Z', analisisCon(['error'])),
      game('new-3', '2026-07-15T12:00:00.000Z', analisisCon(['grave'])),
    ];
    const result = mejoraErroresGraves(games, now);
    expect(result).not.toBeNull();
    expect(result?.mediaAnterior).toBe(3);
    expect(result?.mediaActual).toBeCloseTo(4 / 3);
    expect(result?.porcentaje).toBeCloseTo(55.56, 1);
  });

  it('no celebra con menos de tres partidas atribuibles por ventana', () => {
    const games = [
      game('old-1', '2026-06-01T12:00:00.000Z', analisisCon(['grave', 'grave'])),
      game('new-1', '2026-07-01T12:00:00.000Z', analisisCon([])),
    ];
    expect(mejoraErroresGraves(games, now)).toBeNull();
  });

  it('no celebra una baja menor al umbral ni partidas sin color del usuario', () => {
    const previous = [1, 2, 3].map((n) => game(`old-${n}`, `2026-06-0${n}T12:00:00.000Z`, analisisCon(['grave', 'grave', 'grave', 'grave', 'grave'])));
    const current = [
      game('new-1', '2026-07-01T12:00:00.000Z', analisisCon(['grave', 'grave', 'grave', 'grave'])),
      game('new-2', '2026-07-02T12:00:00.000Z', analisisCon(['grave', 'grave', 'grave', 'grave'])),
      game('new-3', '2026-07-03T12:00:00.000Z', analisisCon(['grave', 'grave', 'grave', 'grave', 'grave'])),
    ];
    const unattributable = game('sin-color', '2026-07-10T12:00:00.000Z', analisisCon([]), null);
    expect(mejoraErroresGraves([...previous, ...current, unattributable], now)).toBeNull();
  });
});

describe('ratingDePartidasLentas (PRD §3.1, RF-12.1)', () => {
  function partidaRateada(fecha: string, rating: number): GameRecord {
    return { ...game('rateada', fecha), ritmo: 'rapida', ratingUsuario: rating };
  }

  it('sin rating declarado ni partida rateada no inventa un número', () => {
    expect(ratingDePartidasLentas({}, [])).toBeNull();
    // Las partidas jugadas dentro de la app son 'sin-reloj' y no llevan rating:
    // ese es justamente el caso que dejaba la métrica estrella sin instrumento.
    expect(ratingDePartidasLentas({}, [game('local', '2026-07-20T10:00:00.000Z')])).toBeNull();
  });

  it('una sola toma declarada no tiene delta todavía', () => {
    const resultado = ratingDePartidasLentas(
      { ratingsExternos: [{ valor: 1420, fuente: 'lichess', fecha: '2026-06-01T10:00:00.000Z' }] },
      [],
    );
    expect(resultado).toEqual({ valor: 1420, delta: null, origen: 'declarado' });
  });

  it('con varias tomas el delta se mide contra la primera, no contra la anterior', () => {
    const resultado = ratingDePartidasLentas(
      {
        ratingsExternos: [
          { valor: 1420, fuente: 'lichess', fecha: '2026-06-01T10:00:00.000Z' },
          { valor: 1500, fuente: 'lichess', fecha: '2026-07-01T10:00:00.000Z' },
          { valor: 1465, fuente: 'lichess', fecha: '2026-08-01T10:00:00.000Z' },
        ],
      },
      [],
    );
    expect(resultado).toEqual({ valor: 1465, delta: 45, origen: 'declarado' });
  });

  it('la serie desordenada se ordena por fecha antes de leerla', () => {
    const resultado = ratingDePartidasLentas(
      {
        ratingsExternos: [
          { valor: 1500, fuente: 'otro', fecha: '2026-07-01T10:00:00.000Z' },
          { valor: 1420, fuente: 'otro', fecha: '2026-06-01T10:00:00.000Z' },
        ],
      },
      [],
    );
    expect(resultado).toEqual({ valor: 1500, delta: 80, origen: 'declarado' });
  });

  it('sin serie declarada cae a la partida rateada más reciente', () => {
    const resultado = ratingDePartidasLentas({}, [
      partidaRateada('2026-06-01T10:00:00.000Z', 1300),
      partidaRateada('2026-07-01T10:00:00.000Z', 1380),
    ]);
    expect(resultado).toEqual({ valor: 1380, delta: null, origen: 'partida' });
  });

  it('la serie declarada tiene prioridad: no se mezclan dos poblaciones en un delta', () => {
    const resultado = ratingDePartidasLentas(
      { ratingsExternos: [{ valor: 1420, fuente: 'chesscom', fecha: '2026-06-01T10:00:00.000Z' }] },
      [partidaRateada('2026-07-01T10:00:00.000Z', 1900)],
    );
    expect(resultado?.origen).toBe('declarado');
    expect(resultado?.valor).toBe(1420);
  });
});
