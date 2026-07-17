import type { CalibrationRecord } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface CalibrationRepo {
  save(record: CalibrationRecord): Promise<void>;
  list(): Promise<CalibrationRecord[]>;
}

export class DexieCalibrationRepo implements CalibrationRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async save(record: CalibrationRecord): Promise<void> {
    await this.database.calibrationRecords.put(record);
  }

  async list(): Promise<CalibrationRecord[]> {
    return this.database.calibrationRecords.toArray();
  }
}

export const calibrationRepo: CalibrationRepo = new DexieCalibrationRepo();
