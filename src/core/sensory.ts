import type { SensoryPreferences } from './types';

/** El feedback sensorial nunca se activa por sorpresa. */
export const DEFAULT_SENSORY_PREFERENCES: SensoryPreferences = {
  sonido: false,
  vibracion: false,
};

/** Hace legibles los perfiles creados antes de esta preferencia. Un valor
 * ausente o incompleto no habilita ningún canal de forma implícita. */
export function normalizeSensoryPreferences(
  preferences: Partial<SensoryPreferences> | null | undefined,
): SensoryPreferences {
  return {
    sonido: preferences?.sonido === true,
    vibracion: preferences?.vibracion === true,
  };
}
