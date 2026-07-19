// Batería de transferencia (RF-12.2): calendario y comparación puros. El
// dominio no conoce React, Dexie ni el catálogo concreto.
import type { TransferMeasurement, TransferResponse } from './types';

export const TRANSFER_INTERVAL_DAYS = 49; // punto medio explícito de 6–8 semanas

export type TransferAvailability =
  | { status: 'available' }
  | { status: 'in-progress'; measurement: TransferMeasurement }
  | { status: 'scheduled'; nextAt: string };

export interface TransferResult {
  measurementId: string;
  completedAt: string;
  correct: number;
  total: number;
  percentage: number;
}

function completed(measurements: TransferMeasurement[]): Array<TransferMeasurement & { completedAt: string }> {
  return measurements
    .filter((measurement): measurement is TransferMeasurement & { completedAt: string } => measurement.completedAt !== null)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

export function transferAvailability(
  measurements: TransferMeasurement[],
  now: Date = new Date(),
  datasetVersion?: string,
): TransferAvailability {
  const comparable = datasetVersion
    ? measurements.filter((measurement) => measurement.datasetVersion === datasetVersion)
    : measurements;
  const inProgress = comparable.find((measurement) => measurement.completedAt === null);
  if (inProgress) return { status: 'in-progress', measurement: inProgress };

  const latest = completed(comparable)[0];
  if (!latest) return { status: 'available' };
  const next = new Date(latest.completedAt);
  next.setUTCDate(next.getUTCDate() + TRANSFER_INTERVAL_DAYS);
  return now.getTime() >= next.getTime()
    ? { status: 'available' }
    : { status: 'scheduled', nextAt: next.toISOString() };
}

export function startTransferMeasurement(datasetVersion: string, now: Date = new Date()): TransferMeasurement {
  return {
    id: crypto.randomUUID(),
    datasetVersion,
    startedAt: now.toISOString(),
    completedAt: null,
    responses: [],
  };
}

export function addTransferResponse(
  measurement: TransferMeasurement,
  response: TransferResponse,
  totalItems: number,
  now: Date = new Date(),
): TransferMeasurement {
  if (measurement.completedAt !== null) return measurement;
  if (measurement.responses.some((candidate) => candidate.itemId === response.itemId)) return measurement;
  const responses = [...measurement.responses, response];
  return {
    ...measurement,
    responses,
    completedAt: responses.length === totalItems ? now.toISOString() : null,
  };
}

export function transferResults(measurements: TransferMeasurement[], datasetVersion?: string): TransferResult[] {
  const comparable = datasetVersion
    ? measurements.filter((measurement) => measurement.datasetVersion === datasetVersion)
    : measurements;
  return completed(comparable)
    .reverse()
    .map((measurement) => {
      const total = measurement.responses.length;
      const correct = measurement.responses.filter((response) => response.correct).length;
      return {
        measurementId: measurement.id,
        completedAt: measurement.completedAt,
        correct,
        total,
        percentage: total === 0 ? 0 : Math.round((correct / total) * 100),
      };
    });
}

export function transferDelta(measurements: TransferMeasurement[], datasetVersion?: string): number | null {
  const results = transferResults(measurements, datasetVersion);
  if (results.length < 2) return null;
  return results.at(-1)!.percentage - results.at(-2)!.percentage;
}
