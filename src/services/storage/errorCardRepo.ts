import type { ErrorCard } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface ErrorCardRepo {
  save(card: ErrorCard): Promise<void>;
  list(): Promise<ErrorCard[]>;
}

export class DexieErrorCardRepo implements ErrorCardRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async save(card: ErrorCard): Promise<void> {
    await this.database.errorCards.put(card);
  }

  async list(): Promise<ErrorCard[]> {
    return this.database.errorCards.toArray();
  }
}

export const errorCardRepo: ErrorCardRepo = new DexieErrorCardRepo();
