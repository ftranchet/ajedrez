// Historial del Triage de reloj (E9, RF-9.2/9.3): decisión "¿pide cálculo o
// alcanza?", si fue correcta y cuánto tardó en decidir (la latencia es lo que
// el ejercicio entrena).
import type { TriageAttempt } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface TriageAttemptRepo {
  list(): Promise<TriageAttempt[]>;
  save(attempt: TriageAttempt): Promise<void>;
}

export class DexieTriageAttemptRepo implements TriageAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<TriageAttempt[]> {
    return this.database.triageAttempts.orderBy('fecha').reverse().toArray();
  }

  async save(attempt: TriageAttempt): Promise<void> {
    await this.database.triageAttempts.put(attempt);
  }
}

export const triageAttemptRepo: TriageAttemptRepo = new DexieTriageAttemptRepo();
