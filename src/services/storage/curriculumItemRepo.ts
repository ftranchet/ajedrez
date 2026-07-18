// Catálogo del currículo base (E6). No es dato del usuario: se repuebla
// desde el dataset semilla verificado (scripts/verify-curriculum-patrones.mjs),
// por eso queda fuera de la exportación E14 (services/export/exportImport.ts)
// — el progreso del usuario sobre cada elemento vive en `curriculumProgressRepo`.
import type { CurriculumItem } from '../../core/types';
import { CURRICULUM_DATASET_VERSION, seedCurriculumItems } from '../puzzles/curriculumSeedData';
import { db, type ElomaxDB } from './db';
import { ensureSeededCatalog } from './ensureSeededCatalog';

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
    await ensureSeededCatalog({
      db: this.database,
      itemsTable: this.database.curriculumItems,
      metaTable: this.database.curriculumDatasetMeta,
      version: CURRICULUM_DATASET_VERSION,
      seedItems: seedCurriculumItems,
    });
  }
}

export const curriculumItemRepo: CurriculumItemRepo = new DexieCurriculumItemRepo();
