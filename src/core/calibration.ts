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

export interface CalibrationPoint {
  desde: number;
  hasta: number;
  confianzaMedia: number;
  aciertoReal: number;
  cantidad: number;
}

/** Curva de confiabilidad en cinco bandas de 20 puntos (RF-10.3). */
export function calibrationCurve(
  records: Pick<CalibrationRecord, 'confianzaDeclarada' | 'acierto'>[],
): CalibrationPoint[] {
  const buckets = Array.from({ length: 5 }, (_, index) => ({
    desde: index * 20,
    hasta: index === 4 ? 100 : index * 20 + 19,
    records: [] as Pick<CalibrationRecord, 'confianzaDeclarada' | 'acierto'>[],
  }));
  for (const record of records) {
    const confianza = Math.min(100, Math.max(0, record.confianzaDeclarada));
    buckets[Math.min(4, Math.floor(confianza / 20))].records.push({ ...record, confianzaDeclarada: confianza });
  }
  return buckets
    .filter((bucket) => bucket.records.length > 0)
    .map((bucket) => ({
      desde: bucket.desde,
      hasta: bucket.hasta,
      confianzaMedia:
        bucket.records.reduce((sum, record) => sum + record.confianzaDeclarada, 0) / bucket.records.length,
      aciertoReal: bucket.records.filter((record) => record.acierto).length / bucket.records.length,
      cantidad: bucket.records.length,
    }));
}

/**
 * Brecha de calibración (error de calibración esperado): a cuántos puntos, en
 * promedio, tu confianza declarada queda de tu acierto real. 0 es perfecto.
 *
 * Existe porque Brier, que es lo que el Panel mostraba como titular, mezcla dos
 * cosas: qué tan calibrado estás y qué tan difícil es lo que respondés. Como el
 * Radar mantiene el acierto en torno al 70% a propósito (RF-5.5), alguien
 * perfectamente calibrado que declara 70% siempre saca 0,21 y *parece* peor que
 * alguien que acierta 90% por estar en material fácil. Además "0,18" no le dice
 * nada a un ajedrecista. La brecha se lee sola —"declarás 20 puntos por encima
 * de lo que acertás"— y es la lectura que RF-10.3 pide en lenguaje claro. Brier
 * se conserva como detalle: es la métrica de guardia del PRD §3.2.
 */
export function brechaCalibracion(records: Pick<CalibrationRecord, 'confianzaDeclarada' | 'acierto'>[]): number | null {
  const curva = calibrationCurve(records);
  if (curva.length === 0) return null;
  const total = curva.reduce((sum, punto) => sum + punto.cantidad, 0);
  if (total === 0) return null;
  return curva.reduce(
    (sum, punto) => sum + (punto.cantidad / total) * Math.abs(punto.confianzaMedia - punto.aciertoReal * 100),
    0,
  );
}

/**
 * Serie de la brecha a lo largo del tiempo, en ventanas móviles de `ventana`
 * respuestas. Para ver si la calibración mejora, que es lo que el PRD §3.2 pide
 * ("debe bajar"), en vez de un número sin historia.
 */
export function serieBrechaCalibracion(
  records: CalibrationRecord[],
  ventana = 12,
): Array<{ fecha: string; valor: number }> {
  const ordenados = [...records]
    .filter((record) => Number.isFinite(new Date(record.fecha).getTime()))
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const serie: Array<{ fecha: string; valor: number }> = [];
  for (let i = ventana - 1; i < ordenados.length; i++) {
    const tramo = ordenados.slice(Math.max(0, i + 1 - ventana), i + 1);
    const brecha = brechaCalibracion(tramo);
    if (brecha !== null) serie.push({ fecha: ordenados[i].fecha, valor: brecha });
  }
  return serie;
}

export interface CalibrationInsight {
  direccion: 'sobreconfianza' | 'subconfianza' | 'calibrada';
  contexto: CalibrationRecord['contexto'] | 'global';
  confianza: number;
  acierto: number;
  cantidad: number;
}

/**
 * Lectura más informativa disponible en lenguaje de dominio (RF-10.3).
 * Exige al menos 3 observaciones en una banda contextual; si todavía no las
 * hay, usa una banda global con 5 para no afirmar patrones por dos respuestas.
 */
export function calibrationInsight(records: CalibrationRecord[]): CalibrationInsight | null {
  const contexts: CalibrationRecord['contexto'][] = ['radar', 'analisis', 'stoyko'];
  const candidates: CalibrationInsight[] = [];
  for (const contexto of contexts) {
    for (const point of calibrationCurve(records.filter((record) => record.contexto === contexto))) {
      if (point.cantidad < 3) continue;
      candidates.push(insightFromPoint(point, contexto));
    }
  }
  if (candidates.length === 0) {
    for (const point of calibrationCurve(records)) {
      if (point.cantidad >= 5) candidates.push(insightFromPoint(point, 'global'));
    }
  }
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => Math.abs(b.confianza - b.acierto) - Math.abs(a.confianza - a.acierto),
  )[0];
}

function insightFromPoint(
  point: CalibrationPoint,
  contexto: CalibrationInsight['contexto'],
): CalibrationInsight {
  const confianza = Math.round(point.confianzaMedia);
  const acierto = Math.round(point.aciertoReal * 100);
  const gap = confianza - acierto;
  return {
    direccion: gap > 10 ? 'sobreconfianza' : gap < -10 ? 'subconfianza' : 'calibrada',
    contexto,
    confianza,
    acierto,
    cantidad: point.cantidad,
  };
}
