// Adherencia honesta: el plan se mide por semana calendario local y como
// máximo cuenta una sesión completada por día. Los minutos acompañan la
// lectura de carga, pero no reemplazan la constancia (ADR-0013).
import type { PlanSemanal, SessionRecord } from './types';

export const DEFAULT_WEEKLY_PLAN: PlanSemanal = {
  sesionesObjetivo: 3,
  minutosObjetivo: 90,
};

export const WEEKLY_PLAN_PRESETS = {
  ligero: { sesionesObjetivo: 2, minutosObjetivo: 60 },
  constante: DEFAULT_WEEKLY_PLAN,
  intenso: { sesionesObjetivo: 5, minutosObjetivo: 150 },
} as const satisfies Record<string, PlanSemanal>;

export type WeeklyPlanPreset = keyof typeof WEEKLY_PLAN_PRESETS;

export function isValidWeeklyPlan(value: unknown): value is PlanSemanal {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Partial<PlanSemanal>;
  return Number.isInteger(plan.sesionesObjetivo) && Number(plan.sesionesObjetivo) >= 1 && Number(plan.sesionesObjetivo) <= 7 &&
    Number.isInteger(plan.minutosObjetivo) && Number(plan.minutosObjetivo) >= 15 && Number(plan.minutosObjetivo) <= 600;
}

export function normalizeWeeklyPlan(value: unknown): PlanSemanal {
  return isValidWeeklyPlan(value) ? { ...value } : { ...DEFAULT_WEEKLY_PLAN };
}

export function weeklyPlanPreset(plan: PlanSemanal): WeeklyPlanPreset | 'personalizado' {
  const match = Object.entries(WEEKLY_PLAN_PRESETS).find(([, preset]) =>
    preset.sesionesObjetivo === plan.sesionesObjetivo && preset.minutosObjetivo === plan.minutosObjetivo,
  );
  return (match?.[0] as WeeklyPlanPreset | undefined) ?? 'personalizado';
}

export interface WeeklyPlanProgress {
  inicioSemana: Date;
  finSemana: Date;
  sesionesCompletadas: number;
  sesionesObjetivo: number;
  minutosCompletados: number;
  minutosObjetivo: number;
  sesionesRestantes: number;
  proporcionSesiones: number;
  proporcionMinutos: number;
  cumplido: boolean;
}

function startOfLocalWeek(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function completedTimestamps(records: SessionRecord[]): Date[] {
  return records
    .filter((record) => record.estado === 'completada')
    .map((record) => new Date(record.fechaFin ?? record.fechaInicio))
    .filter((date) => Number.isFinite(date.getTime()));
}

/** Días distintos con una sesión completada dentro de [inicio, fin), sin pasar el tope. */
function completedDaysInWindow(records: SessionRecord[], inicio: Date, fin: Date, tope: Date): number {
  const days = new Set<string>();
  for (const date of completedTimestamps(records)) {
    if (date >= inicio && date < fin && date <= tope) days.add(localDayKey(date));
  }
  return days.size;
}

export function weeklyPlanProgress(
  records: SessionRecord[],
  rawPlan: PlanSemanal | undefined,
  now: Date = new Date(),
): WeeklyPlanProgress {
  const plan = normalizeWeeklyPlan(rawPlan);
  const inicioSemana = startOfLocalWeek(now);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(finSemana.getDate() + 7);

  const completed = records.filter((record) => {
    if (record.estado !== 'completada') return false;
    const timestamp = new Date(record.fechaFin ?? record.fechaInicio);
    return Number.isFinite(timestamp.getTime()) && timestamp >= inicioSemana && timestamp < finSemana && timestamp <= now;
  });
  const completedDays = new Set(
    completed.map((record) => localDayKey(new Date(record.fechaFin ?? record.fechaInicio))),
  );
  const sesionesCompletadas = completedDays.size;
  const minutosCompletados = Math.round(
    completed.reduce((total, record) => total + Math.max(0, record.duracionMs ?? 0), 0) / 60_000,
  );

  return {
    inicioSemana,
    finSemana,
    sesionesCompletadas,
    sesionesObjetivo: plan.sesionesObjetivo,
    minutosCompletados,
    minutosObjetivo: plan.minutosObjetivo,
    sesionesRestantes: Math.max(0, plan.sesionesObjetivo - sesionesCompletadas),
    proporcionSesiones: Math.min(1, sesionesCompletadas / plan.sesionesObjetivo),
    proporcionMinutos: Math.min(1, minutosCompletados / plan.minutosObjetivo),
    cumplido: sesionesCompletadas >= plan.sesionesObjetivo,
  };
}

// --- RF-13.5: racha semanal y consistencia de las últimas ocho semanas ---
// Todo se deriva de los mismos registros de sesión (ADR-0013): no se persiste
// ni racha, ni puntaje, ni estado de recompensa. La consistencia tiene mayor
// jerarquía que la racha, y una semana fallida no borra la historia — es solo
// una celda vacía en la tira, no un reinicio del recuento consistente.

export const ADHERENCE_WINDOW_WEEKS = 8;

export interface WeekAdherence {
  inicio: Date;
  fin: Date;
  /** La semana en curso (todavía puede cumplirse). */
  esActual: boolean;
  cumplida: boolean;
  /** La semana cae dentro del historial del usuario (hay actividad desde antes o durante). */
  dentroDelHistorial: boolean;
  sesionesCompletadas: number;
  sesionesObjetivo: number;
}

export interface AdherenceHistory {
  /** Semanas de la ventana, más reciente primero (para dibujar la tira). */
  semanas: WeekAdherence[];
  /** Semanas cumplidas consecutivas hasta la última con veredicto; la semana en curso, si aún no se cumplió, no la corta. */
  rachaSemanas: number;
  /** Consistencia (jerarquía mayor): semanas cumplidas sobre semanas con veredicto dentro del historial. Null si todavía no hay ninguna. */
  consistencia: { cumplidas: number; consideradas: number } | null;
}

/**
 * Historial de adherencia (RF-13.5): racha semanal y consistencia de las
 * últimas ocho semanas, derivadas de las sesiones completadas y del plan
 * vigente. La semana en curso solo cuenta como cumplida si ya se alcanzó la
 * meta; mientras está en curso y sin cumplir, queda pendiente (no baja la
 * consistencia ni corta la racha). Las semanas anteriores al inicio del
 * historial del usuario no cuentan como fallos.
 */
export function adherenceHistory(
  records: SessionRecord[],
  rawPlan: PlanSemanal | undefined,
  now: Date = new Date(),
  ventana: number = ADHERENCE_WINDOW_WEEKS,
): AdherenceHistory {
  const plan = normalizeWeeklyPlan(rawPlan);
  const timestamps = completedTimestamps(records);
  const historyStart = timestamps.length > 0
    ? startOfLocalWeek(new Date(Math.min(...timestamps.map((date) => date.getTime()))))
    : null;

  const semanaActualInicio = startOfLocalWeek(now);
  const semanas: WeekAdherence[] = [];
  for (let offset = 0; offset < ventana; offset++) {
    const inicio = new Date(semanaActualInicio);
    inicio.setDate(inicio.getDate() - 7 * offset);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 7);
    const esActual = offset === 0;
    // La semana en curso se corta en `now`; las cerradas se cuentan completas.
    const tope = esActual ? now : fin;
    const sesionesCompletadas = completedDaysInWindow(records, inicio, fin, tope);
    semanas.push({
      inicio,
      fin,
      esActual,
      cumplida: sesionesCompletadas >= plan.sesionesObjetivo,
      dentroDelHistorial: historyStart !== null && inicio >= historyStart,
      sesionesCompletadas,
      sesionesObjetivo: plan.sesionesObjetivo,
    });
  }

  // Una semana tiene veredicto si ya cerró, o si está en curso pero ya se cumplió.
  const tieneVeredicto = (semana: WeekAdherence): boolean => !semana.esActual || semana.cumplida;

  let rachaSemanas = 0;
  for (const semana of semanas) {
    if (semana.esActual && !semana.cumplida) continue; // en curso, pendiente: ni suma ni corta
    if (!semana.dentroDelHistorial) break; // antes del historial: no hay más que contar
    if (semana.cumplida) rachaSemanas += 1;
    else break;
  }

  const consideradas = semanas.filter((semana) => semana.dentroDelHistorial && tieneVeredicto(semana));
  const cumplidas = consideradas.filter((semana) => semana.cumplida).length;
  const consistencia = consideradas.length > 0 ? { cumplidas, consideradas: consideradas.length } : null;

  return { semanas, rachaSemanas, consistencia };
}
