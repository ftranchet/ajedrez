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
  const completed = records.filter(
    (r) => r.estado === 'completada' && new Date(r.fechaInicio).getTime() >= since,
  );
  const durationMs = completed.reduce((sum, r) => sum + (r.duracionMs ?? 0), 0);
  return {
    sesiones: completed.length,
    minutos: Math.round(durationMs / 60_000),
    items: completed.reduce(
      (sum, r) => sum + r.bloques.reduce((blockSum, b) => blockSum + b.completados, 0),
      0,
    ),
    racha: processStreak(records, now),
  };
}
