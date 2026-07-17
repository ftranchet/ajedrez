// Catálogo del currículo base (E6). No es dato del usuario: se repuebla
// desde el dataset semilla verificado (scripts/verify-curriculum-patrones.mjs),
// por eso queda fuera de la exportación E14 (services/export/exportImport.ts)
// — el progreso del usuario sobre cada elemento vive en `curriculumProgressRepo`.
import type { CurriculumDatasetMeta, CurriculumItem } from '../../core/types';
import { CURRICULUM_DATASET_VERSION, seedCurriculumItems } from '../puzzles/curriculumSeedData';
import { db, type ElomaxDB } from './db';

export interface CurriculumItemRepo {
  list(): Promise<CurriculumItem[]>;
  ensureSeeded(): Promise<void>;
}

export class DexieCurriculumItemRepo implements CurriculumItemRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<CurriculumItem[]> {
    return this.database.curriculumItems.toArray();
  }

  async ensureSeeded(): Promise<void> {
    const count = await this.database.curriculumItems.count();
    const meta = await this.database.curriculumDatasetMeta.get('catalogo');
    if (count > 0 && meta?.version === CURRICULUM_DATASET_VERSION) return;

    const nextMeta: CurriculumDatasetMeta = {
      id: 'catalogo',
      version: CURRICULUM_DATASET_VERSION,
      seededAt: new Date().toISOString(),
    };
    await this.database.transaction('rw', this.database.curriculumItems, this.database.curriculumDatasetMeta, async () => {
      await this.database.curriculumItems.clear();
      await this.database.curriculumItems.bulkPut(seedCurriculumItems);
      await this.database.curriculumDatasetMeta.put(nextMeta);
    });
  }
}

export const curriculumItemRepo: CurriculumItemRepo = new DexieCurriculumItemRepo();
