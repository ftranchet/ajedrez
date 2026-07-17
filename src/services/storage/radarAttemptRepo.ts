// Historial de respuestas del Radar para observar la tasa de acierto real
// por sesión y validar la banda adaptativa de RF-5.5.
import type { RadarAttempt } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface RadarAttemptRepo {
  list(): Promise<RadarAttempt[]>;
  save(attempt: RadarAttempt): Promise<void>;
}

export class DexieRadarAttemptRepo implements RadarAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<RadarAttempt[]> {
    return this.database.radarAttempts.orderBy('fecha').reverse().toArray();
  }

  async save(attempt: RadarAttempt): Promise<void> {
    await this.database.radarAttempts.put(attempt);
  }
}

export const radarAttemptRepo: RadarAttemptRepo = new DexieRadarAttemptRepo();
