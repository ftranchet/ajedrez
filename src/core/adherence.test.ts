import { describe, expect, it } from 'vitest';
import type { SessionRecord } from './types';
import {
  adherenceHistory,
  DEFAULT_WEEKLY_PLAN,
  isValidWeeklyPlan,
  normalizeWeeklyPlan,
  weeklyPlanPreset,
  weeklyPlanProgress,
} from './adherence';

const PLAN_2 = { sesionesObjetivo: 2, minutosObjetivo: 30 };

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

describe('adherenceHistory (RF-13.5)', () => {
  it('sin sesiones, no hay racha ni consistencia y ninguna semana pesa como fallo', () => {
    const history = adherenceHistory([], PLAN_2, new Date(2026, 6, 19, 20));
    expect(history.rachaSemanas).toBe(0);
    expect(history.consistencia).toBeNull();
    expect(history.semanas).toHaveLength(8);
    expect(history.semanas.every((s) => !s.dentroDelHistorial)).toBe(true);
  });

  it('una semana fallida no borra la historia: consistencia se mantiene y solo la racha se corta', () => {
    const now = new Date(2026, 6, 19, 20); // domingo, semana en curso lun 13–dom 19
    const records = [
      // Semana actual (13–19): cumplida
      completed('a1', new Date(2026, 6, 13, 10), 20), completed('a2', new Date(2026, 6, 15, 10), 20),
      // Semana -1 (6–12): cumplida
      completed('b1', new Date(2026, 6, 6, 10), 20), completed('b2', new Date(2026, 6, 8, 10), 20),
      // Semana -2 (jun 29–jul 5): fallada (una sola)
      completed('c1', new Date(2026, 5, 29, 10), 20),
      // Semana -3 (jun 22–28): cumplida (define el inicio del historial)
      completed('d1', new Date(2026, 5, 22, 10), 20), completed('d2', new Date(2026, 5, 24, 10), 20),
    ];
    const history = adherenceHistory(records, PLAN_2, now);
    // Racha: actual cumplida + semana -1 cumplida, se corta en la -2 fallada.
    expect(history.rachaSemanas).toBe(2);
    // Consistencia: 3 de 4 semanas con veredicto dentro del historial (la fallada sigue contando, no se borra).
    expect(history.consistencia).toEqual({ cumplidas: 3, consideradas: 4 });
  });

  it('la semana en curso todavía sin cumplir queda pendiente: no corta la racha ni baja la consistencia', () => {
    const now = new Date(2026, 6, 13, 9); // lunes temprano, semana en curso sin sesiones aún
    const records = [
      // Semana -1 (6–12): cumplida
      completed('b1', new Date(2026, 6, 6, 10), 20), completed('b2', new Date(2026, 6, 8, 10), 20),
      // Semana -2 (jun 29–jul 5): cumplida (inicio del historial)
      completed('c1', new Date(2026, 5, 29, 10), 20), completed('c2', new Date(2026, 6, 1, 10), 20),
    ];
    const history = adherenceHistory(records, PLAN_2, now);
    expect(history.rachaSemanas).toBe(2); // la actual pendiente no cuenta ni corta
    expect(history.consistencia).toEqual({ cumplidas: 2, consideradas: 2 }); // la actual pendiente no entra al denominador
    expect(history.semanas[0].esActual).toBe(true);
    expect(history.semanas[0].cumplida).toBe(false);
  });
});
