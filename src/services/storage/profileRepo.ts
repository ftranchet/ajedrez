// Perfil del usuario (E11): banda de Elo y estado del diagnóstico inicial
// (RF-11.4). Es dato personal, se incluye en la exportación (RF-14.1).
import type { Profile } from '../../core/types';
import { DEFAULT_PROFILE } from '../../core/prescriptor';
import { normalizeWeeklyPlan } from '../../core/adherence';
import { normalizeSensoryPreferences } from '../../core/sensory';
import { db, type ElomaxDB } from './db';

export const PROFILE_ID = 'principal' as const;
export { DEFAULT_PROFILE };

export interface ProfileRepo {
  get(): Promise<Profile>;
  save(profile: Profile): Promise<void>;
  update(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile>;
}

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    planSemanal: normalizeWeeklyPlan(profile.planSemanal),
    preferenciasSensoriales: normalizeSensoryPreferences(profile.preferenciasSensoriales),
  };
}

export class DexieProfileRepo implements ProfileRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async get(): Promise<Profile> {
    const found = await this.database.profile.get(PROFILE_ID);
    if (!found) {
      return normalizeProfile({
        ...DEFAULT_PROFILE,
        planSemanal: { ...DEFAULT_PROFILE.planSemanal! },
        preferenciasSensoriales: { ...DEFAULT_PROFILE.preferenciasSensoriales! },
      });
    }
    return normalizeProfile(found);
  }

  async save(profile: Profile): Promise<void> {
    await this.database.profile.put(profile);
  }

  /** Merge transaccional para que dos ajustes cercanos (plan, recordatorio o
   * feedback sensorial) no se pisen por haber partido de una copia vieja. */
  async update(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
    return this.database.transaction('rw', this.database.profile, async () => {
      const found = await this.database.profile.get(PROFILE_ID);
      const current = normalizeProfile(found ?? DEFAULT_PROFILE);
      const next = normalizeProfile({ ...current, ...patch, id: PROFILE_ID });
      await this.database.profile.put(next);
      return next;
    });
  }
}

export const profileRepo: ProfileRepo = new DexieProfileRepo();
