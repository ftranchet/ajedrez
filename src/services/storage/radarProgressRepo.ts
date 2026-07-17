// Persistencia del progreso adaptativo del Radar (RF-5.5). Es dato del
// usuario, a diferencia del catálogo de posiciones, y debe sobrevivir a una
// recarga, una actualización y una exportación.
import type { RadarProgress } from '../../core/types';
import { db, type ElomaxDB } from './db';

export const RADAR_PROGRESS_ID = 'principal' as const;

export interface RadarProgressRepo {
  get(): Promise<RadarProgress | undefined>;
  list(): Promise<RadarProgress[]>;
  save(progress: RadarProgress): Promise<void>;
}

export class DexieRadarProgressRepo implements RadarProgressRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async get(): Promise<RadarProgress | undefined> {
    return this.database.radarProgress.get(RADAR_PROGRESS_ID);
  }

  async list(): Promise<RadarProgress[]> {
    return this.database.radarProgress.toArray();
  }

  async save(progress: RadarProgress): Promise<void> {
    await this.database.radarProgress.put(progress);
  }
}

export const radarProgressRepo: RadarProgressRepo = new DexieRadarProgressRepo();
