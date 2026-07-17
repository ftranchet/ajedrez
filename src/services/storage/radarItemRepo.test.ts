import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { RADAR_DATASET_VERSION, seedRadarItems } from '../puzzles/seedData';
import { ElomaxDB } from './db';
import { DexieRadarItemRepo } from './radarItemRepo';

describe('DexieRadarItemRepo', () => {
  it('reemplaza un catálogo anterior por el lote versionado sin tocar datos personales', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieRadarItemRepo(database);
    await database.radarItems.put({
      id: 'catalogo-viejo',
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      tipo: 'ofensiva',
      temas: [],
      rating: 900,
      solucion: ['a1a2'],
      fuente: 'seed-dev',
    });
    await database.radarDatasetMeta.put({ id: 'catalogo', version: 'vencido', seededAt: '2026-07-01T00:00:00.000Z' });

    await repo.ensureSeeded();

    expect(await database.radarItems.count()).toBe(seedRadarItems.length);
    expect(await database.radarItems.get('catalogo-viejo')).toBeUndefined();
    expect(await database.radarDatasetMeta.get('catalogo')).toMatchObject({ version: RADAR_DATASET_VERSION });
    database.close();
  });

  it('no reescribe el catálogo cuando ya está en la versión actual', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieRadarItemRepo(database);
    await repo.ensureSeeded();
    const firstSeededAt = (await database.radarDatasetMeta.get('catalogo'))?.seededAt;

    await repo.ensureSeeded();

    expect((await database.radarDatasetMeta.get('catalogo'))?.seededAt).toBe(firstSeededAt);
    expect(await database.radarItems.count()).toBe(seedRadarItems.length);
    database.close();
  });
});
