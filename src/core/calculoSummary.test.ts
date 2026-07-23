import { describe, expect, it } from 'vitest';
import { resumenCompromiso, resumenStoyko } from './calculoSummary';
import type { CompromisoAttempt, StoykoAttempt } from './types';

function comp(correcta: boolean): CompromisoAttempt {
  return { id: crypto.randomUUID(), itemId: 'c', profundidad: 5, correcta, primerErrorEn: correcta ? null : 1, fecha: '2026-07-20T00:00:00.000Z' };
}
function stk(acierto: boolean, fecha: string): StoykoAttempt {
  return { id: crypto.randomUUID(), itemId: 's', candidatas: [], acierto, confianzaDeclarada: 50, tiempoMs: 1000, fecha };
}

describe('resumenCompromiso', () => {
  it('null sin intentos', () => {
    expect(resumenCompromiso([])).toBeNull();
  });
  it('cuenta líneas correctas y precisión', () => {
    const r = resumenCompromiso([comp(true), comp(false), comp(true), comp(true)]);
    expect(r).toEqual({ total: 4, correctas: 3, precision: 0.75 });
  });
});

describe('resumenStoyko', () => {
  it('null sin intentos', () => {
    expect(resumenStoyko([])).toBeNull();
  });
  it('toma el intento más reciente por fecha', () => {
    const r = resumenStoyko([
      stk(false, '2026-07-01T00:00:00.000Z'),
      stk(true, '2026-07-15T00:00:00.000Z'),
      stk(false, '2026-07-10T00:00:00.000Z'),
    ]);
    expect(r).toEqual({ fecha: '2026-07-15T00:00:00.000Z', acierto: true, total: 3 });
  });
});
