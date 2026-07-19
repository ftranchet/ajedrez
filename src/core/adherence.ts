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
