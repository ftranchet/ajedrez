import { describe, expect, it } from 'vitest';
import { priorizarFinales } from './finalesPrioridad';
import type { CurriculumItem, CurriculumProgress, PatternKey, TrainingEvent } from './types';

const AHORA = new Date('2026-08-04T12:00:00.000Z');

function final(id: string, patternKey: PatternKey): CurriculumItem {
  return { id, tipo: 'final', patternKey, nombre: id, fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1', solucion: [] };
}

function progreso(
  id: string,
  over: { reps: number; limpias: number; due: string; lapses?: number },
): CurriculumProgress {
  return {
    id,
    demostracionesLimpias: over.limpias,
    updatedAt: '2026-08-01T00:00:00.000Z',
    fsrs: {
      due: over.due,
      stability: 5,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: over.reps,
      lapses: over.lapses ?? 0,
      learningSteps: 0,
      state: 'review',
      lastReview: '2026-08-01T00:00:00.000Z',
    },
  };
}

/** Un tramo medido de un final: el refId es `itemId:inicio`. */
function tramo(itemId: string, segundos: number, n = 1): TrainingEvent {
  return {
    id: `final:${itemId}:${n}`,
    modalidad: 'final',
    fecha: '2026-08-03T10:00:00.000Z',
    ms: segundos * 1000,
    refId: `${itemId}:${n}`,
  };
}

const CATALOGO = [
  final('torre-1', 'final-torre'),
  final('dama-1', 'final-dama'),
  final('lucena-1', 'final-lucena'),
];

const FUTURO = '2027-01-01T00:00:00.000Z';

describe('priorizarFinales', () => {
  it('devuelve todos los finales: ordena, no filtra', () => {
    // El usuario puede jugar el que quiera; la lista solo sugiere por dónde
    // empezar. Esconder sería decidir por él.
    const orden = priorizarFinales(CATALOGO, new Map(), { ahora: AHORA });
    expect(orden).toHaveLength(3);
  });

  it('lo que aparece en tus partidas manda sobre lo demás', () => {
    // Los tres están al día y demostrados sin fallos; solo uno se le presentó
    // de verdad sobre el tablero.
    const progressById = new Map(
      CATALOGO.map((item) => [item.id, progreso(item.id, { reps: 4, limpias: 2, due: FUTURO })] as const),
    );
    const orden = priorizarFinales(CATALOGO, progressById, {
      partidasPorPatron: new Map<PatternKey, number>([['final-lucena', 3]]),
      ahora: AHORA,
    });
    expect(orden[0]!.item.id).toBe('lucena-1');
    expect(orden[0]!.motivo).toBe('aparece-en-tus-partidas');
    expect(orden[0]!.señales.partidas).toBe(3);
  });

  it('entre dos igual de presentes, primero el que te sale peor', () => {
    const progressById = new Map([
      ['torre-1', progreso('torre-1', { reps: 4, limpias: 0, due: FUTURO, lapses: 2 })],
      ['dama-1', progreso('dama-1', { reps: 4, limpias: 2, due: FUTURO })],
    ]);
    const orden = priorizarFinales(CATALOGO.slice(0, 2), progressById, { ahora: AHORA });
    expect(orden[0]!.item.id).toBe('torre-1');
    expect(orden[0]!.motivo).toBe('te-sale-mal');
    expect(orden[0]!.señales.tasaFallo).toBeCloseTo(0.5);
  });

  it('"la última se te escapó" no se deduce de una racha mal leída', () => {
    // `demostracionesLimpias` es una racha que vuelve a cero con cada fallo, no
    // un contador de aciertos: leerla como tasa mostraría un porcentaje falso.
    // Cero con demostraciones hechas significa exactamente que la última falló.
    const recienFallado = new Map([['torre-1', progreso('torre-1', { reps: 6, limpias: 0, due: FUTURO, lapses: 1 })]]);
    const [torre] = priorizarFinales([CATALOGO[0]!], recienFallado, { ahora: AHORA });
    expect(torre!.señales.ultimaFallada).toBe(true);
    expect(torre!.señales.tasaFallo).toBeCloseTo(1 / 6);

    const enRacha = new Map([['torre-1', progreso('torre-1', { reps: 6, limpias: 2, due: FUTURO, lapses: 1 })]]);
    const [enRachaTorre] = priorizarFinales([CATALOGO[0]!], enRacha, { ahora: AHORA });
    expect(enRachaTorre!.señales.ultimaFallada).toBe(false);
    expect(enRachaTorre!.señales.rachaLimpia).toBe(2);
  });

  it('lo nunca practicado pesa más que lo ya trabajado', () => {
    const progressById = new Map([['torre-1', progreso('torre-1', { reps: 5, limpias: 2, due: FUTURO })]]);
    const orden = priorizarFinales(CATALOGO.slice(0, 2), progressById, { ahora: AHORA });
    expect(orden[0]!.item.id).toBe('dama-1');
    expect(orden[0]!.señales.practicas).toBe(0);
  });

  it('tardar el doble que en tus otros finales sube la prioridad', () => {
    // Misma tasa de acierto y misma antigüedad: lo único que los distingue es
    // el tiempo. Sale peor el lento, aunque termine resolviéndolo.
    const progressById = new Map([
      ['torre-1', progreso('torre-1', { reps: 4, limpias: 2, due: FUTURO })],
      ['dama-1', progreso('dama-1', { reps: 4, limpias: 2, due: FUTURO })],
    ]);
    const orden = priorizarFinales(CATALOGO.slice(0, 2), progressById, {
      eventos: [tramo('torre-1', 240), tramo('dama-1', 60), tramo('dama-1', 60, 2)],
      ahora: AHORA,
    });
    expect(orden[0]!.item.id).toBe('torre-1');
    expect(orden[0]!.motivo).toBe('tardas-mucho');
    expect(orden[0]!.señales.segundosTipicos).toBe(240);
    expect(orden[0]!.señales.lentitudRelativa).toBeGreaterThan(1);
  });

  it('el tiempo se compara contra vos mismo, no contra un número inventado', () => {
    // Un solo final medido: no hay con qué compararlo, así que no dispara
    // "tardás mucho" por más segundos que haya tardado.
    const progressById = new Map([['torre-1', progreso('torre-1', { reps: 4, limpias: 2, due: FUTURO })]]);
    const [torre] = priorizarFinales([CATALOGO[0]!], progressById, {
      eventos: [tramo('torre-1', 600)],
      ahora: AHORA,
    });
    expect(torre!.señales.lentitudRelativa).toBe(1);
    expect(torre!.motivo).not.toBe('tardas-mucho');
  });

  it('un final automatizado baja al fondo pero sigue estando', () => {
    const progressById = new Map([['torre-1', progreso('torre-1', { reps: 6, limpias: 3, due: FUTURO })]]);
    const orden = priorizarFinales(CATALOGO, progressById, { ahora: AHORA });
    expect(orden.at(-1)!.item.id).toBe('torre-1');
    expect(orden.at(-1)!.motivo).toBe('automatizado');
    expect(orden.map((f) => f.item.id)).toContain('torre-1');
  });

  it('sin ningún dato ordena por el catálogo, que va de lo elemental a lo avanzado', () => {
    // Primer día: todos vencidos y sin practicar, así que empatan. El desempate
    // estable evita que la lista se mueva sola entre visitas.
    const orden = priorizarFinales(CATALOGO, new Map(), { ahora: AHORA });
    expect(orden.map((f) => f.item.id)).toEqual(['torre-1', 'dama-1', 'lucena-1']);
    expect(orden.every((f) => f.señales.vencido)).toBe(true);
  });

  it('ignora los patrones: solo prioriza finales', () => {
    const conPatron = [...CATALOGO, { ...final('patron-1', 'clavada'), tipo: 'patron' as const }];
    expect(priorizarFinales(conPatron, new Map(), { ahora: AHORA })).toHaveLength(3);
  });

  it('un tramo de otra modalidad no cuenta como tiempo de final', () => {
    const [torre] = priorizarFinales([CATALOGO[0]!], new Map(), {
      eventos: [{ id: 'sesion:x', modalidad: 'sesion', fecha: '2026-08-03T10:00:00.000Z', ms: 900_000, refId: 'x' }],
      ahora: AHORA,
    });
    expect(torre!.señales.segundosTipicos).toBeNull();
  });
});
