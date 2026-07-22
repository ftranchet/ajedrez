import { describe, expect, it } from 'vitest';
import { DEFAULT_SENSORY_PREFERENCES, normalizeSensoryPreferences } from './sensory';

describe('normalizeSensoryPreferences', () => {
  it('mantiene ambos canales apagados para perfiles históricos', () => {
    expect(normalizeSensoryPreferences(undefined)).toEqual(DEFAULT_SENSORY_PREFERENCES);
    expect(normalizeSensoryPreferences(null)).toEqual(DEFAULT_SENSORY_PREFERENCES);
  });

  it('normaliza cada canal de forma independiente sin activarlo implícitamente', () => {
    expect(normalizeSensoryPreferences({ sonido: true })).toEqual({ sonido: true, vibracion: false });
    expect(normalizeSensoryPreferences({ vibracion: true })).toEqual({ sonido: false, vibracion: true });
  });
});
