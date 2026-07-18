// Historial del ejercicio de Stoyko (E7, RF-7.2/7.3): candidatas anotadas con
// su evaluación, acierto, tiempo (cronómetro silencioso) y confianza declarada.
import type { StoykoAttempt } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface StoykoAttemptRepo {
  list(): Promise<StoykoAttempt[]>;
  save(attempt: StoykoAttempt): Promise<void>;
}

export class DexieStoykoAttemptRepo implements StoykoAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<StoykoAttempt[]> {
    return this.database.stoykoAttempts.orderBy('fecha').reverse().toArray();
  }

  async save(attempt: StoykoAttempt): Promise<void> {
    await this.database.stoykoAttempts.put(attempt);
  }
}

export const stoykoAttemptRepo: StoykoAttemptRepo = new DexieStoykoAttemptRepo();
