import { describe, expect, it } from 'vitest';
import type { GameRecord, MoveAnalysisEntry } from './types';
import { posicionPropiaParaCalculo } from './calculoPosicion';

function jugada(overrides: Partial<MoveAnalysisEntry> = {}): MoveAnalysisEntry {
  return {
    ply: 0,
    san: 'e4',
    fenAntes: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ladoQueMueve: 'w',
    jugadaUsuario: 'e2e4',
    jugadaMotor: 'd2d4',
    cpAntes: 0,
    cpDespues: 0,
    cpPerdidos: 0,
    clasificacion: 'buena',
    ...overrides,
  };
}

function partida(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'g1',
    pgn: '1. e4 e5 *',
    fuente: 'local',
    ritmo: 'clasica',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: true,
    fecha: '2026-07-20T10:00:00.000Z',
    jugadorColor: 'w',
    analisis: { jugadas: [], comparacionEvaluaciones: [], analizadaEn: '2026-07-20T11:00:00.000Z' },
    ...overrides,
  };
}

describe('posicionPropiaParaCalculo', () => {
  it('sin partidas analizadas devuelve null: ahí el ejercicio cae al catálogo', () => {
    expect(posicionPropiaParaCalculo([])).toBeNull();
    expect(posicionPropiaParaCalculo([partida({ analisis: undefined, analizada: false })])).toBeNull();
  });

  it('elige la jugada propia que más centipeones perdió, con la posición previa', () => {
    const juego = partida({
      analisis: {
        jugadas: [
          jugada({ ply: 0, cpPerdidos: 40 }),
          jugada({ ply: 2, cpPerdidos: 320, fenAntes: 'fen-critica', jugadaUsuario: 'g1f3' }),
          jugada({ ply: 4, cpPerdidos: 150 }),
        ],
        comparacionEvaluaciones: [],
        analizadaEn: '2026-07-20T11:00:00.000Z',
      },
    });
    expect(posicionPropiaParaCalculo([juego])).toMatchObject({
      fen: 'fen-critica',
      gameId: 'g1',
      ply: 2,
      motivo: 'mas-centipeones',
      jugadaEntonces: 'g1f3',
      cpPerdidos: 320,
    });
  });

  // Dudar mucho y aun así jugar bien también es una posición que vale volver a
  // mirar: es la señal que la partida deja cuando no hubo error grande.
  it('sin errores grandes, elige la jugada donde más tiempo consumió', () => {
    const juego = partida({
      tiemposPorJugadaMs: [5_000, 1_000, 240_000, 1_000],
      analisis: {
        jugadas: [jugada({ ply: 0, cpPerdidos: 10 }), jugada({ ply: 2, cpPerdidos: 20, fenAntes: 'fen-lenta' })],
        comparacionEvaluaciones: [],
        analizadaEn: '2026-07-20T11:00:00.000Z',
      },
    });
    expect(posicionPropiaParaCalculo([juego])).toMatchObject({
      fen: 'fen-lenta',
      ply: 2,
      motivo: 'mas-tiempo',
      tiempoMs: 240_000,
    });
  });

  it('solo mira jugadas del usuario, no las del rival', () => {
    const juego = partida({
      jugadorColor: 'w',
      analisis: {
        jugadas: [
          jugada({ ply: 1, ladoQueMueve: 'b', cpPerdidos: 900, fenAntes: 'fen-del-rival' }),
          jugada({ ply: 2, ladoQueMueve: 'w', cpPerdidos: 200, fenAntes: 'fen-propia' }),
        ],
        comparacionEvaluaciones: [],
        analizadaEn: '2026-07-20T11:00:00.000Z',
      },
    });
    expect(posicionPropiaParaCalculo([juego])?.fen).toBe('fen-propia');
  });

  it('mira solo las partidas analizadas más recientes', () => {
    const vieja = partida({
      id: 'vieja',
      analisis: {
        jugadas: [jugada({ cpPerdidos: 900, fenAntes: 'fen-vieja' })],
        comparacionEvaluaciones: [],
        analizadaEn: '2026-01-01T00:00:00.000Z',
      },
    });
    const nueva = partida({
      id: 'nueva',
      analisis: {
        jugadas: [jugada({ cpPerdidos: 150, fenAntes: 'fen-nueva' })],
        comparacionEvaluaciones: [],
        analizadaEn: '2026-07-25T00:00:00.000Z',
      },
    });
    expect(posicionPropiaParaCalculo([vieja, nueva], 1)?.fen).toBe('fen-nueva');
  });

  it('una partida analizada sin jugadas ni tiempos no fuerza una posición', () => {
    expect(posicionPropiaParaCalculo([partida()])).toBeNull();
  });
});
