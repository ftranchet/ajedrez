import type { N1Experiment } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface N1ExperimentRepo {
  list(): Promise<N1Experiment[]>;
  save(experiment: N1Experiment): Promise<void>;
}

export class DexieN1ExperimentRepo implements N1ExperimentRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<N1Experiment[]> {
    return this.database.n1Experiments.orderBy('creadoEn').reverse().toArray();
  }

  async save(experiment: N1Experiment): Promise<void> {
    await this.database.n1Experiments.put(experiment);
  }
}

export const n1ExperimentRepo: N1ExperimentRepo = new DexieN1ExperimentRepo();
