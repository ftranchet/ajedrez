import { describe, expect, it } from 'vitest';
import { clasificarRespuestaDobleSolucion, feedbackConformismo, tasaConformismo } from './dobleSolucion';
import type { RadarItem } from './types';

const item: RadarItem = {
  id: 'r1',
  fen: 'startpos',
  tipo: 'ofensiva',
  temas: [],
  rating: 1500,
  solucion: ['d5c6'],
  fuente: 'pipeline-doble-solucion',
  dobleSolucion: { familiar: 'f1b5' },
};

describe('clasificarRespuestaDobleSolucion', () => {
  it('la jugada superior clasifica como "superior"', () => {
    expect(clasificarRespuestaDobleSolucion(item, 'd5c6')).toBe('superior');
  });

  it('la jugada familiar clasifica como "familiar"', () => {
    expect(clasificarRespuestaDobleSolucion(item, 'f1b5')).toBe('familiar');
  });

  it('cualquier otra jugada clasifica como "otra" (fallo genuino)', () => {
    expect(clasificarRespuestaDobleSolucion(item, 'a2a3')).toBe('otra');
  });

  it('sin dobleSolucion en el ítem, nunca clasifica como "familiar"', () => {
    const sinDS: RadarItem = { ...item, dobleSolucion: undefined };
    expect(clasificarRespuestaDobleSolucion(sinDS, 'f1b5')).toBe('otra');
  });
});

describe('tasaConformismo', () => {
  it('sin respuestas relevantes, null', () => {
    expect(tasaConformismo([])).toBeNull();
    expect(tasaConformismo(['otra', 'otra'])).toBeNull();
  });

  it('proporción de "familiar" sobre superior+familiar, ignorando "otra"', () => {
    expect(tasaConformismo(['superior', 'familiar', 'familiar', 'otra'])).toBeCloseTo(2 / 3);
  });

  it('nunca se conformó: 0', () => {
    expect(tasaConformismo(['superior', 'superior'])).toBe(0);
  });

  it('siempre se conformó: 1', () => {
    expect(tasaConformismo(['familiar', 'familiar'])).toBe(1);
  });
});

describe('feedbackConformismo', () => {
  it('menciona la jugada superior', () => {
    expect(feedbackConformismo(item)).toContain('d5c6');
  });
});
