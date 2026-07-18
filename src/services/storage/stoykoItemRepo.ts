// Catálogo del ejercicio de Stoyko semanal (E7, RF-7.2). No es dato del
// usuario: se repuebla desde el dataset semilla verificado
// (scripts/mine-stoyko.mjs), por eso queda fuera de la exportación E14
// (services/export/exportImport.ts) — igual criterio que `curriculumItemRepo`.
import type { StoykoItem } from '../../core/types';
import { STOYKO_DATASET_VERSION, seedStoykoItems } from '../puzzles/stoykoSeedData';
import { db, type ElomaxDB } from './db';
import { ensureSeededCatalog } from './ensureSeededCatalog';

export interface StoykoItemRepo {
  list(): Promise<StoykoItem[]>;
  ensureSeeded(): Promise<void>;
}

export class DexieStoykoItemRepo implements StoykoItemRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<StoykoItem[]> {
    return this.database.stoykoItems.toArray();
  }

  async ensureSeeded(): Promise<void> {
    await ensureSeededCatalog({
      db: this.database,
      itemsTable: this.database.stoykoItems,
      metaTable: this.database.stoykoDatasetMeta,
      version: STOYKO_DATASET_VERSION,
      seedItems: seedStoykoItems,
    });
  }
}

export const stoykoItemRepo: StoykoItemRepo = new DexieStoykoItemRepo();
