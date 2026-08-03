// Registro de la sesión diaria (RF-11.1, RF-12.1, RF-13.1). Dominio puro:
// construye snapshots persistibles sin conocer Dexie ni la interfaz.
import type { SessionBlockRecord, SessionBlockType, SessionRecord } from './types';

export interface PlannedSessionBlock {
  tipo: SessionBlockType;
  planificados: number;
}

export function startSessionRecord(
  planned: PlannedSessionBlock[],
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
): SessionRecord {
  const fechaInicio = now.toISOString();
  const bloques: SessionBlockRecord[] = planned
    .filter((b) => b.planificados > 0)
    .map((b, index) => ({
      ...b,
      completados: 0,
      estado: index === 0 ? 'en_curso' : 'pendiente',
      ...(index === 0 ? { inicio: fechaInicio } : {}),
    }));
  return { id, fechaInicio, estado: 'en_curso', bloques };
}

export function recordSessionItem(record: SessionRecord, tipo: SessionBlockType): SessionRecord {
  return {
    ...record,
    bloques: record.bloques.map((b) =>
      b.tipo === tipo ? { ...b, completados: Math.min(b.planificados, b.completados + 1) } : b,
    ),
  };
}

export function transitionSessionBlock(
  record: SessionRecord,
  completed: SessionBlockType,
  next: SessionBlockType | null,
  now: Date = new Date(),
): SessionRecord {
  const timestamp = now.toISOString();
  return {
    ...record,
    bloques: record.bloques.map((b) => {
      if (b.tipo === completed) return { ...b, estado: 'completado', fin: timestamp };
      if (b.tipo === next) return { ...b, estado: 'en_curso', inicio: b.inicio ?? timestamp };
      return b;
    }),
  };
}

export function completeSessionRecord(record: SessionRecord, now: Date = new Date()): SessionRecord {
  const fechaFin = now.toISOString();
  return {
    ...record,
    estado: 'completada',
    fechaFin,
    duracionMs: Math.max(0, now.getTime() - new Date(record.fechaInicio).getTime()),
    bloques: record.bloques.map((b) =>
      b.estado === 'en_curso' ? { ...b, estado: 'completado', fin: fechaFin } : b,
    ),
  };
}

export function abandonSessionRecord(record: SessionRecord, now: Date = new Date()): SessionRecord {
  if (record.estado !== 'en_curso') return record;
  const fechaFin = now.toISOString();
  return {
    ...record,
    estado: 'abandonada',
    fechaFin,
    duracionMs: Math.max(0, now.getTime() - new Date(record.fechaInicio).getTime()),
    bloques: record.bloques.map((b) =>
      b.estado === 'en_curso' ? { ...b, fin: fechaFin } : b,
    ),
  };
}

/**
 * El último instante del que la sesión dejó registro: el `fin`/`inicio` de
 * bloque más reciente, o su propio comienzo si no llegó a haber ninguno.
 */
export function ultimoInstanteObservado(record: SessionRecord): string {
  const marcas = [record.fechaInicio, ...record.bloques.flatMap((b) => [b.inicio, b.fin])];
  return marcas.reduce<string>(
    // Las fechas ISO en UTC se ordenan como texto.
    (max, marca) => (typeof marca === 'string' && marca > max ? marca : max),
    record.fechaInicio,
  );
}

/**
 * Cierra una sesión que quedó `en_curso` sin que nadie la cerrara: la app se
 * recargó, la pestaña se fue o el service worker tomó control a mitad de
 * camino. Sin esto el registro se queda colgado para siempre y **sin
 * `duracionMs`**, así que esos minutos no cuentan en ninguna lectura de carga:
 * el usuario entrena media hora, la app se recarga sola y su plan semanal dice
 * 3 minutos.
 *
 * La duración se corta en el último instante observado, no en "ahora": una
 * sesión abandonada el martes no puede sumar los días que estuvo colgada. Es
 * una cota inferior —lo que pasó dentro del último bloque no quedó registrado—
 * y ese es el lado correcto para equivocarse.
 */
export function cerrarSesionColgada(record: SessionRecord): SessionRecord {
  if (record.estado !== 'en_curso') return record;
  return abandonSessionRecord(record, new Date(ultimoInstanteObservado(record)));
}

export interface ActivitySummary {
  sesiones: number;
  minutos: number;
  items: number;
  /** Días consecutivos con al menos una sesión completada (RF-13.1). */
  racha: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Índice de día calendario local, inmune a cambios de horario de verano. */
function localDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/**
 * Tipos de bloque completados hoy (día local), leídos de los registros de
 * sesión. Un bloque cuenta si quedó en estado 'completado', aunque la sesión se
 * haya abandonado después — p. ej. el usuario hizo todo el Repaso y salió antes
 * del Radar: el Repaso figura hecho, el Radar no (RF-11.5). Sirve para marcar en
 * Hoy lo ya hecho sin bloquear repetirlo.
 */
export function bloquesHechosHoy(records: SessionRecord[], now: Date = new Date()): Set<SessionBlockType> {
  const hoy = localDayIndex(now);
  const hechos = new Set<SessionBlockType>();
  for (const record of records) {
    if (localDayIndex(new Date(record.fechaFin ?? record.fechaInicio)) !== hoy) continue;
    for (const bloque of record.bloques) {
      if (bloque.estado === 'completado') hechos.add(bloque.tipo);
    }
  }
  return hechos;
}

/**
 * Racha de proceso: un día suma si hubo al menos una sesión completada. Una
 * segunda sesión el mismo día, más ítems o más aciertos no agregan nada.
 * Si hoy aún no se entrenó, la racha de ayer sigue visible sin presión falsa.
 */
export function processStreak(records: SessionRecord[], now: Date = new Date()): number {
  const today = localDayIndex(now);
  const completedDays = new Set(
    records
      .filter((record) => record.estado === 'completada')
      .map((record) => localDayIndex(new Date(record.fechaFin ?? record.fechaInicio)))
      .filter((day) => Number.isFinite(day) && day <= today),
  );
  if (completedDays.size === 0) return 0;
  let day = completedDays.has(today) ? today : today - 1;
  if (!completedDays.has(day)) return 0;
  let streak = 0;
  while (completedDays.has(day)) {
    streak++;
    day--;
  }
  return streak;
}

export function activitySummary(
  records: SessionRecord[],
  now: Date = new Date(),
  days = 30,
): ActivitySummary {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const enVentana = records.filter((r) => new Date(r.fechaInicio).getTime() >= since);
  // `sesiones` es la unidad de adherencia y solo la mueve una sesión terminada.
  // Minutos y respuestas describen actividad: contarlos solo de las sesiones
  // completadas borraba el trabajo real de las que se cortaron —los repasos ya
  // resueltos quedaron registrados en sus bloques igual—, así que los totales
  // informaban menos de lo entrenado.
  const conDuracionMedida = enVentana.filter((r) => r.estado !== 'en_curso');
  return {
    sesiones: enVentana.filter((r) => r.estado === 'completada').length,
    minutos: Math.round(conDuracionMedida.reduce((sum, r) => sum + (r.duracionMs ?? 0), 0) / 60_000),
    items: conDuracionMedida.reduce(
      (sum, r) => sum + r.bloques.reduce((blockSum, b) => blockSum + b.completados, 0),
      0,
    ),
    racha: processStreak(records, now),
  };
}
