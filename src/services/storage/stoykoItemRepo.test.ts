import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { STOYKO_DATASET_VERSION, seedStoykoItems } from '../puzzles/stoykoSeedData';
import { ElomaxDB } from './db';
import { DexieStoykoItemRepo } from './stoykoItemRepo';

describe('DexieStoykoItemRepo', () => {
  it('reemplaza un catálogo anterior por el lote versionado sin tocar datos personales', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieStoykoItemRepo(database);
    await database.stoykoItems.put({
      id: 'catalogo-viejo',
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      mejorLinea: ['a1a2'],
      evaluacionMotor: '=',
      fuente: 'seed-dev',
    });
    await database.stoykoDatasetMeta.put({ id: 'catalogo', version: 'vencido', seededAt: '2026-07-01T00:00:00.000Z' });

    await repo.ensureSeeded();

    expect(await database.stoykoItems.count()).toBe(seedStoykoItems.length);
    expect(await database.stoykoItems.get('catalogo-viejo')).toBeUndefined();
    expect(await database.stoykoDatasetMeta.get('catalogo')).toMatchObject({ version: STOYKO_DATASET_VERSION });
    database.close();
  });

  it('no reescribe el catálogo cuando ya está en la versión actual', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieStoykoItemRepo(database);
    await repo.ensureSeeded();
    const firstSeededAt = (await database.stoykoDatasetMeta.get('catalogo'))?.seededAt;

    await repo.ensureSeeded();

    expect((await database.stoykoDatasetMeta.get('catalogo'))?.seededAt).toBe(firstSeededAt);
    expect(await database.stoykoItems.count()).toBe(seedStoykoItems.length);
    database.close();
  });
});
