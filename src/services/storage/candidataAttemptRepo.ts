// Historial de la regla de candidatas (RF-5.8): si el usuario cambió su
// jugada tras "¿hay algo mejor?" y si ese cambio mejoró o empeoró.
import type { CandidataAttempt } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface CandidataAttemptRepo {
  list(): Promise<CandidataAttempt[]>;
  save(attempt: CandidataAttempt): Promise<void>;
}

export class DexieCandidataAttemptRepo implements CandidataAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<CandidataAttempt[]> {
    return this.database.candidataAttempts.orderBy('fecha').reverse().toArray();
  }

  async save(attempt: CandidataAttempt): Promise<void> {
    await this.database.candidataAttempts.put(attempt);
  }
}

export const candidataAttemptRepo: CandidataAttemptRepo = new DexieCandidataAttemptRepo();
