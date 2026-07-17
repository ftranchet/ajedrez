import { describe, expect, it } from 'vitest';
import { decisionCorrecta, hayFugaDeTiempo, perfilDeTiempo, type PerfilDeTiempo } from './triage';
import type { GameAnalysis, GameRecord, MoveAnalysisEntry } from './types';

function jugada(ply: number, ladoQueMueve: 'w' | 'b', clasificacion: MoveAnalysisEntry['clasificacion']): MoveAnalysisEntry {
  return {
    ply,
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

function game(overrides: Partial<GameRecord> & { analisis: GameAnalysis }): GameRecord {
  return {
    id: 'g1',
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *',
    fuente: 'local',
    ritmo: 'sin-reloj',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: true,
    fecha: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('perfilDeTiempo', () => {
  it('sin partidas, devuelve null', () => {
    expect(perfilDeTiempo([])).toBeNull();
  });

  it('ignora partidas sin jugadorColor, sin analizar, o sin tiempos', () => {
    const analisis: GameAnalysis = { jugadas: [jugada(0, 'w', 'buena')], comparacionEvaluaciones: [], analizadaEn: '2026-01-01' };
    const sinColor = game({ analisis, tiemposPorJugadaMs: [1000] });
    const sinAnalisis = game({ analisis: undefined as unknown as GameAnalysis, jugadorColor: 'w', tiemposPorJugadaMs: [1000] });
    const sinTiempos = game({ analisis, jugadorColor: 'w', tiemposPorJugadaMs: [] });
    expect(perfilDeTiempo([sinColor, sinAnalisis, sinTiempos])).toBeNull();
  });

  it('calcula infragasto y sobregasto relativos a la mediana propia del usuario en esa partida', () => {
    // Usuario juega blancas: plies pares. Mediana de sus 4 tiempos (1000,
    // 5000, 200, 3000) es 2000. Relativo: ply0=0.5 (rápida), ply2=2.5
    // (lenta), ply4=0.1 (rápida), ply6=1.5 (ninguna de las dos).
    const analisis: GameAnalysis = {
      jugadas: [
        jugada(0, 'w', 'grave'), // rápida y costosa → cuenta para infragasto
        jugada(1, 'b', 'buena'),
        jugada(2, 'w', 'buena'), // lenta y no costosa → cuenta para sobregasto
        jugada(3, 'b', 'buena'),
        jugada(4, 'w', 'buena'), // rápida y no costosa → no cuenta para infragasto
        jugada(5, 'b', 'buena'),
        jugada(6, 'w', 'error'), // ni rápida ni lenta → no entra en ninguna bolsa
        jugada(7, 'b', 'buena'),
      ],
      comparacionEvaluaciones: [],
      analizadaEn: '2026-01-01',
    };
    const g = game({ analisis, jugadorColor: 'w', tiemposPorJugadaMs: [1000, 500, 5000, 500, 200, 500, 3000, 500] });

    const perfil = perfilDeTiempo([g]) as PerfilDeTiempo;
    expect(perfil).not.toBeNull();
    expect(perfil.jugadasConsideradas).toBe(4);
    expect(perfil.infragasto).toBeCloseTo(0.5); // 1 de 2 rápidas fue costosa
    expect(perfil.sobregasto).toBeCloseTo(1); // 1 de 1 lenta no fue costosa
  });
});

describe('hayFugaDeTiempo', () => {
  it('sin perfil, no hay fuga', () => {
    expect(hayFugaDeTiempo(null)).toBe(false);
  });

  it('detecta fuga por infragasto o sobregasto por encima del umbral', () => {
    expect(hayFugaDeTiempo({ infragasto: 0.4, sobregasto: 0, jugadasConsideradas: 10 })).toBe(true);
    expect(hayFugaDeTiempo({ infragasto: 0, sobregasto: 0.4, jugadasConsideradas: 10 })).toBe(true);
    expect(hayFugaDeTiempo({ infragasto: 0.2, sobregasto: 0.2, jugadasConsideradas: 10 })).toBe(false);
  });
});

describe('decisionCorrecta', () => {
  it('ofensiva, defensa y envenenada exigen cálculo', () => {
    expect(decisionCorrecta('ofensiva')).toBe('calcular');
    expect(decisionCorrecta('defensa')).toBe('calcular');
    expect(decisionCorrecta('envenenada')).toBe('calcular');
  });

  it('tranquila y genuina alcanzan con una jugada sólida', () => {
    expect(decisionCorrecta('tranquila')).toBe('alcanza');
    expect(decisionCorrecta('genuina')).toBe('alcanza');
  });
});
