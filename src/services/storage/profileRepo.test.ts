import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ElomaxDB } from './db';
import { DEFAULT_PROFILE, DexieProfileRepo } from './profileRepo';

describe('DexieProfileRepo', () => {
  it('sin perfil guardado, devuelve el perfil por defecto sin diagnosticar', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieProfileRepo(database);
    expect(await repo.get()).toEqual(DEFAULT_PROFILE);
    database.close();
  });

  it('guarda y devuelve el perfil actualizado tras el diagnóstico', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieProfileRepo(database);
    await repo.save({ id: 'principal', bandaElo: 'avanzado', diagnosticoCompletadoEn: '2026-07-17T00:00:00.000Z' });
    expect(await repo.get()).toEqual({
      id: 'principal',
      bandaElo: 'avanzado',
      diagnosticoCompletadoEn: '2026-07-17T00:00:00.000Z',
      planSemanal: DEFAULT_PROFILE.planSemanal,
      preferenciasSensoriales: { sonido: false, vibracion: false },
    });
    database.close();
  });

  it('conserva un plan semanal personalizado', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieProfileRepo(database);
    await repo.save({
      id: 'principal',
      bandaElo: 'elemental',
      diagnosticoCompletadoEn: null,
      planSemanal: { sesionesObjetivo: 4, minutosObjetivo: 120 },
    });
    expect((await repo.get()).planSemanal).toEqual({ sesionesObjetivo: 4, minutosObjetivo: 120 });
    database.close();
  });

  it('normaliza preferencias sensoriales históricas como apagadas', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieProfileRepo(database);
    await repo.save({ id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: null });
    expect((await repo.get()).preferenciasSensoriales).toEqual({ sonido: false, vibracion: false });
    database.close();
  });

  it('actualiza preferencias sin pisar un plan guardado', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieProfileRepo(database);
    await repo.save({
      id: 'principal',
      bandaElo: 'elemental',
      diagnosticoCompletadoEn: null,
      planSemanal: { sesionesObjetivo: 4, minutosObjetivo: 120 },
    });
    const updated = await repo.update({ preferenciasSensoriales: { sonido: true, vibracion: false } });
    expect(updated.planSemanal).toEqual({ sesionesObjetivo: 4, minutosObjetivo: 120 });
    expect(updated.preferenciasSensoriales).toEqual({ sonido: true, vibracion: false });
    database.close();
  });

  it('serializa ajustes concurrentes sin perder plan, recordatorio ni preferencias', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieProfileRepo(database);

    await Promise.all([
      repo.update({ planSemanal: { sesionesObjetivo: 4, minutosObjetivo: 120 } }),
      repo.update({ recordatorio: { activo: true, hora: '19:30' } }),
      repo.update({ preferenciasSensoriales: { sonido: true, vibracion: false } }),
    ]);

    await expect(repo.get()).resolves.toMatchObject({
      planSemanal: { sesionesObjetivo: 4, minutosObjetivo: 120 },
      recordatorio: { activo: true, hora: '19:30' },
      preferenciasSensoriales: { sonido: true, vibracion: false },
    });
    database.close();
  });
});
