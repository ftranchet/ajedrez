import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CURRICULUM_DATASET_VERSION, seedCurriculumItems } from '../puzzles/curriculumSeedData';
import { ElomaxDB } from './db';
import { DexieCurriculumItemRepo } from './curriculumItemRepo';

describe('DexieCurriculumItemRepo', () => {
  it('reemplaza un catálogo anterior por el lote versionado sin tocar datos personales', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieCurriculumItemRepo(database);
    await database.curriculumItems.put({
      id: 'catalogo-viejo',
      tipo: 'patron',
      patternKey: 'clavada',
      nombre: 'viejo',
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      solucion: ['a1a2'],
    });
    await database.curriculumDatasetMeta.put({ id: 'catalogo', version: 'vencido', seededAt: '2026-07-01T00:00:00.000Z' });

    await repo.ensureSeeded();

    expect(await database.curriculumItems.count()).toBe(seedCurriculumItems.length);
    expect(await database.curriculumItems.get('catalogo-viejo')).toBeUndefined();
    expect(await database.curriculumDatasetMeta.get('catalogo')).toMatchObject({ version: CURRICULUM_DATASET_VERSION });
    database.close();
  });

  it('no reescribe el catálogo cuando ya está en la versión actual', async () => {
    const database = new ElomaxDB(`elomax-test-${crypto.randomUUID()}`);
    const repo = new DexieCurriculumItemRepo(database);
    await repo.ensureSeeded();
    const firstSeededAt = (await database.curriculumDatasetMeta.get('catalogo'))?.seededAt;

    await repo.ensureSeeded();

    expect((await database.curriculumDatasetMeta.get('catalogo'))?.seededAt).toBe(firstSeededAt);
    expect(await database.curriculumItems.count()).toBe(seedCurriculumItems.length);
    database.close();
  });
});
