import { describe, expect, it } from 'vitest';
import { minutosDeBloque, minutosPendientesDelPlan, presupuestoPorSesion } from './duracion';
import type { DailyAssignment } from './types';

describe('minutosDeBloque', () => {
  it('estima por ítem y nunca baja de un minuto', () => {
    expect(minutosDeBloque('radar', 8)).toBe(10);
    expect(minutosDeBloque('cola', 4)).toBe(3);
    expect(minutosDeBloque('triage', 1)).toBe(1); // 0,5 redondea a 1, no a 0
  });

  it('un bloque sin ítems no ocupa tiempo', () => {
    expect(minutosDeBloque('radar', 0)).toBe(0);
  });
});

describe('minutosPendientesDelPlan', () => {
  const plan: DailyAssignment = {
    id: '2026-07-27',
    creadoEn: '2026-07-27T09:00:00.000Z',
    bloques: [
      { tipo: 'curriculo', planificados: 4, completados: 4, estado: 'completado' },
      { tipo: 'radar', planificados: 8, completados: 2, estado: 'pendiente' },
    ],
  };

  it('cuenta solo lo que falta: lo hecho ya no ocupa el presupuesto de hoy', () => {
    expect(minutosPendientesDelPlan(plan)).toBe(minutosDeBloque('radar', 6));
  });

  it('sin plan todavía, no estima nada', () => {
    expect(minutosPendientesDelPlan(null)).toBe(0);
  });
});

describe('presupuestoPorSesion', () => {
  it('reparte el objetivo semanal entre las sesiones declaradas', () => {
    expect(presupuestoPorSesion({ sesionesObjetivo: 3, minutosObjetivo: 90 })).toBe(30);
    expect(presupuestoPorSesion({ sesionesObjetivo: 2, minutosObjetivo: 60 })).toBe(30);
    expect(presupuestoPorSesion({ sesionesObjetivo: 5, minutosObjetivo: 150 })).toBe(30);
  });

  it('un plan ausente o inválido cae al plan por defecto en vez de romper', () => {
    expect(presupuestoPorSesion(undefined)).toBe(30);
    expect(presupuestoPorSesion({ sesionesObjetivo: 0, minutosObjetivo: -5 })).toBe(30);
  });
});
