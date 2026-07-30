// Historial del ejercicio de cálculo declarado (E7, ADR-0015): un solo formato
// para los dos presets, forzado y abierto. Reemplaza a `compromisoAttemptRepo`
// y `stoykoAttemptRepo`, que quedan solo para leer lo ya guardado (la migración
// v18 convierte sus registros a esta tabla).
import type { CalculoAttempt, PresetCalculoPersistido } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface CalculoAttemptRepo {
  list(): Promise<CalculoAttempt[]>;
  listPreset(preset: PresetCalculoPersistido): Promise<CalculoAttempt[]>;
  save(attempt: CalculoAttempt): Promise<void>;
}

export class DexieCalculoAttemptRepo implements CalculoAttemptRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<CalculoAttempt[]> {
    return this.database.calculoAttempts.orderBy('fecha').reverse().toArray();
  }

  async listPreset(preset: PresetCalculoPersistido): Promise<CalculoAttempt[]> {
    const todos = await this.list();
    return todos.filter((attempt) => attempt.preset === preset);
  }

  async save(attempt: CalculoAttempt): Promise<void> {
    await this.database.calculoAttempts.put(attempt);
  }
}

export const calculoAttemptRepo: CalculoAttemptRepo = new DexieCalculoAttemptRepo();
