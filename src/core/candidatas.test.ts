import { describe, expect, it } from 'vitest';
import { clasificarCambioCandidata, shouldSampleCandidata } from './candidatas';
import type { RadarItem } from './types';

const item: RadarItem = {
  id: 'r1',
  fen: 'startpos',
  tipo: 'ofensiva',
  temas: [],
  rating: 1500,
  solucion: ['e2e4'],
  fuente: 'seed-dev',
};

describe('shouldSampleCandidata', () => {
  it('respeta el umbral ~1 de cada 4-5 (RF-5.8, mismo muestreo que RF-10.1)', () => {
    expect(shouldSampleCandidata(() => 0)).toBe(true);
    expect(shouldSampleCandidata(() => 0.99)).toBe(false);
  });
});

describe('clasificarCambioCandidata', () => {
  it('mejoró: de incorrecta a correcta', () => {
    expect(clasificarCambioCandidata(item, 'a2a3', 'e2e4')).toBe('mejoro');
  });

  it('empeoró: de correcta a incorrecta', () => {
    expect(clasificarCambioCandidata(item, 'e2e4', 'a2a3')).toBe('empeoro');
  });

  it('sin cambio: ambas incorrectas, aunque la jugada haya cambiado', () => {
    expect(clasificarCambioCandidata(item, 'a2a3', 'b2b3')).toBe('sin-cambio');
  });

  it('sin cambio: no cambió la jugada (mantuvo la correcta)', () => {
    expect(clasificarCambioCandidata(item, 'e2e4', 'e2e4')).toBe('sin-cambio');
  });
});
