import { describe, expect, it } from 'vitest';
import { stoykoDisponible, stoykoProximaDisponibleEn } from './stoyko';

describe('stoykoDisponible', () => {
  it('disponible cuando nunca se hizo', () => {
    expect(stoykoDisponible({ stoykoUltimaCompletadaEn: null })).toBe(true);
    expect(stoykoDisponible({ stoykoUltimaCompletadaEn: undefined })).toBe(true);
  });

  it('no disponible dentro de los 7 días desde la última vez', () => {
    const ahora = new Date('2026-07-18T00:00:00.000Z');
    const haceDosDias = new Date('2026-07-16T00:00:00.000Z').toISOString();
    expect(stoykoDisponible({ stoykoUltimaCompletadaEn: haceDosDias }, ahora)).toBe(false);
  });

  it('disponible de nuevo pasados los 7 días', () => {
    const ahora = new Date('2026-07-18T00:00:00.000Z');
    const hace8Dias = new Date('2026-07-10T00:00:00.000Z').toISOString();
    expect(stoykoDisponible({ stoykoUltimaCompletadaEn: hace8Dias }, ahora)).toBe(true);
  });
});

describe('stoykoProximaDisponibleEn', () => {
  it('null cuando ya está disponible', () => {
    expect(stoykoProximaDisponibleEn({ stoykoUltimaCompletadaEn: null })).toBeNull();
  });

  it('calcula la fecha exacta 7 días después de la última vez', () => {
    const ahora = new Date('2026-07-18T00:00:00.000Z');
    const haceDosDias = new Date('2026-07-16T00:00:00.000Z').toISOString();
    expect(stoykoProximaDisponibleEn({ stoykoUltimaCompletadaEn: haceDosDias }, ahora)).toBe('2026-07-23T00:00:00.000Z');
  });
});

