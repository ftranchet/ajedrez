import { describe, expect, it } from 'vitest';
import type { CurriculumItem, CurriculumProgress } from './types';
import { dueCurriculumItems, esDemostracionLimpia, finalesJugadosHoy, interleaveByPattern, isAutomatizado, newCurriculumProgress, nivelCiegas, reviewCurriculumProgress } from './curriculum';

function item(id: string, patternKey: CurriculumItem['patternKey'] = 'clavada'): CurriculumItem {
  return { id, tipo: 'patron', patternKey, nombre: id, fen: 'startpos', solucion: ['e2e4'] };
}

describe('newCurriculumProgress', () => {
  it('crea un progreso nuevo, disponible de inmediato y sin demostraciones', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const progress = newCurriculumProgress('p1', now);
    expect(progress.id).toBe('p1');
    expect(progress.demostracionesLimpias).toBe(0);
    expect(new Date(progress.fsrs.due).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});

describe('isAutomatizado', () => {
  it('es falso por debajo de 3 demostraciones limpias y verdadero desde 3', () => {
    const base = newCurriculumProgress('p1');
    expect(isAutomatizado({ ...base, demostracionesLimpias: 0 })).toBe(false);
    expect(isAutomatizado({ ...base, demostracionesLimpias: 2 })).toBe(false);
    expect(isAutomatizado({ ...base, demostracionesLimpias: 3 })).toBe(true);
    expect(isAutomatizado({ ...base, demostracionesLimpias: 4 })).toBe(true);
  });
});

describe('reviewCurriculumProgress', () => {
  it('una demostración limpia suma al contador y espacia la reaparición', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const before = newCurriculumProgress('p1', now);
    const after = reviewCurriculumProgress(before, true, now);
    expect(after.demostracionesLimpias).toBe(1);
    expect(new Date(after.fsrs.due).getTime()).toBeGreaterThan(now.getTime());
  });

  it('un fallo reinicia el contador a cero aunque venía de una racha', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const racha: CurriculumProgress = { ...newCurriculumProgress('p1', now), demostracionesLimpias: 2 };
    const after = reviewCurriculumProgress(racha, false, now);
    expect(after.demostracionesLimpias).toBe(0);
  });

  it('cuenta cada demostración en intentos y solo las limpias en aciertos', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const nuevo = newCurriculumProgress('p1', now);
    expect(nuevo.intentos).toBe(0);
    expect(nuevo.aciertos).toBe(0);
    const resultados = [true, false, true, true, false];
    const final = resultados.reduce((p, limpia) => reviewCurriculumProgress(p, limpia, now), nuevo);
    expect(final.intentos).toBe(5);
    expect(final.aciertos).toBe(3);
  });

  it('un registro anterior a los contadores empieza a contar desde la próxima demostración', () => {
    // No se reconstruye el pasado: FSRS no guarda qué repasos fallaron.
    const now = new Date('2026-01-01T00:00:00Z');
    const legado: CurriculumProgress = {
      id: 'p1',
      fsrs: { ...newCurriculumProgress('p1', now).fsrs, reps: 7, lapses: 1, state: 'review' },
      demostracionesLimpias: 1,
      updatedAt: now.toISOString(),
    };
    const fallo = reviewCurriculumProgress(legado, false, now);
    expect(fallo.intentos).toBe(1);
    expect(fallo.aciertos).toBe(0);
    const acierto = reviewCurriculumProgress(legado, true, now);
    expect(acierto.intentos).toBe(1);
    expect(acierto.aciertos).toBe(1);
  });
});

describe('dueCurriculumItems', () => {
  const now = new Date('2026-01-15T00:00:00Z');
  const nuncaVisto = item('nunca-visto');
  const vencidoNoAutomatizado = item('vencido');
  const automatizado = item('automatizado');
  const noVencidoTodavia = item('no-vencido');

  const progressById = new Map<string, CurriculumProgress>([
    ['vencido', { id: 'vencido', fsrs: { ...newCurriculumProgress('vencido', now).fsrs, due: '2026-01-01T00:00:00Z' }, demostracionesLimpias: 1, updatedAt: now.toISOString() }],
    ['automatizado', { id: 'automatizado', fsrs: { ...newCurriculumProgress('automatizado', now).fsrs, due: '2026-01-01T00:00:00Z' }, demostracionesLimpias: 3, updatedAt: now.toISOString() }],
    ['no-vencido', { id: 'no-vencido', fsrs: { ...newCurriculumProgress('no-vencido', now).fsrs, due: '2026-02-01T00:00:00Z' }, demostracionesLimpias: 1, updatedAt: now.toISOString() }],
  ]);

  it('incluye elementos nunca vistos', () => {
    const due = dueCurriculumItems([nuncaVisto], progressById, now);
    expect(due.map((i) => i.id)).toEqual(['nunca-visto']);
  });

  it('incluye vencidos no automatizados y excluye automatizados y no vencidos', () => {
    const due = dueCurriculumItems([vencidoNoAutomatizado, automatizado, noVencidoTodavia], progressById, now);
    expect(due.map((i) => i.id)).toEqual(['vencido']);
  });
});

describe('nivelCiegas', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  /** Registro con contadores propios; el FSRS es indistinto para el acierto. */
  function progresoCon(intentos: number, aciertos: number, demostracionesLimpias: number): CurriculumProgress {
    return {
      id: 'p1',
      fsrs: {
        due: '2026-01-01T00:00:00.000Z',
        stability: 5,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: intentos,
        lapses: 0,
        learningSteps: 0,
        state: 'review',
        lastReview: '2026-01-01T00:00:00.000Z',
      },
      demostracionesLimpias,
      intentos,
      aciertos,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  /** Demostraciones reales desde un patrón nuevo, con el FSRS de verdad. */
  function demostrar(resultados: boolean[]): CurriculumProgress {
    return resultados.reduce((p, limpia) => reviewCurriculumProgress(p, limpia, now), newCurriculumProgress('p1', now));
  }

  it('tres fallos seguidos desde un patrón nuevo no activan el modo a ciegas (B4)', () => {
    // ts-fsrs no cuenta lapsos mientras la tarjeta está aprendiendo: con el
    // cociente de FSRS esto daba "100% de acierto" y piezas fantasma.
    const progreso = demostrar([false, false, false]);
    expect(progreso.fsrs.reps).toBe(3);
    expect(progreso.fsrs.lapses).toBe(0);
    expect(nivelCiegas(progreso)).toBe('normal');
  });

  it('sin progreso, o con menos intentos que el mínimo, nivel normal', () => {
    expect(nivelCiegas(undefined)).toBe('normal');
    expect(nivelCiegas(progresoCon(2, 2, 2))).toBe('normal');
    expect(nivelCiegas(demostrar([true, true]))).toBe('normal');
  });

  it('3 de 3 limpias superan el umbral; el nivel depende de la racha, como siempre', () => {
    expect(nivelCiegas(demostrar([true, true, true]))).toBe('coordenadas'); // racha de 3
    expect(nivelCiegas(progresoCon(3, 3, 1))).toBe('fantasma');
  });

  it('con acierto de 80% exacto o menos, nivel normal (el umbral es "más de 80%")', () => {
    expect(nivelCiegas(demostrar([true, true, false, true, true]))).toBe('normal'); // 4/5 = 80%
    expect(nivelCiegas(progresoCon(5, 4, 1))).toBe('normal');
  });

  it('por encima de 80% de acierto, con pocas demostraciones limpias seguidas: piezas fantasma', () => {
    expect(nivelCiegas(progresoCon(6, 5, 1))).toBe('fantasma'); // 5/6 ≈ 83%
  });

  it('por encima de 80% de acierto, con 2+ demostraciones limpias seguidas (camino a automatizar): solo coordenadas', () => {
    expect(nivelCiegas(progresoCon(6, 5, 2))).toBe('coordenadas');
  });

  it('un registro anterior a los contadores queda en normal, aunque FSRS diga que acierta', () => {
    // Sin intentos medidos no hay acierto que creer: el modo a ciegas espera
    // a que se junten desde ahora, en vez de subir la dificultad a ciegas.
    const legado: CurriculumProgress = {
      id: 'p1',
      fsrs: progresoCon(10, 10, 2).fsrs, // reps 10, lapses 0: "100%" para FSRS
      demostracionesLimpias: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(nivelCiegas(legado)).toBe('normal');
  });
});

describe('esDemostracionLimpia', () => {
  // "Mate de dama y rey": Dg7#, Dg8#, Dh1# y Dh2# son todos mate en 1. La
  // solución registrada es g1g7, pero rechazar los otros mates sería un falso
  // error (bug reportado: "hay un ejercicio que está mal").
  const mateDamaRey = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1';

  it('acepta la jugada registrada', () => {
    expect(esDemostracionLimpia(mateDamaRey, 'g1g7', ['g1g7'])).toBe(true);
  });

  it('acepta cualquier otro mate legal cuando la solución canónica es mate', () => {
    expect(esDemostracionLimpia(mateDamaRey, 'g1g8', ['g1g7'])).toBe(true);
    expect(esDemostracionLimpia(mateDamaRey, 'g1h1', ['g1g7'])).toBe(true);
    expect(esDemostracionLimpia(mateDamaRey, 'g1h2', ['g1g7'])).toBe(true);
  });

  it('rechaza una jugada que no da mate en un patrón de mate', () => {
    expect(esDemostracionLimpia(mateDamaRey, 'g1a1', ['g1g7'])).toBe(false);
  });

  it('en un motivo táctico (no mate) exige la jugada registrada, sin colar otro jaque', () => {
    // Rayos X: Re1+ es el skewer; Ra5+ es otro jaque legal pero no demuestra
    // el motivo (no gana la dama), así que no debe contar como limpia.
    const rayosX = '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1';
    expect(esDemostracionLimpia(rayosX, 'a1e1', ['a1e1'])).toBe(true);
    expect(esDemostracionLimpia(rayosX, 'a1a5', ['a1e1'])).toBe(false);
  });

  it('acepta cualquiera de las jugadas registradas cuando hay varias', () => {
    const inicial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(esDemostracionLimpia(inicial, 'b1c3', ['g1f3', 'b1c3'])).toBe(true);
    expect(esDemostracionLimpia(inicial, 'e2e4', ['g1f3', 'b1c3'])).toBe(false);
  });
});

describe('interleaveByPattern', () => {
  it('nunca sirve el mismo patrón dos veces seguidas cuando es evitable', () => {
    const items = [
      ...['a1', 'a2', 'a3'].map((id) => item(id, 'clavada')),
      ...['b1', 'b2', 'b3'].map((id) => item(id, 'horquilla')),
      ...['c1', 'c2', 'c3'].map((id) => item(id, 'descubierta')),
    ];
    const result = interleaveByPattern(items);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].patternKey).not.toBe(result[i - 1].patternKey);
    }
  });

  it('conserva todos los elementos, sin duplicar ni perder ninguno', () => {
    const items = [item('a1', 'clavada'), item('a2', 'clavada'), item('b1', 'horquilla')];
    const result = interleaveByPattern(items);
    expect(result.map((i) => i.id).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('no cuelga con un solo patrón', () => {
    const items = [item('a1', 'clavada'), item('a2', 'clavada')];
    const result = interleaveByPattern(items);
    expect(result.map((i) => i.id).sort()).toEqual(['a1', 'a2']);
  });

  it('lista vacía devuelve lista vacía', () => {
    expect(interleaveByPattern([])).toEqual([]);
  });
});

describe('finalesJugadosHoy', () => {
  const now = new Date(2026, 6, 22, 18, 0);
  const finales: CurriculumItem[] = [
    { id: 'f1', tipo: 'final', patternKey: 'final-torre', nombre: 'Torre', fen: 'x', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w' },
    { id: 'f2', tipo: 'final', patternKey: 'final-dama', nombre: 'Dama', fen: 'x', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w' },
  ];
  const progreso = (id: string, fecha: Date): CurriculumProgress => ({
    ...newCurriculumProgress(id, fecha),
    updatedAt: fecha.toISOString(),
  });

  it('cuenta los finales cuyo progreso se movió hoy, no los de ayer', () => {
    const progressById = new Map([
      ['f1', progreso('f1', new Date(2026, 6, 22, 9))],
      ['f2', progreso('f2', new Date(2026, 6, 21, 23))],
    ]);
    expect(finalesJugadosHoy(finales, progressById, now)).toBe(1);
  });

  it('ignora los patrones: la prescripción que mide es la de finales', () => {
    const progressById = new Map([['p1', progreso('p1', new Date(2026, 6, 22, 9))]]);
    expect(finalesJugadosHoy([...finales, item('p1')], progressById, now)).toBe(0);
  });

  it('un final nunca jugado no cuenta', () => {
    expect(finalesJugadosHoy(finales, new Map(), now)).toBe(0);
  });
});
