import { describe, expect, it } from 'vitest';
import { clasificarRespuestaDobleSolucion, feedbackConformismo, tasaConformismo } from './dobleSolucion';
import type { RadarItem } from './types';

// Posición real (la misma de sessionStore.dobleSolucion.test.ts): d5c6 es
// Dxc6+ y f1b5 es Ab5. El feedback ahora reproduce la jugada sobre el tablero
// para escribirla en algebraica, así que un FEN de mentira ya no alcanza.
const item: RadarItem = {
  id: 'r1',
  fen: 'r3k2r/ppp2ppp/2b5/3QP3/4n2q/B1P3P1/P1P2P1P/R3KB1R w KQkq - 1 12',
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

// RNF-9: la jugada superior se nombra en algebraica del idioma elegido. Antes
// se imprimía `solucion[0]` tal cual, en UCI ("d5c6"), que no es notación de
// ajedrez sino el formato con el que se le habla al motor.
describe('feedbackConformismo', () => {
  it('en español nombra la jugada superior con D, nunca en UCI', () => {
    const texto = feedbackConformismo(item, 'es');
    expect(texto).toContain('había una superior: Dxc6+.');
    expect(texto).not.toContain('d5c6');
    expect(texto).not.toContain('Qxc6');
  });

  it('en inglés la nombra con Q, tampoco en UCI', () => {
    const texto = feedbackConformismo(item, 'en');
    expect(texto).toContain('había una superior: Qxc6+.');
    expect(texto).not.toContain('d5c6');
  });

  it('si la solución no se puede reproducir, omite la jugada antes que mostrar UCI', () => {
    for (const roto of [{ ...item, fen: 'startpos' }, { ...item, solucion: ['a1a8'] }]) {
      for (const idioma of ['es', 'en'] as const) {
        const texto = feedbackConformismo(roto, idioma);
        expect(texto).toContain('había una superior. No es un error');
        expect(texto).not.toMatch(/[a-h][1-8][a-h][1-8]/);
        expect(texto).not.toContain('undefined');
      }
    }
  });
});
