// Cuánto dura lo que se prescribe (RF-11.1 pide una duración visible antes de
// empezar). Heurística simple y declarada, no un cronómetro: sirve para que el
// usuario sepa en qué se está metiendo y para que el plan semanal pueda
// gobernar la carga en vez de decorarla.
//
// Vive en `core` y no en la pantalla porque dejó de ser presentación: el
// presupuesto diario compara estos minutos con los que el usuario dijo tener.
import type { DailyAssignment, PlanSemanal, SessionBlockType } from './types';
import { normalizeWeeklyPlan } from './adherence';

/** Minutos estimados por ítem de cada bloque de la sesión. */
export const MINUTOS_POR_ITEM: Record<SessionBlockType, number> = {
  cola: 0.75,
  curriculo: 0.75,
  triage: 0.5,
  radar: 1.25,
};

/** Duración de un bloque, redondeada y nunca menor a un minuto. */
export function minutosDeBloque(tipo: SessionBlockType, cantidad: number): number {
  if (cantidad <= 0) return 0;
  return Math.max(1, Math.round(cantidad * MINUTOS_POR_ITEM[tipo]));
}

/** Duración estimada de lo que falta del plan del día. */
export function minutosPendientesDelPlan(assignment: DailyAssignment | null): number {
  if (!assignment) return 0;
  return assignment.bloques
    .filter((bloque) => bloque.estado !== 'completado')
    .reduce((total, bloque) => total + minutosDeBloque(bloque.tipo, bloque.planificados - bloque.completados), 0);
}

/**
 * Minutos que el usuario declaró tener por sesión: su objetivo semanal
 * repartido entre las sesiones que dijo poder hacer.
 *
 * Es la traducción mínima honesta de "3 sesiones, 90 minutos" a "unos 30
 * minutos por día de entrenamiento". No pretende ser un cronograma: el plan
 * semanal no dice **qué** días entrena el usuario, así que repartir por día de
 * la semana sería inventar un dato que nadie dio.
 */
export function presupuestoPorSesion(plan: PlanSemanal | undefined): number {
  const normalizado = normalizeWeeklyPlan(plan);
  return Math.max(1, Math.round(normalizado.minutosObjetivo / normalizado.sesionesObjetivo));
}
