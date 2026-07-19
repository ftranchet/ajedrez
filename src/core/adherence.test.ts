import { describe, expect, it } from 'vitest';
import type { SessionRecord } from './types';
import {
  DEFAULT_WEEKLY_PLAN,
  isValidWeeklyPlan,
  normalizeWeeklyPlan,
  weeklyPlanPreset,
  weeklyPlanProgress,
} from './adherence';

function completed(id: string, date: Date, minutes: number): SessionRecord {
  return {
    id,
    fechaInicio: date.toISOString(),
    fechaFin: new Date(date.getTime() + minutes * 60_000).toISOString(),
    estado: 'completada',
    duracionMs: minutes * 60_000,
    bloques: [{ tipo: 'radar', planificados: 8, completados: 8, estado: 'completado' }],
  };
}

describe('plan semanal', () => {
  it('normaliza planes ausentes o fuera de límites sin romper perfiles viejos', () => {
    expect(normalizeWeeklyPlan(undefined)).toEqual(DEFAULT_WEEKLY_PLAN);
    expect(isValidWeeklyPlan({ sesionesObjetivo: 0, minutosObjetivo: 90 })).toBe(false);
    expect(isValidWeeklyPlan({ sesionesObjetivo: 3, minutosObjetivo: 90 })).toBe(true);
    expect(weeklyPlanPreset(DEFAULT_WEEKLY_PLAN)).toBe('constante');
    expect(weeklyPlanPreset({ sesionesObjetivo: 4, minutosObjetivo: 100 })).toBe('personalizado');
  });

  it('mide la semana local de lunes a domingo y excluye abandonos', () => {
    const now = new Date(2026, 6, 19, 20); // domingo local
    const records = [
      completed('lunes', new Date(2026, 6, 13, 10), 20),
      completed('miercoles', new Date(2026, 6, 15, 10), 25),
      completed('semana-anterior', new Date(2026, 6, 12, 10), 40),
      {
        ...completed('abandono', new Date(2026, 6, 18, 10), 30),
        estado: 'abandonada' as const,
      },
    ];
    const summary = weeklyPlanProgress(records, DEFAULT_WEEKLY_PLAN, now);
    expect(summary.sesionesCompletadas).toBe(2);
    expect(summary.minutosCompletados).toBe(45);
    expect(summary.sesionesRestantes).toBe(1);
    expect(summary.cumplido).toBe(false);
  });

  it('cuenta como máximo una sesión por día, aunque informa todos los minutos reales', () => {
    const now = new Date(2026, 6, 15, 20);
    const summary = weeklyPlanProgress([
      completed('mañana', new Date(2026, 6, 15, 9), 20),
      completed('tarde', new Date(2026, 6, 15, 18), 15),
    ], { sesionesObjetivo: 1, minutosObjetivo: 30 }, now);
    expect(summary.sesionesCompletadas).toBe(1);
    expect(summary.minutosCompletados).toBe(35);
    expect(summary.proporcionSesiones).toBe(1);
    expect(summary.proporcionMinutos).toBe(1);
    expect(summary.cumplido).toBe(true);
  });
});
