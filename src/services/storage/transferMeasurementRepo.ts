import type { TransferMeasurement } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface TransferMeasurementRepo {
  save(measurement: TransferMeasurement): Promise<void>;
  list(): Promise<TransferMeasurement[]>;
}

export class DexieTransferMeasurementRepo implements TransferMeasurementRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async save(measurement: TransferMeasurement): Promise<void> {
    await this.database.transferMeasurements.put(measurement);
  }

  async list(): Promise<TransferMeasurement[]> {
    return this.database.transferMeasurements.orderBy('startedAt').reverse().toArray();
  }
}

export const transferMeasurementRepo: TransferMeasurementRepo = new DexieTransferMeasurementRepo();
