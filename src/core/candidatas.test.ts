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

describe('clasificarCambioCandidata sobre un ítem de doble solución (RF-5.7)', () => {
  // Mismo criterio de acierto que la resolución del Radar: la familiar
  // también es acierto, así que cambiar entre familiar y superior no es
  // "mejorar" ni "empeorar" — y abandonar la familiar por otra cosa sí empeora.
  const itemDS: RadarItem = { ...item, dobleSolucion: { familiar: 'd2d4' } };

  it('de familiar a superior: sin cambio (ambas son acierto)', () => {
    expect(clasificarCambioCandidata(itemDS, 'd2d4', 'e2e4')).toBe('sin-cambio');
  });

  it('de familiar a otra jugada: empeoró (abandonó un acierto)', () => {
    expect(clasificarCambioCandidata(itemDS, 'd2d4', 'a2a3')).toBe('empeoro');
  });

  it('de otra jugada a familiar: mejoró (llegó a un acierto)', () => {
    expect(clasificarCambioCandidata(itemDS, 'a2a3', 'd2d4')).toBe('mejoro');
  });
});
