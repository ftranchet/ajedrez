import type { SessionRecord } from '../../core/types';
import { abandonSessionRecord } from '../../core/session';
import { db } from './db';

export const sessionRepo = {
  async list(): Promise<SessionRecord[]> {
    return db.sessions.orderBy('fechaInicio').reverse().toArray();
  },
  async save(record: SessionRecord): Promise<void> {
    await db.sessions.put(record);
  },
  async abandonInProgress(exceptId?: string): Promise<void> {
    const records = await db.sessions.where('estado').equals('en_curso').toArray();
    const now = new Date();
    await Promise.all(
      records
        .filter((record) => record.id !== exceptId)
        .map((record) => db.sessions.put(abandonSessionRecord(record, now))),
    );
  },
};
