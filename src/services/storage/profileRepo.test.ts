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
    expect(await repo.get()).toEqual({ id: 'principal', bandaElo: 'avanzado', diagnosticoCompletadoEn: '2026-07-17T00:00:00.000Z' });
    database.close();
  });
});
