import { describe, expect, it } from 'vitest';
import type { CurriculumItem, CurriculumProgress } from './types';
import { dueCurriculumItems, esDemostracionLimpia, interleaveByPattern, isAutomatizado, newCurriculumProgress, nivelCiegas, reviewCurriculumProgress } from './curriculum';

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
  function progresoCon(reps: number, lapses: number, demostracionesLimpias: number): CurriculumProgress {
    return {
      id: 'p1',
      fsrs: {
        due: '2026-01-01T00:00:00.000Z',
        stability: 5,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps,
        lapses,
        learningSteps: 0,
        state: 'review',
        lastReview: '2026-01-01T00:00:00.000Z',
      },
      demostracionesLimpias,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  it('sin progreso, o con menos repeticiones que el mínimo, nivel normal', () => {
    expect(nivelCiegas(undefined)).toBe('normal');
    expect(nivelCiegas(progresoCon(2, 0, 2))).toBe('normal');
  });

  it('con acierto de 80% exacto o menos, nivel normal (el umbral es "más de 80%")', () => {
    expect(nivelCiegas(progresoCon(5, 1, 1))).toBe('normal'); // 4/5 = 80%
  });

  it('por encima de 80% de acierto, con pocas demostraciones limpias seguidas: piezas fantasma', () => {
    expect(nivelCiegas(progresoCon(6, 1, 1))).toBe('fantasma'); // 5/6 ≈ 83%
  });

  it('por encima de 80% de acierto, con 2+ demostraciones limpias seguidas (camino a automatizar): solo coordenadas', () => {
    expect(nivelCiegas(progresoCon(6, 1, 2))).toBe('coordenadas');
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
