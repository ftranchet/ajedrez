// Historial de Cálculo comprometido (E7, RF-7.1): línea completa declarada vs. la solución verificada.
import type { CompromisoAttempt } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface CompromisoAttemptRepo {
  list(): Promise<CompromisoAttempt[]>;
  save(attempt: CompromisoAttempt): Promise<void>;
}

export class DexieCompromisoAttemptRepo implements CompromisoAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<CompromisoAttempt[]> {
    return this.database.compromisoAttempts.orderBy('fecha').reverse().toArray();
  }

  async save(attempt: CompromisoAttempt): Promise<void> {
    await this.database.compromisoAttempts.put(attempt);
  }
}

export const compromisoAttemptRepo: CompromisoAttemptRepo = new DexieCompromisoAttemptRepo();
