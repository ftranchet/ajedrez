// Plan diario persistente (RF-11.1): dominio puro, sin Dexie ni React.
//
// Existe porque la sesión guiada recalculaba su contenido en cada arranque:
// completar Patrones, volver a Hoy y tocar Repaso volvía a servir Patrones,
// porque "hecho hoy" era una insignia y no un estado del plan. La asignación
// se arma una sola vez por día local y después solo se consume: reanudar
// sirve lo que falta, y un bloque completado queda completado aunque se
// practique de nuevo.
import type { DailyAssignment, DailyAssignmentBlock, SessionBlockType, SessionRecord } from './types';
import { bloquesHechosHoy } from './session';

/** Clave del plan: día calendario local, 'YYYY-MM-DD'. */
export function dailyAssignmentId(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export interface DailyAssignmentInput {
  /** Tarjetas de la Cola vencidas hoy, en orden de servicio. */
  colaIds: string[];
  /** Patrones del currículo vencidos, ya intercalados y topados por la dieta. */
  curriculumIds: string[];
  /** Posiciones del bloque de criterio; 0 si la dieta no lo activó. */
  triageCount: number;
  /** Posiciones del Radar según la dieta; 0 si no hay catálogo. */
  radarCount: number;
}

/**
 * Arma el plan del día. Los bloques sin contenido no se listan (igual que en
 * el registro de sesión). Las sesiones de hoy ya registradas siembran el
 * estado: si el usuario completó un bloque antes de que existiera el plan
 * (una actualización a mitad de día, un plan borrado), no se le vuelve a
 * pedir. No se recupera el detalle por ítem — conservador: bloque hecho
 * cuenta entero como hecho.
 */
export function buildDailyAssignment(
  input: DailyAssignmentInput,
  sessionsHoy: SessionRecord[] = [],
  now: Date = new Date(),
): DailyAssignment {
  const hechos = bloquesHechosHoy(sessionsHoy, now);
  const bloque = (
    tipo: SessionBlockType,
    planificados: number,
    itemIds?: string[],
  ): DailyAssignmentBlock | null => {
    if (planificados <= 0) return null;
    const hecho = hechos.has(tipo);
    return {
      tipo,
      planificados,
      completados: hecho ? planificados : 0,
      ...(itemIds ? { itemIds, completadosIds: hecho ? [...itemIds] : [] } : {}),
      estado: hecho ? 'completado' : 'pendiente',
    };
  };
  const bloques = [
    bloque('cola', input.colaIds.length, input.colaIds),
    bloque('curriculo', input.curriculumIds.length, input.curriculumIds),
    bloque('triage', input.triageCount),
    bloque('radar', input.radarCount),
  ].filter((candidato): candidato is DailyAssignmentBlock => candidato !== null);
  return { id: dailyAssignmentId(now), creadoEn: now.toISOString(), bloques };
}

export function bloqueAsignado(assignment: DailyAssignment, tipo: SessionBlockType): DailyAssignmentBlock | null {
  return assignment.bloques.find((bloque) => bloque.tipo === tipo) ?? null;
}

/** Ids que faltan resolver de un bloque con ítems concretos, en orden. */
export function idsRestantes(bloque: DailyAssignmentBlock): string[] {
  if (!bloque.itemIds) return [];
  const hechos = new Set(bloque.completadosIds ?? []);
  return bloque.itemIds.filter((id) => !hechos.has(id));
}

/** Cantidad que falta de un bloque por cantidad (triage, radar). */
export function cantidadRestante(bloque: DailyAssignmentBlock): number {
  if (bloque.estado === 'completado') return 0;
  return Math.max(0, bloque.planificados - bloque.completados);
}

/**
 * Registra un ítem resuelto dentro del plan. Idempotente por ítem (un id ya
 * registrado no vuelve a contar) y sin efecto sobre un bloque ya completado:
 * practicar de nuevo no infla el plan. Llegar a `planificados` completa el
 * bloque.
 */
export function registrarItemAsignado(
  assignment: DailyAssignment,
  tipo: SessionBlockType,
  itemId?: string,
): DailyAssignment {
  return {
    ...assignment,
    bloques: assignment.bloques.map((bloque) => {
      if (bloque.tipo !== tipo || bloque.estado === 'completado') return bloque;
      if (itemId !== undefined && (bloque.completadosIds ?? []).includes(itemId)) return bloque;
      const completadosIds =
        itemId !== undefined && bloque.itemIds?.includes(itemId)
          ? [...(bloque.completadosIds ?? []), itemId]
          : bloque.completadosIds;
      const completados = Math.min(bloque.planificados, bloque.completados + 1);
      return {
        ...bloque,
        ...(completadosIds ? { completadosIds } : {}),
        completados,
        estado: completados >= bloque.planificados ? 'completado' : 'pendiente',
      };
    }),
  };
}

/**
 * Marca un bloque como completado aunque no haya llegado a `planificados`:
 * el bloque corrió hasta el final con menos contenido del planificado (un
 * ítem asignado que ya no existe, un pool que se achicó). Sin esto, el
 * bloque quedaría pendiente para siempre sirviendo vacío.
 */
export function completarBloqueAsignado(assignment: DailyAssignment, tipo: SessionBlockType): DailyAssignment {
  return {
    ...assignment,
    bloques: assignment.bloques.map((bloque) =>
      bloque.tipo === tipo && bloque.estado !== 'completado' ? { ...bloque, estado: 'completado' } : bloque,
    ),
  };
}

/**
 * Suma a la Cola del plan las tarjetas que vencieron después de armarlo (un
 * análisis del mediodía, RF-3.3). El Repaso es el único bloque sin tope y
 * sensible al tiempo: congelarlo pospondría repasos vencidos un día entero.
 * El invariante que el plan protege es otro — no volver a servir lo ya hecho —
 * y esto lo respeta: solo agrega ids nuevos, nunca reabre un bloque
 * completado (lo que venza después de terminarlo entra al plan de mañana), y
 * los demás bloques quedan congelados como se armaron.
 */
export function sincronizarColaConVencidas(assignment: DailyAssignment, dueIds: string[]): DailyAssignment {
  const bloque = bloqueAsignado(assignment, 'cola');
  if (bloque?.estado === 'completado') return assignment;
  const conocidos = new Set(bloque?.itemIds ?? []);
  const nuevos = dueIds.filter((id) => !conocidos.has(id));
  if (nuevos.length === 0) return assignment;
  if (!bloque) {
    const nuevoBloque: DailyAssignmentBlock = {
      tipo: 'cola',
      planificados: nuevos.length,
      completados: 0,
      itemIds: nuevos,
      completadosIds: [],
      estado: 'pendiente',
    };
    // La Cola va primera: mismo orden que la sesión guiada (RF-11.2).
    return { ...assignment, bloques: [nuevoBloque, ...assignment.bloques] };
  }
  return {
    ...assignment,
    bloques: assignment.bloques.map((candidato) =>
      candidato.tipo === 'cola'
        ? {
            ...candidato,
            itemIds: [...(candidato.itemIds ?? []), ...nuevos],
            planificados: candidato.planificados + nuevos.length,
          }
        : candidato,
    ),
  };
}

/** Posición dentro de un bloque, tal como se muestra: "Repaso {actual} de {total}". */
export interface ProgresoBloque {
  actual: number;
  total: number;
}

/**
 * Progreso de un bloque **contra el plan del día**, no contra la corrida.
 *
 * **El problema que corrige.** Cada panel contaba su propia tanda: el total era
 * la cantidad de ítems que quedaban al arrancar esa corrida y el actual, la
 * posición dentro de ella. Cualquier interrupción que termine la corrida
 * —volver a Hoy, recargar, la actualización automática de la PWA— hacía que la
 * siguiente sirviera solo lo que faltaba y el contador volviera a empezar
 * contra un total más chico: "Repaso 17 de 23" pasaba a "Repaso 5 de 7" sin
 * que el usuario hubiera hecho nada raro. Parecía aleatorio y era una resta.
 *
 * El plan del día ya sabe cuántos ítems se asignaron y cuántos van hechos, así
 * que el contador sale de ahí: es monótono y sobrevive a reanudar.
 *
 * `enFeedback` distingue "estoy resolviendo el ítem N" de "ya lo resolví": el
 * ítem se registra en el plan al responder, antes de mostrar el feedback.
 *
 * Sin plan utilizable —práctica libre, o un bloque ya completado que se repite—
 * no hay contra qué medir y se informa la corrida, que es exactamente lo que
 * esa repetición es.
 */
export function progresoDelBloque(
  bloque: DailyAssignmentBlock | null,
  corrida: { indice: number; total: number },
  enFeedback: boolean,
): ProgresoBloque {
  if (!bloque || bloque.estado === 'completado') {
    return { actual: Math.min(corrida.indice + 1, corrida.total), total: corrida.total };
  }
  return {
    actual: Math.min(bloque.completados + (enFeedback ? 0 : 1), bloque.planificados),
    total: bloque.planificados,
  };
}

/** ¿Se empezó algo del plan? Distingue "Empezar sesión" de "Continuar la sesión". */
export function planEmpezado(assignment: DailyAssignment): boolean {
  return assignment.bloques.some((bloque) => bloque.completados > 0 || bloque.estado === 'completado');
}

/** ¿Está todo el plan del día completado? */
export function planCompletado(assignment: DailyAssignment): boolean {
  return assignment.bloques.length > 0 && assignment.bloques.every((bloque) => bloque.estado === 'completado');
}
