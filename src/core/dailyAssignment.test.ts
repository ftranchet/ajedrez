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
  progresoDelBloque,
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

describe('progresoDelBloque', () => {
  // El bug reportado: "Repaso 5 de 7 cuando íbamos 17 de 23". No era aleatorio.
  // El contador medía la corrida —los ítems que faltaban al arrancarla— así que
  // al reanudar volvía a empezar contra un total más chico.
  const bloqueCola = (planificados: number, completados: number) => ({
    tipo: 'cola' as const,
    planificados,
    completados,
    estado: 'pendiente' as const,
  });

  it('cuenta contra el plan del día, no contra la corrida', () => {
    // 23 asignados, 16 hechos, y la corrida actual sirve los 7 que faltan.
    const reanudada = progresoDelBloque(bloqueCola(23, 16), { indice: 0, total: 7 }, false);
    expect(reanudada).toEqual({ actual: 17, total: 23 });
  });

  it('reanudar no hace retroceder el contador', () => {
    // La secuencia exacta del reporte: 17 de 23, corte, y las cuatro
    // siguientes. Antes daba 1..5 de 7; ahora sigue de largo hasta 21 de 23.
    const vistos = [0, 1, 2, 3, 4].map((i) =>
      progresoDelBloque(bloqueCola(23, 16 + i), { indice: i, total: 7 }, false),
    );
    expect(vistos.map((v) => v.actual)).toEqual([17, 18, 19, 20, 21]);
    expect(vistos.every((v) => v.total === 23)).toBe(true);
  });

  it('el feedback no adelanta el número: el ítem ya se registró al responder', () => {
    // Resolviendo el 17.º: jugando dice 17 y su feedback también.
    expect(progresoDelBloque(bloqueCola(23, 16), { indice: 0, total: 7 }, false).actual).toBe(17);
    expect(progresoDelBloque(bloqueCola(23, 17), { indice: 0, total: 7 }, true).actual).toBe(17);
  });

  it('nunca pasa del total planificado', () => {
    expect(progresoDelBloque(bloqueCola(23, 23), { indice: 0, total: 0 }, false)).toEqual({ actual: 23, total: 23 });
  });

  it('un plan recién empezado arranca en 1', () => {
    expect(progresoDelBloque(bloqueCola(23, 0), { indice: 0, total: 23 }, false)).toEqual({ actual: 1, total: 23 });
  });

  it('la práctica libre cuenta su propia corrida: no hay plan contra el cual medir', () => {
    // Bloque ya completado (repetir un bloque hecho) y ausencia de plan.
    const completado = { ...bloqueCola(23, 23), estado: 'completado' as const };
    expect(progresoDelBloque(completado, { indice: 2, total: 9 }, false)).toEqual({ actual: 3, total: 9 });
    expect(progresoDelBloque(null, { indice: 2, total: 9 }, false)).toEqual({ actual: 3, total: 9 });
  });

  it('sirve igual para los bloques por cantidad, que no llevan ids', () => {
    const radar = { tipo: 'radar' as const, planificados: 12, completados: 8, estado: 'pendiente' as const };
    expect(progresoDelBloque(radar, { indice: 0, total: 4 }, false)).toEqual({ actual: 9, total: 12 });
  });
});
