import type { DailyAssignment } from '../../core/types';
import { db } from './db';

export const dailyAssignmentRepo = {
  async get(id: string): Promise<DailyAssignment | undefined> {
    return db.dailyAssignments.get(id);
  },
  async save(assignment: DailyAssignment): Promise<void> {
    await db.dailyAssignments.put(assignment);
  },
  async list(): Promise<DailyAssignment[]> {
    return db.dailyAssignments.orderBy('creadoEn').toArray();
  },
};
