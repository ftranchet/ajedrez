import { describe, expect, it } from 'vitest';
import { esAptoParaCompromiso, evaluarLinea, itemsParaCompromiso } from './compromiso';
import type { RadarItem } from './types';

function item(solucion: string[]): RadarItem {
  return { id: crypto.randomUUID(), fen: 'startpos', tipo: 'ofensiva', temas: [], rating: 1500, solucion, fuente: 'seed-dev' };
}

describe('esAptoParaCompromiso', () => {
  it('rechaza líneas de menos de 3 plies', () => {
    expect(esAptoParaCompromiso(item(['e2e4']))).toBe(false);
    expect(esAptoParaCompromiso(item(['e2e4', 'e7e5']))).toBe(false);
  });

  it('acepta líneas de 3 a 7 plies', () => {
    expect(esAptoParaCompromiso(item(['e2e4', 'e7e5', 'g1f3']))).toBe(true);
    expect(esAptoParaCompromiso(item(new Array(7).fill('e2e4')))).toBe(true);
  });

  it('rechaza líneas de más de 7 plies', () => {
    expect(esAptoParaCompromiso(item(new Array(8).fill('e2e4')))).toBe(false);
  });
});

describe('itemsParaCompromiso', () => {
  it('filtra el pool a solo los ítems aptos', () => {
    const pool = [item(['e2e4']), item(['e2e4', 'e7e5', 'g1f3']), item(new Array(11).fill('e2e4'))];
    expect(itemsParaCompromiso(pool)).toHaveLength(1);
  });
});

describe('evaluarLinea', () => {
  const it3 = item(['e2e4', 'e7e5', 'g1f3']);

  it('correcta cuando toda la línea coincide', () => {
    expect(evaluarLinea(it3, ['e2e4', 'e7e5', 'g1f3'])).toEqual({ correcta: true, primerErrorEn: null });
  });

  it('marca el índice de la primera jugada que no coincide', () => {
    expect(evaluarLinea(it3, ['e2e4', 'd7d5', 'g1f3'])).toEqual({ correcta: false, primerErrorEn: 1 });
  });

  it('la primera jugada equivocada ya cuenta como incorrecta (se puntúa la línea entera, RF-7.1)', () => {
    expect(evaluarLinea(it3, ['a2a3', 'e7e5', 'g1f3'])).toEqual({ correcta: false, primerErrorEn: 0 });
  });

  it('una línea incompleta (faltan plies) cuenta como incorrecta en el primer faltante', () => {
    expect(evaluarLinea(it3, ['e2e4', 'e7e5'])).toEqual({ correcta: false, primerErrorEn: 2 });
  });
});
