// Catálogo de posiciones del Radar (E5). No es "dato del usuario": se
// repuebla desde el dataset semilla o el pipeline de Lichess (ADR-0005), por
// eso queda fuera de la exportación E14 (services/export/exportImport.ts).
import type { RadarItem } from '../../core/types';
import { seedRadarItems } from '../puzzles/seedData';
import { db, type ElomaxDB } from './db';

export interface RadarItemRepo {
  list(): Promise<RadarItem[]>;
  ensureSeeded(): Promise<void>;
}

export class DexieRadarItemRepo implements RadarItemRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<RadarItem[]> {
    return this.database.radarItems.toArray();
  }

  async ensureSeeded(): Promise<void> {
    const count = await this.database.radarItems.count();
    if (count === 0) {
      await this.database.radarItems.bulkPut(seedRadarItems);
    }
  }
}

export const radarItemRepo: RadarItemRepo = new DexieRadarItemRepo();
