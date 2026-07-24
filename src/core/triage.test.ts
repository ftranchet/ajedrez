import { describe, expect, it } from 'vitest';
import { decisionCorrecta, resumenCriterio } from './triage';
import type { TriageAttempt } from './types';

describe('decisionCorrecta', () => {
  it('ofensiva, defensa y envenenada exigen cálculo', () => {
    expect(decisionCorrecta('ofensiva')).toBe('calcular');
    expect(decisionCorrecta('defensa')).toBe('calcular');
    expect(decisionCorrecta('envenenada')).toBe('calcular');
  });

  it('tranquila y genuina alcanzan con una jugada sólida', () => {
    expect(decisionCorrecta('tranquila')).toBe('alcanza');
    expect(decisionCorrecta('genuina')).toBe('alcanza');
  });
});

function triageAttempt(overrides: Partial<TriageAttempt>): TriageAttempt {
  return {
    id: crypto.randomUUID(),
    itemId: 'r1',
    tipo: 'tranquila',
    decisionUsuario: 'alcanza',
    decisionCorrecta: 'alcanza',
    correcta: true,
    tiempoMs: 2000,
    fecha: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resumenCriterio', () => {
  const ahora = new Date('2026-07-22T00:00:00.000Z');

  it('sin ejercicios en la ventana, devuelve null', () => {
    expect(resumenCriterio([], ahora)).toBeNull();
    // Uno viejo (fuera de los 30 días) tampoco cuenta.
    expect(resumenCriterio([triageAttempt({ fecha: '2026-01-01T00:00:00.000Z' })], ahora)).toBeNull();
  });

  it('resume la precisión de los ejercicios de la ventana', () => {
    const dentro = [
      triageAttempt({ fecha: '2026-07-10T00:00:00.000Z', correcta: true }),
      triageAttempt({ fecha: '2026-07-11T00:00:00.000Z', correcta: false }),
      triageAttempt({ fecha: '2026-07-12T00:00:00.000Z', correcta: true }),
    ];
    const fuera = triageAttempt({ fecha: '2026-01-01T00:00:00.000Z', correcta: true });
    const resumen = resumenCriterio([...dentro, fuera], ahora);
    expect(resumen).not.toBeNull();
    expect(resumen?.total).toBe(3);
    expect(resumen?.correctos).toBe(2);
    expect(resumen?.precision).toBeCloseTo(2 / 3);
  });
});
