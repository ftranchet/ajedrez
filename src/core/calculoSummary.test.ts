import { describe, expect, it } from 'vitest';
import { resumenAbierto, resumenForzado } from './calculoSummary';
import type { CalculoAttempt } from './types';

function forzado(correcta: boolean): CalculoAttempt {
  return {
    id: crypto.randomUUID(),
    preset: 'forzado',
    itemId: 'c',
    ramas: [{ linea: ['d5c6', 'b7c6', 'd1f3'] }],
    correcta,
    primerErrorEn: correcta ? null : 1,
    fecha: '2026-07-20T00:00:00.000Z',
  };
}

function abierto(overrides: Partial<CalculoAttempt> = {}): CalculoAttempt {
  return {
    id: crypto.randomUUID(),
    preset: 'abierto',
    itemId: 's',
    ramas: [{ linea: ['d5c6'], evaluacion: '±' }],
    cobertura: true,
    profundidadVista: 1,
    brechaEvaluacion: 0,
    confianzaDeclarada: 50,
    tiempoMs: 1000,
    fecha: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('resumenForzado (RF-7.1)', () => {
  it('null sin intentos del preset', () => {
    expect(resumenForzado([])).toBeNull();
    expect(resumenForzado([abierto()])).toBeNull();
  });

  it('cuenta líneas correctas y precisión, ignorando el otro preset', () => {
    const resumen = resumenForzado([forzado(true), forzado(false), forzado(true), forzado(true), abierto()]);
    expect(resumen).toEqual({ total: 4, correctas: 3, precision: 0.75 });
  });
});

describe('resumenAbierto (RF-7.2)', () => {
  it('null sin intentos del preset', () => {
    expect(resumenAbierto([])).toBeNull();
    expect(resumenAbierto([forzado(true)])).toBeNull();
  });

  it('toma el intento más reciente por fecha y no mezcla presets', () => {
    const resumen = resumenAbierto([
      abierto({ fecha: '2026-07-01T00:00:00.000Z', cobertura: false }),
      abierto({ fecha: '2026-07-15T00:00:00.000Z', cobertura: true, profundidadVista: 3, brechaEvaluacion: 1 }),
      abierto({ fecha: '2026-07-10T00:00:00.000Z', cobertura: false }),
      forzado(true),
    ]);
    expect(resumen).toMatchObject({
      fecha: '2026-07-15T00:00:00.000Z',
      total: 3,
      cobertura: true,
      profundidadVista: 3,
      brechaEvaluacion: 1,
    });
  });

  it('expone el tiempo de la última toma (RF-7.3): el preset abierto mide profundidad', () => {
    const resumen = resumenAbierto([
      abierto({ fecha: '2026-07-01T00:00:00.000Z', tiempoMs: 60_000 }),
      abierto({ fecha: '2026-07-15T00:00:00.000Z', tiempoMs: 720_000 }),
    ]);
    expect(resumen?.tiempoMsUltima).toBe(720_000);
  });

  it('tolera tomas sin tiempo válido, anteriores a que se registrara', () => {
    expect(resumenAbierto([abierto({ tiempoMs: undefined })])?.tiempoMsUltima).toBeNull();
    expect(resumenAbierto([abierto({ tiempoMs: -5 })])?.tiempoMsUltima).toBeNull();
  });

  // La brecha es la señal de si el juicio se calibra, y es lo único de este
  // ejercicio que antes se recogía y se descartaba (ADR-0015).
  it('promedia la brecha de evaluación solo sobre las tomas que la tienen medida', () => {
    const resumen = resumenAbierto([
      abierto({ fecha: '2026-07-01T00:00:00.000Z', brechaEvaluacion: 2 }),
      abierto({ fecha: '2026-07-08T00:00:00.000Z', brechaEvaluacion: null }), // convertida del formato viejo
      abierto({ fecha: '2026-07-15T00:00:00.000Z', brechaEvaluacion: 0 }),
    ]);
    expect(resumen?.brechaMedia).toBe(1);
    expect(resumen?.brechaEvaluacion).toBe(0);
  });

  it('sin ninguna brecha medida no inventa un promedio', () => {
    expect(resumenAbierto([abierto({ brechaEvaluacion: null })])?.brechaMedia).toBeNull();
  });
});
