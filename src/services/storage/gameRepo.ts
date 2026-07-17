import type { GameRepo } from '../../core/ports';
import type { GameRecord } from '../../core/types';
import { db, type ElomaxDB } from './db';

export class DexieGameRepo implements GameRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async save(game: GameRecord): Promise<void> {
    await this.database.games.put(game);
  }

  async list(): Promise<GameRecord[]> {
    return this.database.games.orderBy('fecha').reverse().toArray();
  }
}

export const gameRepo: GameRepo = new DexieGameRepo();
