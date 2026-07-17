import { describe, expect, it } from 'vitest';
import { detectarFugaTactica, dietaPorBanda, estimarBandaElo } from './prescriptor';
import type { ErrorCard, GameAnalysis, GameRecord, MoveAnalysisEntry } from './types';

function cardTactica(creadaEn: string): ErrorCard {
  return {
    id: crypto.randomUUID(),
    fen: 'startpos',
    ladoAMover: 'w',
    jugadaUsuario: 'a2a3',
    jugadaCorrecta: 'e2e4',
    categoria: 'tactico',
    origen: 'radar',
    fsrs: {
      due: creadaEn,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      state: 'new',
      lastReview: null,
    },
    creadaEn,
  };
}

function cardPosicional(creadaEn: string): ErrorCard {
  return { ...cardTactica(creadaEn), categoria: 'posicional' };
}

describe('detectarFugaTactica', () => {
  const ahora = new Date('2026-07-17T00:00:00.000Z');

  it('sin tarjetas recientes, no detecta fuga', () => {
    expect(detectarFugaTactica([], ahora)).toEqual({ categoria: null, proporcion: 0 });
  });

  it('detecta fuga táctica cuando superan el 35% de lo reciente', () => {
    const cards = [cardTactica('2026-07-10'), cardTactica('2026-07-11'), cardPosicional('2026-07-12')];
    const resultado = detectarFugaTactica(cards, ahora);
    expect(resultado.categoria).toBe('tactico');
    expect(resultado.proporcion).toBeCloseTo(2 / 3);
  });

  it('no detecta fuga si las tácticas no superan el umbral', () => {
    const cards = [cardTactica('2026-07-10'), cardPosicional('2026-07-11'), cardPosicional('2026-07-12')];
    expect(detectarFugaTactica(cards, ahora).categoria).toBeNull();
  });

  it('ignora tarjetas de hace más de 30 días', () => {
    const cards = [cardTactica('2026-01-01T00:00:00.000Z')];
    expect(detectarFugaTactica(cards, ahora)).toEqual({ categoria: null, proporcion: 0 });
  });
});

describe('dietaPorBanda', () => {
  it('usa la tabla base cuando no hay fuga', () => {
    const dieta = dietaPorBanda('intermedio', []);
    expect(dieta.curriculumMax).toBe(4);
    expect(dieta.radarCount).toBe(8);
    expect(dieta.ajusteFugas.categoria).toBeNull();
  });

  it('refuerza el Radar cuando hay fuga táctica', () => {
    const ahora = new Date('2026-07-17T00:00:00.000Z');
    const cards = [cardTactica('2026-07-10'), cardTactica('2026-07-11'), cardTactica('2026-07-12')];
    const dieta = dietaPorBanda('intermedio', cards, [], ahora);
    expect(dieta.radarCount).toBe(10); // 8 base + 2 de bonus
    expect(dieta.ajusteFugas.categoria).toBe('tactico');
  });

  it('cada banda tiene su propia dieta base', () => {
    expect(dietaPorBanda('principiante', []).curriculumMax).toBe(6);
    expect(dietaPorBanda('experto', []).curriculumMax).toBe(2);
  });

  it('sin partidas con perfil de tiempo, triageActivo es falso', () => {
    expect(dietaPorBanda('intermedio', []).triageActivo).toBe(false);
  });

  it('suma Triage cuando el perfil de tiempo muestra una fuga (RF-11.2, ejemplo literal del PRD)', () => {
    // Dos jugadas del usuario (blancas): 50ms y 500ms, mediana 275. La de
    // 50ms es "rápida" (≤0.5×mediana) y salió grave → infragasto = 1.
    const jugada = (ply: number, lado: 'w' | 'b', clasificacion: MoveAnalysisEntry['clasificacion']): MoveAnalysisEntry => ({
      ply,
      san: 'e4',
      fenAntes: 'startpos',
      ladoQueMueve: lado,
      jugadaUsuario: 'e2e4',
      jugadaMotor: 'e2e4',
      cpAntes: 0,
      cpDespues: 0,
      cpPerdidos: 0,
      clasificacion,
    });
    const analisis: GameAnalysis = {
      jugadas: [jugada(0, 'w', 'grave'), jugada(1, 'b', 'buena'), jugada(2, 'w', 'buena'), jugada(3, 'b', 'buena')],
      comparacionEvaluaciones: [],
      analizadaEn: '2026-01-01',
    };
    const gameConFuga: GameRecord = {
      id: 'g1',
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [50, 500, 500, 500],
      analizada: true,
      fecha: '2026-01-01T00:00:00.000Z',
      jugadorColor: 'w',
      analisis,
    };
    const dieta = dietaPorBanda('intermedio', [], [gameConFuga]);
    expect(dieta.triageActivo).toBe(true);
  });
});

describe('estimarBandaElo', () => {
  it('dos derrotas y 0% de acierto en el Radar da la banda más baja', () => {
    expect(estimarBandaElo({ juego1: 'perdio', juego2: 'perdio', radarAciertos: 0, radarTotal: 20 })).toBe('principiante');
  });

  it('dos victorias y 100% de acierto da la banda más alta', () => {
    expect(estimarBandaElo({ juego1: 'gano', juego2: 'gano', radarAciertos: 20, radarTotal: 20 })).toBe('experto');
  });

  it('un resultado mixto cae en una banda intermedia', () => {
    const banda = estimarBandaElo({ juego1: 'gano', juego2: 'perdio', radarAciertos: 10, radarTotal: 20 });
    expect(['elemental', 'intermedio']).toContain(banda);
  });

  it('tablas en ambas partidas puntúa como resultado a medias', () => {
    const conTablas = estimarBandaElo({ juego1: 'tablas', juego2: 'tablas', radarAciertos: 10, radarTotal: 20 });
    const conDerrotas = estimarBandaElo({ juego1: 'perdio', juego2: 'perdio', radarAciertos: 10, radarTotal: 20 });
    // Empatar puntúa más que perder, así que la banda de tablas no puede ser más baja.
    const orden: Record<string, number> = { principiante: 0, elemental: 1, intermedio: 2, avanzado: 3, experto: 4 };
    expect(orden[conTablas]).toBeGreaterThanOrEqual(orden[conDerrotas]);
  });
});
