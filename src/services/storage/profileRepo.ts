// Perfil del usuario (E11): banda de Elo y estado del diagnóstico inicial
// (RF-11.4). Es dato personal, se incluye en la exportación (RF-14.1).
import type { Profile } from '../../core/types';
import { DEFAULT_PROFILE } from '../../core/prescriptor';
import { normalizeWeeklyPlan } from '../../core/adherence';
import { db, type ElomaxDB } from './db';

export const PROFILE_ID = 'principal' as const;
export { DEFAULT_PROFILE };

export interface ProfileRepo {
  get(): Promise<Profile>;
  save(profile: Profile): Promise<void>;
}

export class DexieProfileRepo implements ProfileRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async get(): Promise<Profile> {
    const found = await this.database.profile.get(PROFILE_ID);
    if (!found) return { ...DEFAULT_PROFILE, planSemanal: { ...DEFAULT_PROFILE.planSemanal! } };
    return { ...found, planSemanal: normalizeWeeklyPlan(found.planSemanal) };
  }

  async save(profile: Profile): Promise<void> {
    await this.database.profile.put(profile);
  }
}

export const profileRepo: ProfileRepo = new DexieProfileRepo();
