import { describe, expect, it, vi } from 'vitest';
import type { TransferMeasurement } from './types';
import {
  addTransferResponse,
  startTransferMeasurement,
  transferAvailability,
  transferDelta,
  transferResults,
} from './transfer';

const finished = (id: string, date: string, correctness: boolean[]): TransferMeasurement => ({
  id,
  datasetVersion: 'transfer-v1',
  startedAt: date,
  completedAt: date,
  responses: correctness.map((correct, index) => ({
    itemId: `item-${index}`,
    move: 'e2e4',
    correct,
    tiempoMs: 1000,
    fecha: date,
  })),
});

describe('batería de transferencia', () => {
  it('está disponible al principio y vuelve a ofrecerse a las siete semanas', () => {
    expect(transferAvailability([], new Date('2026-01-01'))).toEqual({ status: 'available' });
    const measurement = finished('m1', '2026-01-01T00:00:00.000Z', [true]);
    expect(transferAvailability([measurement], new Date('2026-02-18T23:59:59.000Z')).status).toBe('scheduled');
    expect(transferAvailability([measurement], new Date('2026-02-19T00:00:00.000Z'))).toEqual({ status: 'available' });
  });

  it('prioriza reanudar una toma incompleta', () => {
    const current = { ...finished('m2', '2026-01-02T00:00:00.000Z', []), completedAt: null };
    expect(transferAvailability([finished('m1', '2026-01-01T00:00:00.000Z', [true]), current])).toEqual({
      status: 'in-progress',
      measurement: current,
    });
  });

  it('persiste respuestas únicas y completa solo al llegar al total', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'measurement-1' });
    const start = startTransferMeasurement('transfer-v1', new Date('2026-01-01T00:00:00.000Z'));
    const response = { itemId: 'a', move: 'e2e4', correct: true, tiempoMs: 3000, fecha: '2026-01-01T00:01:00.000Z' };
    const one = addTransferResponse(start, response, 2, new Date('2026-01-01T00:01:00.000Z'));
    expect(one.completedAt).toBeNull();
    expect(addTransferResponse(one, response, 2).responses).toHaveLength(1);
    const done = addTransferResponse(
      one,
      { ...response, itemId: 'b' },
      2,
      new Date('2026-01-01T00:02:00.000Z'),
    );
    expect(done.completedAt).toBe('2026-01-01T00:02:00.000Z');
    vi.unstubAllGlobals();
  });

  it('compara tomas cronológicamente sin mezclar volumen con porcentaje', () => {
    const first = finished('m1', '2026-01-01T00:00:00.000Z', [true, false, false, false]);
    const second = finished('m2', '2026-03-01T00:00:00.000Z', [true, true, false, false]);
    expect(transferResults([second, first]).map((result) => result.percentage)).toEqual([25, 50]);
    expect(transferDelta([second, first])).toBe(25);
    expect(transferDelta([first])).toBeNull();
  });

  it('no compara tomas de versiones distintas del instrumento', () => {
    const old = finished('m1', '2026-01-01T00:00:00.000Z', [false]);
    const current = { ...finished('m2', '2026-03-01T00:00:00.000Z', [true]), datasetVersion: 'transfer-v2' };
    expect(transferResults([old, current], 'transfer-v2')).toHaveLength(1);
    expect(transferDelta([old, current], 'transfer-v2')).toBeNull();
  });
});
