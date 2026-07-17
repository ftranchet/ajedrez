// Catálogo de posiciones del Radar (E5). No es "dato del usuario": se
// repuebla desde el dataset semilla o el pipeline de Lichess (ADR-0005), por
// eso queda fuera de la exportación E14 (services/export/exportImport.ts).
import type { RadarDatasetMeta, RadarItem } from '../../core/types';
import { RADAR_DATASET_VERSION, seedRadarItems } from '../puzzles/seedData';
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
    const meta = await this.database.radarDatasetMeta.get('catalogo');
    if (count > 0 && meta?.version === RADAR_DATASET_VERSION) return;

    // El catálogo no contiene datos personales: sustituirlo evita mezclar
    // lotes distintos y deja que una actualización de contenido llegue a
    // instalaciones existentes sin alterar las tarjetas FSRS del usuario.
    const nextMeta: RadarDatasetMeta = {
      id: 'catalogo',
      version: RADAR_DATASET_VERSION,
      seededAt: new Date().toISOString(),
    };
    await this.database.transaction('rw', this.database.radarItems, this.database.radarDatasetMeta, async () => {
      await this.database.radarItems.clear();
      await this.database.radarItems.bulkPut(seedRadarItems);
      await this.database.radarDatasetMeta.put(nextMeta);
    });
  }
}

export const radarItemRepo: RadarItemRepo = new DexieRadarItemRepo();
