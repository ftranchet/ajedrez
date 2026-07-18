import { describe, expect, it } from 'vitest';
import { stoykoAcierto, stoykoDisponible, stoykoProximaDisponibleEn } from './stoyko';
import type { StoykoItem } from './types';

function stoykoItem(mejorLinea: string[]): StoykoItem {
  return { id: 'stoyko-test', fen: 'startpos', mejorLinea, evaluacionMotor: '=', fuente: 'seed-dev' };
}

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
    const haceDosDias = new Date('2026-07-16T00:00:00.000Z').toISOString();
    expect(stoykoProximaDisponibleEn({ stoykoUltimaCompletadaEn: haceDosDias })).toBe('2026-07-23T00:00:00.000Z');
  });
});

describe('stoykoAcierto', () => {
  const item = stoykoItem(['e2e4', 'e7e5', 'g1f3']);

  it('acierta si alguna candidata coincide con la primera jugada de la línea del motor', () => {
    expect(stoykoAcierto(item, [{ jugada: 'd2d4', evaluacion: '=' }, { jugada: 'e2e4', evaluacion: '±' }])).toBe(true);
  });

  it('no importa el orden en que se anotaron las candidatas', () => {
    expect(stoykoAcierto(item, [{ jugada: 'e2e4', evaluacion: '±' }, { jugada: 'd2d4', evaluacion: '=' }])).toBe(true);
  });

  it('falla si ninguna candidata coincide', () => {
    expect(stoykoAcierto(item, [{ jugada: 'd2d4', evaluacion: '=' }, { jugada: 'c2c4', evaluacion: '=' }])).toBe(false);
  });

  it('falla si no se anotó ninguna candidata', () => {
    expect(stoykoAcierto(item, [])).toBe(false);
  });
});
