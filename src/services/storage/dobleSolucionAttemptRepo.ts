// Historial de respuestas sobre ítems de doble solución (E5, RF-5.7), para medir la tasa de conformismo.
import type { DobleSolucionAttempt } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface DobleSolucionAttemptRepo {
  list(): Promise<DobleSolucionAttempt[]>;
  save(attempt: DobleSolucionAttempt): Promise<void>;
}

export class DexieDobleSolucionAttemptRepo implements DobleSolucionAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<DobleSolucionAttempt[]> {
    return this.database.dobleSolucionAttempts.orderBy('fecha').reverse().toArray();
  }

  async save(attempt: DobleSolucionAttempt): Promise<void> {
    await this.database.dobleSolucionAttempts.put(attempt);
  }
}

export const dobleSolucionAttemptRepo: DobleSolucionAttemptRepo = new DexieDobleSolucionAttemptRepo();
