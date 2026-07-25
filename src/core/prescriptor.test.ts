import { describe, expect, it } from 'vitest';
import { detectarFugaCalculo, detectarFugaTactica, dietaPorBanda, estimarBandaElo } from './prescriptor';
import type { ErrorCard, RadarAttempt, RadarItem } from './types';

function cardTactica(creadaEn: string, origen: ErrorCard['origen'] = 'partida'): ErrorCard {
  return {
    id: crypto.randomUUID(),
    fen: 'startpos',
    ladoAMover: 'w',
    jugadaUsuario: 'a2a3',
    jugadaCorrecta: 'e2e4',
    categoria: 'tactico',
    origen,
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

function cardPosicional(creadaEn: string, origen: ErrorCard['origen'] = 'partida'): ErrorCard {
  return { ...cardTactica(creadaEn, origen), categoria: 'posicional' };
}

describe('detectarFugaTactica', () => {
  const ahora = new Date('2026-07-17T00:00:00.000Z');

  it('sin tarjetas recientes, no detecta fuga', () => {
    expect(detectarFugaTactica([], ahora)).toEqual({ categoria: null, proporcion: 0 });
  });

  it('detecta fuga táctica cuando superan el 35% de lo reciente (tarjetas de partida)', () => {
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

  it('ignora tarjetas de origen Radar: casi todo fallo del Radar es "táctico" por construcción (categoriaFromTipo), y contarlas retroalimentaría el ajuste sobre sí mismo', () => {
    const cardsSoloRadar = [
      cardTactica('2026-07-10', 'radar'),
      cardTactica('2026-07-11', 'radar'),
      cardTactica('2026-07-12', 'radar'),
      cardTactica('2026-07-13', 'radar'),
    ];
    expect(detectarFugaTactica(cardsSoloRadar, ahora)).toEqual({ categoria: null, proporcion: 0 });
  });

  it('una mayoría táctica de origen Radar no enmascara una fuga real de partida: solo cuentan las de partida', () => {
    const cards = [
      cardTactica('2026-07-10', 'radar'),
      cardTactica('2026-07-11', 'radar'),
      cardTactica('2026-07-12', 'radar'),
      cardPosicional('2026-07-13', 'partida'),
      cardPosicional('2026-07-14', 'partida'),
    ];
    // 0 de 2 tarjetas de partida son tácticas: sin fuga, pese a que la
    // mayoría absoluta de las tarjetas recientes (las del Radar) sí lo sean.
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
    const dieta = dietaPorBanda('intermedio', cards, ahora);
    expect(dieta.radarCount).toBe(10); // 8 base + 2 de bonus
    expect(dieta.ajusteFugas.categoria).toBe('tactico');
  });

  it('cada banda tiene su propia dieta base', () => {
    expect(dietaPorBanda('principiante', []).curriculumMax).toBe(6);
    expect(dietaPorBanda('experto', []).curriculumMax).toBe(2);
  });

  it('sin fuga táctica, criterioActivo es falso', () => {
    expect(dietaPorBanda('intermedio', []).criterioActivo).toBe(false);
  });

  it('activa el bloque de criterio ("¿Calcular o ya alcanza?") ante fuga táctica de partidas (RF-9.2/11.2)', () => {
    // Ahora el disparador es honesto: los errores reales de partida, no un
    // "perfil de tiempo" medido con un cronómetro invisible (que se quitó).
    const ahora = new Date('2026-07-17T00:00:00.000Z');
    const cards = [cardTactica('2026-07-10'), cardTactica('2026-07-11'), cardPosicional('2026-07-12')];
    const dieta = dietaPorBanda('intermedio', cards, ahora);
    expect(dieta.criterioActivo).toBe(true);
    expect(dieta.ajusteFugas.categoria).toBe('tactico');
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

describe('detectarFugaCalculo (E7 → RF-7.1)', () => {
  function item(id: string, plies: number): RadarItem {
    return {
      id,
      fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
      tipo: 'ofensiva',
      temas: [],
      rating: 1500,
      solucion: Array.from({ length: plies }, () => 'a1a2'),
      fuente: 'lichess-cc0',
    };
  }
  function attempt(itemId: string, acierto: boolean, overrides: Partial<RadarAttempt> = {}): RadarAttempt {
    return {
      id: crypto.randomUUID(),
      itemId,
      tipo: 'ofensiva',
      rating: 1500,
      acierto,
      origenContenido: 'catalogo',
      fecha: new Date('2026-07-20T10:00:00.000Z').toISOString(),
      ...overrides,
    };
  }
  const ahora = new Date('2026-07-25T10:00:00.000Z');
  // Cuatro de línea forzada, una de jugada suelta.
  const pool = [item('linea-1', 5), item('linea-2', 3), item('linea-3', 4), item('linea-4', 7), item('suelta', 1)];

  it('sin intentos suficientes no afirma nada', () => {
    const attempts = [attempt('linea-1', false), attempt('linea-2', false)];
    expect(detectarFugaCalculo(attempts, pool, ahora).activa).toBe(false);
  });

  it('fallar seguido las líneas forzadas dispara la fuga', () => {
    const attempts = [
      ...Array.from({ length: 5 }, () => attempt('linea-1', false)),
      ...Array.from({ length: 3 }, () => attempt('linea-2', true)),
    ];
    const fuga = detectarFugaCalculo(attempts, pool, ahora);
    expect(fuga.activa).toBe(true);
    expect(fuga.fallos).toBe(5);
    expect(fuga.total).toBe(8);
  });

  it('acertarlas no la dispara', () => {
    const attempts = Array.from({ length: 8 }, () => attempt('linea-3', true));
    expect(detectarFugaCalculo(attempts, pool, ahora).activa).toBe(false);
  });

  it('las posiciones de una sola jugada no cuentan: no miden cálculo de línea', () => {
    const attempts = Array.from({ length: 10 }, () => attempt('suelta', false));
    expect(detectarFugaCalculo(attempts, pool, ahora)).toMatchObject({ activa: false, total: 0 });
  });

  it('excluye diagnóstico y errores propios: no tienen dificultad comparable', () => {
    const attempts = [
      ...Array.from({ length: 5 }, () => attempt('linea-1', false, { origenContenido: 'diagnostico' })),
      ...Array.from({ length: 5 }, () => attempt('linea-2', false, { origenContenido: 'error-propio' })),
    ];
    expect(detectarFugaCalculo(attempts, pool, ahora)).toMatchObject({ activa: false, total: 0 });
  });

  it('una fuga vieja ya corregida deja de prescribir', () => {
    const viejos = Array.from({ length: 10 }, () =>
      attempt('linea-1', false, { fecha: new Date('2026-05-01T10:00:00.000Z').toISOString() }),
    );
    expect(detectarFugaCalculo(viejos, pool, ahora).activa).toBe(false);
  });
});
