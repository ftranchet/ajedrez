// Calibración del juicio (E10): confianza declarada muestreada + puntuación
// de Brier. Barato de implementar, transversal a todos los módulos.
import type { CalibrationRecord } from './types';

/** ~1 de cada 4–5 respuestas, para no arruinar el flujo con un slider siempre (RF-10.1). */
export function shouldSampleConfidence(rng: () => number = Math.random): boolean {
  return rng() < 1 / 4.5;
}

/**
 * Puntuación de Brier: error cuadrático medio entre la confianza declarada
 * (como probabilidad 0–1) y el resultado real (1 = acierto, 0 = fallo).
 * 0 = calibración perfecta; 1 = la peor posible. RF-10.2.
 */
export function brierScore(records: Pick<CalibrationRecord, 'confianzaDeclarada' | 'acierto'>[]): number | null {
  if (records.length === 0) return null;
  const sum = records.reduce((acc, r) => {
    const forecast = r.confianzaDeclarada / 100;
    const outcome = r.acierto ? 1 : 0;
    return acc + (forecast - outcome) ** 2;
  }, 0);
  return sum / records.length;
}

export function brierScoreByContext(
  records: CalibrationRecord[],
): Partial<Record<CalibrationRecord['contexto'], number>> {
  const byContext = new Map<CalibrationRecord['contexto'], CalibrationRecord[]>();
  for (const r of records) {
    const list = byContext.get(r.contexto) ?? [];
    list.push(r);
    byContext.set(r.contexto, list);
  }
  const result: Partial<Record<CalibrationRecord['contexto'], number>> = {};
  for (const [ctx, list] of byContext) {
    const score = brierScore(list);
    if (score !== null) result[ctx] = score;
  }
  return result;
}
