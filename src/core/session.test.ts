import { describe, expect, it } from 'vitest';
import {
  abandonSessionRecord,
  activitySummary,
  bloquesHechosHoy,
  cerrarSesionColgada,
  completeSessionRecord,
  recordSessionItem,
  processStreak,
  startSessionRecord,
  transitionSessionBlock,
  ultimoInstanteObservado,
} from './session';
import type { SessionRecord } from './types';

const START = new Date('2026-07-19T10:00:00.000Z');

describe('bloquesHechosHoy', () => {
  const ahora = new Date('2026-07-22T20:00:00.000Z');
  function sesion(overrides: Partial<SessionRecord>): SessionRecord {
    return {
      id: crypto.randomUUID(),
      fechaInicio: '2026-07-22T10:00:00.000Z',
      estado: 'abandonada',
      bloques: [],
      ...overrides,
    };
  }

  it('marca los bloques completados hoy, aunque la sesión se haya abandonado', () => {
    const record = sesion({
      bloques: [
        { tipo: 'cola', planificados: 2, completados: 2, estado: 'completado' },
        { tipo: 'curriculo', planificados: 5, completados: 2, estado: 'en_curso' }, // parcial: no cuenta
      ],
    });
    const hechos = bloquesHechosHoy([record], ahora);
    expect(hechos.has('cola')).toBe(true);
    expect(hechos.has('curriculo')).toBe(false);
  });

  it('ignora sesiones de otros días', () => {
    const ayer = sesion({
      fechaInicio: '2026-07-21T10:00:00.000Z',
      bloques: [{ tipo: 'radar', planificados: 8, completados: 8, estado: 'completado' }],
    });
    expect(bloquesHechosHoy([ayer], ahora).size).toBe(0);
  });
});

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

  it('una sesión abandonada no es adherencia, pero su trabajo sí es actividad', () => {
    // `sesiones` y la racha son adherencia y no las mueve un abandono. Los
    // minutos y las respuestas describen actividad: descartarlos borraba
    // trabajo que de verdad ocurrió y quedó registrado en los bloques.
    const abandoned = recordSessionItem(
      abandonSessionRecord(
        startSessionRecord([{ tipo: 'radar', planificados: 8 }], START, 's3'),
        new Date('2026-07-19T10:03:00.000Z'),
      ),
      'radar',
    );
    expect(abandoned.estado).toBe('abandonada');
    expect(activitySummary([abandoned], new Date('2026-07-19T12:00:00.000Z'))).toEqual({
      sesiones: 0,
      minutos: 3,
      items: 1,
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

describe('cerrarSesionColgada', () => {
  // Una sesión que la app no llegó a cerrar —recarga, pestaña cerrada, el
  // service worker tomando control a mitad de camino— quedaba `en_curso` para
  // siempre y **sin duración**, así que sus minutos no contaban en ninguna
  // lectura de carga: el plan semanal informaba 3 minutos de media hora
  // entrenada (reporte de uso 2026-08-04).
  const colgada: SessionRecord = {
    id: 'colgada',
    fechaInicio: '2026-08-03T10:00:00.000Z',
    estado: 'en_curso',
    bloques: [
      { tipo: 'cola', planificados: 10, completados: 10, estado: 'completado', inicio: '2026-08-03T10:00:00.000Z', fin: '2026-08-03T10:22:00.000Z' },
      { tipo: 'radar', planificados: 8, completados: 3, estado: 'en_curso', inicio: '2026-08-03T10:22:00.000Z' },
    ],
  };

  it('la cierra con la duración hasta el último instante registrado', () => {
    const cerrada = cerrarSesionColgada(colgada);
    expect(cerrada.estado).toBe('abandonada');
    // 10:00 → 10:22, el último instante del que hay registro. No hasta "ahora":
    // una sesión colgada el lunes no puede sumar los días que estuvo abierta.
    expect(cerrada.duracionMs).toBe(22 * 60_000);
    expect(cerrada.fechaFin).toBe('2026-08-03T10:22:00.000Z');
  });

  it('sin ninguna marca de bloque no inventa duración', () => {
    const reciennacida: SessionRecord = { ...colgada, bloques: [{ tipo: 'radar', planificados: 8, completados: 0, estado: 'pendiente' }] };
    expect(cerrarSesionColgada(reciennacida).duracionMs).toBe(0);
  });

  it('no toca una sesión ya cerrada', () => {
    const completa: SessionRecord = { ...colgada, estado: 'completada', fechaFin: '2026-08-03T11:00:00.000Z', duracionMs: 3_600_000 };
    expect(cerrarSesionColgada(completa)).toBe(completa);
  });

  it('el último instante es el más reciente, sin depender del orden de los bloques', () => {
    const desordenada: SessionRecord = { ...colgada, bloques: [...colgada.bloques].reverse() };
    expect(ultimoInstanteObservado(desordenada)).toBe('2026-08-03T10:22:00.000Z');
  });
});
