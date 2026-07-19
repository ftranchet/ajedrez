import { describe, expect, it } from 'vitest';
import {
  abandonSessionRecord,
  activitySummary,
  completeSessionRecord,
  recordSessionItem,
  processStreak,
  startSessionRecord,
  transitionSessionBlock,
} from './session';

const START = new Date('2026-07-19T10:00:00.000Z');

describe('registro de sesión', () => {
  it('crea solo bloques con trabajo y deja el primero en curso', () => {
    const record = startSessionRecord(
      [
        { tipo: 'cola', planificados: 0 },
        { tipo: 'curriculo', planificados: 3 },
        { tipo: 'radar', planificados: 8 },
      ],
      START,
      's1',
    );
    expect(record.bloques.map((b) => [b.tipo, b.estado])).toEqual([
      ['curriculo', 'en_curso'],
      ['radar', 'pendiente'],
    ]);
  });

  it('registra ítems, transiciones y duración de una sesión completa', () => {
    let record = startSessionRecord(
      [
        { tipo: 'cola', planificados: 1 },
        { tipo: 'radar', planificados: 2 },
      ],
      START,
      's2',
    );
    record = recordSessionItem(record, 'cola');
    record = transitionSessionBlock(record, 'cola', 'radar', new Date('2026-07-19T10:02:00.000Z'));
    record = recordSessionItem(record, 'radar');
    record = recordSessionItem(record, 'radar');
    record = completeSessionRecord(record, new Date('2026-07-19T10:10:00.000Z'));

    expect(record.estado).toBe('completada');
    expect(record.duracionMs).toBe(10 * 60_000);
    expect(record.bloques.map((b) => [b.tipo, b.completados, b.estado])).toEqual([
      ['cola', 1, 'completado'],
      ['radar', 2, 'completado'],
    ]);
  });

  it('marca abandonada una sesión anterior sin convertirla en adherencia', () => {
    const abandoned = abandonSessionRecord(
      startSessionRecord([{ tipo: 'radar', planificados: 8 }], START, 's3'),
      new Date('2026-07-19T10:03:00.000Z'),
    );
    expect(abandoned.estado).toBe('abandonada');
    expect(activitySummary([abandoned], new Date('2026-07-19T12:00:00.000Z'))).toEqual({
      sesiones: 0,
      minutos: 0,
      items: 0,
      racha: 0,
    });
  });

  it('resume actividad de los últimos 30 días sin premiar volumen viejo', () => {
    const reciente = completeSessionRecord(
      recordSessionItem(startSessionRecord([{ tipo: 'radar', planificados: 2 }], START, 's4'), 'radar'),
      new Date('2026-07-19T10:15:00.000Z'),
    );
    const vieja = completeSessionRecord(
      startSessionRecord([{ tipo: 'radar', planificados: 2 }], new Date('2026-05-01T10:00:00.000Z'), 's5'),
      new Date('2026-05-01T10:20:00.000Z'),
    );
    expect(activitySummary([reciente, vieja], new Date('2026-07-19T12:00:00.000Z'))).toEqual({
      sesiones: 1,
      minutos: 15,
      items: 1,
      racha: 1,
    });
  });

  it('cuenta días consecutivos de sesiones completas, no volumen ni abandonos (RF-13.1)', () => {
    const completed = (id: string, day: number) => completeSessionRecord(
      startSessionRecord([{ tipo: 'radar', planificados: 1 }], new Date(`2026-07-${day}T10:00:00.000Z`), id),
      new Date(`2026-07-${day}T10:10:00.000Z`),
    );
    const records = [
      completed('hoy-1', 19),
      completed('hoy-2', 19), // dos sesiones el mismo día siguen valiendo un día
      completed('ayer', 18),
      completed('anteayer', 17),
      completed('corte', 15),
      abandonSessionRecord(startSessionRecord([{ tipo: 'radar', planificados: 1 }], new Date('2026-07-16T10:00:00.000Z'), 'abandonada')),
    ];
    expect(processStreak(records, new Date('2026-07-19T20:00:00.000Z'))).toBe(3);
  });

  it('conserva la racha de ayer durante hoy, pero no una racha ya cortada', () => {
    const yesterday = completeSessionRecord(
      startSessionRecord([{ tipo: 'radar', planificados: 1 }], new Date('2026-07-18T10:00:00.000Z'), 'ayer'),
      new Date('2026-07-18T10:10:00.000Z'),
    );
    expect(processStreak([yesterday], new Date('2026-07-19T08:00:00.000Z'))).toBe(1);
    expect(processStreak([yesterday], new Date('2026-07-20T08:00:00.000Z'))).toBe(0);
  });
});
