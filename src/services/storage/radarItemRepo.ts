// Catálogo de posiciones del Radar (E5). No es "dato del usuario": se
// repuebla desde el dataset semilla o el pipeline de Lichess (ADR-0005), por
// eso queda fuera de la exportación E14 (services/export/exportImport.ts).
import type { RadarItem } from '../../core/types';
import { RADAR_DATASET_VERSION, seedRadarItems } from '../puzzles/seedData';
import { db, type ElomaxDB } from './db';
import { ensureSeededCatalog } from './ensureSeededCatalog';

export interface RadarItemRepo {
  list(): Promise<RadarItem[]>;
  ensureSeeded(): Promise<void>;
}

export class DexieRadarItemRepo implements RadarItemRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<RadarItem[]> {
    return this.database.radarItems.toArray();
  }

  // El catálogo no contiene datos personales: sustituirlo evita mezclar
  // lotes distintos y deja que una actualización de contenido llegue a
  // instalaciones existentes sin alterar las tarjetas FSRS del usuario.
  async ensureSeeded(): Promise<void> {
    await ensureSeededCatalog({
      db: this.database,
      itemsTable: this.database.radarItems,
      metaTable: this.database.radarDatasetMeta,
      version: RADAR_DATASET_VERSION,
      seedItems: seedRadarItems,
    });
  }
}

export const radarItemRepo: RadarItemRepo = new DexieRadarItemRepo();
