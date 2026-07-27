import { describe, expect, it } from 'vitest';
import {
  bloqueAsignado,
  buildDailyAssignment,
  cantidadRestante,
  completarBloqueAsignado,
  dailyAssignmentId,
  idsRestantes,
  planCompletado,
  planEmpezado,
  registrarItemAsignado,
  sincronizarColaConVencidas,
} from './dailyAssignment';
import type { SessionRecord } from './types';

const AHORA = new Date(2026, 6, 27, 9); // lunes 27/07, 09:00 local

const INPUT = {
  colaIds: ['card-1', 'card-2'],
  curriculumIds: ['patron-1', 'patron-2', 'patron-3'],
  triageCount: 5,
  radarCount: 8,
};

describe('dailyAssignmentId', () => {
  it('es el día calendario local, con ceros a la izquierda', () => {
    expect(dailyAssignmentId(new Date(2026, 6, 27, 23, 59))).toBe('2026-07-27');
    expect(dailyAssignmentId(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
  });
});

describe('buildDailyAssignment (RF-11.1)', () => {
  it('arma un bloque por tipo con contenido, con ítems concretos donde corresponde', () => {
    const plan = buildDailyAssignment(INPUT, [], AHORA);
    expect(plan.id).toBe('2026-07-27');
    expect(plan.bloques.map((b) => b.tipo)).toEqual(['cola', 'curriculo', 'triage', 'radar']);
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({ planificados: 2, completados: 0, itemIds: ['card-1', 'card-2'], estado: 'pendiente' });
    expect(bloqueAsignado(plan, 'radar')).toMatchObject({ planificados: 8 });
    expect(bloqueAsignado(plan, 'radar')!.itemIds).toBeUndefined();
  });

  it('omite los bloques sin contenido', () => {
    const plan = buildDailyAssignment({ colaIds: [], curriculumIds: [], triageCount: 0, radarCount: 8 }, [], AHORA);
    expect(plan.bloques.map((b) => b.tipo)).toEqual(['radar']);
  });

  it('siembra como completados los bloques que las sesiones de hoy ya registran', () => {
    // Actualización a mitad de día: el usuario ya hizo el currículo antes de
    // que existiera el plan persistente. No se le vuelve a pedir.
    const sesionHoy: SessionRecord = {
      id: 's1',
      fechaInicio: new Date(2026, 6, 27, 8).toISOString(),
      fechaFin: new Date(2026, 6, 27, 8, 20).toISOString(),
      estado: 'completada',
      bloques: [{ tipo: 'curriculo', planificados: 3, completados: 3, estado: 'completado' }],
    };
    const plan = buildDailyAssignment(INPUT, [sesionHoy], AHORA);
    expect(bloqueAsignado(plan, 'curriculo')).toMatchObject({ estado: 'completado', completados: 3 });
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({ estado: 'pendiente' });
  });

  it('ignora sesiones de otros días al sembrar el estado', () => {
    const sesionAyer: SessionRecord = {
      id: 's0',
      fechaInicio: new Date(2026, 6, 26, 8).toISOString(),
      fechaFin: new Date(2026, 6, 26, 8, 20).toISOString(),
      estado: 'completada',
      bloques: [{ tipo: 'curriculo', planificados: 3, completados: 3, estado: 'completado' }],
    };
    const plan = buildDailyAssignment(INPUT, [sesionAyer], AHORA);
    expect(bloqueAsignado(plan, 'curriculo')).toMatchObject({ estado: 'pendiente', completados: 0 });
  });
});

describe('registrarItemAsignado', () => {
  it('descuenta un ítem concreto y completa el bloque al llegar al plan', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({ completados: 1, estado: 'pendiente' });
    expect(idsRestantes(bloqueAsignado(plan, 'cola')!)).toEqual(['card-2']);

    plan = registrarItemAsignado(plan, 'cola', 'card-2');
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({ completados: 2, estado: 'completado' });
    expect(idsRestantes(bloqueAsignado(plan, 'cola')!)).toEqual([]);
  });

  it('es idempotente por ítem: repetir un id no vuelve a contar', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({ completados: 1 });
  });

  it('no toca un bloque ya completado: practicar de nuevo no infla el plan', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    for (let i = 0; i < 8; i++) plan = registrarItemAsignado(plan, 'radar');
    expect(bloqueAsignado(plan, 'radar')).toMatchObject({ completados: 8, estado: 'completado' });

    plan = registrarItemAsignado(plan, 'radar');
    expect(bloqueAsignado(plan, 'radar')).toMatchObject({ completados: 8, estado: 'completado' });
  });

  it('descuenta por cantidad en bloques sin ítems concretos', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    plan = registrarItemAsignado(plan, 'triage');
    plan = registrarItemAsignado(plan, 'triage');
    expect(cantidadRestante(bloqueAsignado(plan, 'triage')!)).toBe(3);
  });
});

describe('completarBloqueAsignado', () => {
  it('cierra un bloque que corrió hasta el final con menos contenido del planificado', () => {
    // Una tarjeta asignada fue borrada: el bloque sirve una sola y termina.
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    plan = completarBloqueAsignado(plan, 'cola');
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({ estado: 'completado', completados: 1 });
  });
});

describe('sincronizarColaConVencidas', () => {
  it('suma a la Cola pendiente los repasos vencidos después de armar el plan', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    plan = sincronizarColaConVencidas(plan, ['card-2', 'card-nueva']);
    expect(bloqueAsignado(plan, 'cola')).toMatchObject({
      planificados: 3,
      itemIds: ['card-1', 'card-2', 'card-nueva'],
      estado: 'pendiente',
    });
    // Lo ya hecho no se re-sirve: solo queda lo que falta.
    expect(idsRestantes(bloqueAsignado(plan, 'cola')!)).toEqual(['card-2', 'card-nueva']);
  });

  it('crea el bloque de Cola, primero en el orden, si el plan nació sin repasos', () => {
    let plan = buildDailyAssignment({ ...INPUT, colaIds: [] }, [], AHORA);
    expect(bloqueAsignado(plan, 'cola')).toBeNull();
    plan = sincronizarColaConVencidas(plan, ['card-nueva']);
    expect(plan.bloques[0]).toMatchObject({ tipo: 'cola', planificados: 1, itemIds: ['card-nueva'] });
  });

  it('no reabre una Cola completada: lo que venza después entra mañana', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    plan = registrarItemAsignado(plan, 'cola', 'card-2');
    expect(bloqueAsignado(plan, 'cola')!.estado).toBe('completado');
    const despues = sincronizarColaConVencidas(plan, ['card-nueva']);
    expect(despues).toBe(plan);
  });

  it('sin vencidas nuevas devuelve el mismo plan (sin escritura)', () => {
    const plan = buildDailyAssignment(INPUT, [], AHORA);
    expect(sincronizarColaConVencidas(plan, ['card-1', 'card-2'])).toBe(plan);
  });
});

describe('planEmpezado / planCompletado', () => {
  it('distinguen empezar, continuar y terminar el día', () => {
    let plan = buildDailyAssignment(INPUT, [], AHORA);
    expect(planEmpezado(plan)).toBe(false);
    expect(planCompletado(plan)).toBe(false);

    plan = registrarItemAsignado(plan, 'cola', 'card-1');
    expect(planEmpezado(plan)).toBe(true);
    expect(planCompletado(plan)).toBe(false);

    for (const tipo of ['cola', 'curriculo', 'triage', 'radar'] as const) {
      plan = completarBloqueAsignado(plan, tipo);
    }
    expect(planCompletado(plan)).toBe(true);
  });
});
