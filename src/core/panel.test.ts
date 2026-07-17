import { describe, expect, it } from 'vitest';
import { erroresGravesPorPartidaMediaMovil } from './panel';
import type { GameAnalysis, GameRecord, MoveAnalysisEntry } from './types';

function jugada(clasificacion: MoveAnalysisEntry['clasificacion']): MoveAnalysisEntry {
  return {
    ply: 0,
    san: 'e4',
    fenAntes: 'startpos',
    ladoQueMueve: 'w',
    jugadaUsuario: 'e2e4',
    jugadaMotor: 'e2e4',
    cpAntes: 0,
    cpDespues: 0,
    cpPerdidos: 0,
    clasificacion,
  };
}

function analisisCon(clasificaciones: MoveAnalysisEntry['clasificacion'][]): GameAnalysis {
  return { jugadas: clasificaciones.map(jugada), comparacionEvaluaciones: [], analizadaEn: new Date().toISOString() };
}

function game(id: string, fecha: string, analisis?: GameAnalysis): GameRecord {
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
});
