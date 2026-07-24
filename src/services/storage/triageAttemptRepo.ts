// Historial del ejercicio de criterio "¿Calcular o ya alcanza?" (E9, RF-9.2):
// la decisión "¿pide cálculo o alcanza?" y si fue correcta. (El identificador
// interno sigue siendo `triage` para no migrar los registros ya guardados.)
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
