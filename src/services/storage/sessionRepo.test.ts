import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionRecord } from '../../core/types';
import { db } from './db';
import { sessionRepo } from './sessionRepo';

const iso = (hora: number, minuto = 0) => new Date(2026, 6, 17, hora, minuto).toISOString();

// Una sesión que se cortó a mitad del Radar: la última marca es el arranque de
// ese bloque, a las 10:22.
function colgada(id: string): SessionRecord {
  return {
    id,
    fechaInicio: iso(10),
    estado: 'en_curso',
    bloques: [
      { tipo: 'cola', planificados: 10, completados: 10, estado: 'completado', inicio: iso(10), fin: iso(10, 22) },
      { tipo: 'radar', planificados: 8, completados: 3, estado: 'en_curso', inicio: iso(10, 22) },
    ],
  };
}

beforeEach(async () => {
  await db.sessions.clear();
  await db.trainingEvents.clear();
});

describe('sessionRepo.abandonInProgress', () => {
  it('cierra la sesión colgada en su último instante observado y anota su tramo (B16)', async () => {
    await db.sessions.put(colgada('ayer'));

    await sessionRepo.abandonInProgress();

    const cerrada = await db.sessions.get('ayer');
    expect(cerrada?.estado).toBe('abandonada');
    // Hasta las 10:22, no hasta el momento de empezar la sesión nueva: con la
    // hora actual sumaba todo el tiempo que estuvo colgada.
    expect(cerrada?.fechaFin).toBe(iso(10, 22));
    expect(cerrada?.duracionMs).toBe(22 * 60_000);
    expect(await db.trainingEvents.toArray()).toEqual([
      { id: 'sesion:ayer', modalidad: 'sesion', fecha: iso(10, 22), ms: 22 * 60_000, refId: 'ayer' },
    ]);
  });

  it('respeta la excepción y no toca las sesiones ya cerradas', async () => {
    const completada: SessionRecord = { ...colgada('completada'), estado: 'completada', fechaFin: iso(11), duracionMs: 3_600_000 };
    await db.sessions.bulkPut([colgada('activa'), completada]);

    await sessionRepo.abandonInProgress('activa');

    expect(await db.sessions.get('activa')).toEqual(colgada('activa'));
    expect(await db.sessions.get('completada')).toEqual(completada);
    expect(await db.trainingEvents.count()).toBe(0);
  });

  it('sin ninguna marca de bloque la cierra sin inventar minutos', async () => {
    const reciennacida: SessionRecord = {
      ...colgada('vacia'),
      bloques: [{ tipo: 'radar', planificados: 8, completados: 0, estado: 'pendiente' }],
    };
    await db.sessions.put(reciennacida);

    await sessionRepo.abandonInProgress();

    expect(await db.sessions.get('vacia')).toMatchObject({ estado: 'abandonada', duracionMs: 0, fechaFin: iso(10) });
    expect(await db.trainingEvents.count()).toBe(0);
  });
});
