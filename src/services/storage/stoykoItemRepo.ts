// Catálogo del ejercicio de Stoyko semanal (E7, RF-7.2). No es dato del
// usuario: se repuebla desde el dataset semilla verificado
// (scripts/mine-stoyko.mjs), por eso queda fuera de la exportación E14
// (services/export/exportImport.ts) — igual criterio que `curriculumItemRepo`.
import type { StoykoDatasetMeta, StoykoItem } from '../../core/types';
import { STOYKO_DATASET_VERSION, seedStoykoItems } from '../puzzles/stoykoSeedData';
import { db, type ElomaxDB } from './db';

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
    const count = await this.database.stoykoItems.count();
    const meta = await this.database.stoykoDatasetMeta.get('catalogo');
    if (count > 0 && meta?.version === STOYKO_DATASET_VERSION) return;

    const nextMeta: StoykoDatasetMeta = {
      id: 'catalogo',
      version: STOYKO_DATASET_VERSION,
      seededAt: new Date().toISOString(),
    };
    await this.database.transaction('rw', this.database.stoykoItems, this.database.stoykoDatasetMeta, async () => {
      await this.database.stoykoItems.clear();
      await this.database.stoykoItems.bulkPut(seedStoykoItems);
      await this.database.stoykoDatasetMeta.put(nextMeta);
    });
  }
}

export const stoykoItemRepo: StoykoItemRepo = new DexieStoykoItemRepo();
