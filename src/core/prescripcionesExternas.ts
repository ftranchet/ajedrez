// Prescripciones que se hacen fuera de la sesión (E11, principio 1).
//
// La sesión diaria es una secuencia de posiciones de una jugada, y por eso
// contiene Cola, patrones, criterio y Radar. Pero cuatro de los ejercicios con
// más respaldo de la app **no caben en ese formato**: una partida lenta y su
// análisis, un final jugado entero contra Stockfish, un Stoyko sin reloj y una
// línea comprometida declarada por escrito. Vivían en otras pantallas y el
// Prescriptor no los nombraba nunca — Cálculo era una de las cuatro pestañas de
// la navegación y ninguna prescripción la mencionaba salvo por una nota al pie
// condicionada a una fuga que un usuario nuevo no puede tener. Es exactamente
// el buffet que el principio 1 dice no querer.
//
// Este módulo las devuelve como prescripciones de primera clase, con el mismo
// contrato que un bloque: qué es, por qué aparece hoy y cuánto dura. Cada una
// sabe además si ya está cumplida, con la señal que le es propia (la semana
// para la partida lenta y Stoyko, los finales jugados hoy según el
// planificador, la fecha del último intento para Cálculo), así que no hace
// falta persistir nada nuevo.
import type { CalculoAttempt, GameRecord, Profile } from './types';
import { partidaLentaSemanal } from './slowGame';
import { stoykoDisponible, stoykoProximaDisponibleEn } from './stoyko';
import { presupuestoPorSesion } from './duracion';
import type { AjusteFugaCalculo } from './prescriptor';

export type PrescripcionExternaTipo = 'partida-lenta' | 'finales' | 'stoyko' | 'compromiso';

export type PrescripcionEstado =
  /** Corresponde hacerla hoy. */
  | 'pendiente'
  /** Ya cumplida en su período; se muestra igual, en segundo plano. */
  | 'cumplida'
  /** No corresponde todavía (Stoyko en enfriamiento). */
  | 'en-espera';

/**
 * Cuándo toca hacerla. Separar "hoy" de "esta semana" es la diferencia entre
 * un plan y una lista de deudas: la partida lenta y el Stoyko son semanales
 * por definición —así se llaman en la propia interfaz—, y presentarlos como
 * tareas de hoy hacía que una cuenta nueva viera unos 83 minutos "para hoy",
 * casi el plan semanal completo, el primer día.
 */
export type PrescripcionCadencia = 'hoy' | 'esta-semana';

export interface PrescripcionExterna {
  tipo: PrescripcionExternaTipo;
  estado: PrescripcionEstado;
  cadencia: PrescripcionCadencia;
  /** Duración estimada, en la misma unidad que los bloques de la sesión. */
  minutos: number;
  /** Ruta hash a la pantalla donde se hace. */
  ruta: string;
  /** Dato que acompaña el texto: finales que faltan hoy —o los ya hechos, si
   * está cumplida—, porcentaje de fallos en cálculo, día de reaparición. */
  cantidad?: number;
  fecha?: string;
  /** Se movió a "esta semana" porque hoy no entra en el presupuesto declarado. */
  fueraDePresupuesto?: boolean;
}

/** Estimaciones honestas: una partida lenta con su análisis no entra en 25 min,
 * y un final jugado entero contra el motor lleva estos minutos **cada uno**. */
const MINUTOS = {
  'partida-lenta': 45,
  finales: 8,
  stoyko: 15,
  compromiso: 6,
} as const satisfies Record<PrescripcionExternaTipo, number>;

/**
 * Tope diario de finales prescriptos. Sin él, una cuenta nueva veía el catálogo
 * entero (8 técnicas no vistas) como deuda de hoy — con una estimación de 8
 * minutos totales que en realidad eran más de 60. La deuda real sigue viva en
 * el catálogo; lo que se prescribe para hoy es una porción hacible.
 */
const FINALES_POR_DIA = 2;

export interface EntradaPrescripciones {
  games: GameRecord[];
  finalesPendientes: number;
  /** Finales que ya se jugaron hoy contando para el plan (`finalesJugadosHoy`). */
  finalesHechosHoy?: number;
  profile: Pick<Profile, 'stoykoUltimaCompletadaEn' | 'planSemanal'>;
  /** Intentos del ejercicio de cálculo (ADR-0015). El preset corto es el que
   * se prescribe para hoy, así que es el que declara su cumplimiento. */
  calculoAttempts: Pick<CalculoAttempt, 'preset' | 'fecha'>[];
  fugaCalculo: AjusteFugaCalculo;
  /** Minutos que ya ocupa la sesión del día; se descuentan del presupuesto. */
  minutosSesion?: number;
  now?: Date;
}

/** ¿Se hizo hoy el ejercicio corto de cálculo (preset forzado)? */
function compromisoHechoHoy(attempts: Pick<CalculoAttempt, 'preset' | 'fecha'>[], now: Date): boolean {
  const inicioDelDia = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return attempts.some((attempt) => {
    if (attempt.preset !== 'forzado') return false;
    const t = new Date(attempt.fecha).getTime();
    return Number.isFinite(t) && t >= inicioDelDia && t <= now.getTime();
  });
}

/**
 * Las prescripciones de hoy que se hacen en otra pantalla, ordenadas por valor
 * documentado: la partida lenta con su análisis es tier-S en `docs/evidence/`,
 * así que encabeza siempre; después las técnicas de final vencidas, el Stoyko
 * de la semana y, si hay señal de que las líneas forzadas se están fallando, el
 * cálculo comprometido.
 *
 * Las cumplidas no se ocultan: verlas cumplidas es la mitad del valor de tener
 * un plan. Lo que no aparece nunca es una prescripción sin motivo — si no hay
 * finales vencidos ni fuga de cálculo, esas entradas no se listan.
 */
export function prescripcionesExternas(entrada: EntradaPrescripciones): PrescripcionExterna[] {
  const now = entrada.now ?? new Date();
  const prescripciones: PrescripcionExterna[] = [];

  // Lo que el usuario declaró tener por sesión, menos lo que ya ocupa la
  // sesión del día: ese resto es todo lo que se puede pedir hoy además.
  const presupuesto = Math.max(0, presupuestoPorSesion(entrada.profile.planSemanal) - (entrada.minutosSesion ?? 0));

  const partidaLenta = partidaLentaSemanal(entrada.games, now);
  prescripciones.push({
    tipo: 'partida-lenta',
    estado: partidaLenta === 'completa' ? 'cumplida' : 'pendiente',
    // Semanal por definición, incluso en su nombre ("tu partida lenta de la
    // semana"): pedirla hoy, todos los días, es lo que hacía que el primer
    // día pareciera imposible.
    cadencia: 'esta-semana',
    minutos: partidaLenta === 'sin-analizar' ? 20 : MINUTOS['partida-lenta'],
    ruta: partidaLenta === 'sin-analizar' ? '#/panel/partidas' : '#/jugar',
  });

  const finalesHechosHoy = entrada.finalesHechosHoy ?? 0;
  if (entrada.finalesPendientes > 0 || finalesHechosHoy > 0) {
    // Los finales sí vencen día a día (FSRS), así que son la carga diaria que
    // el presupuesto tiene que acotar: entran los que quepan, y si no entra
    // ninguno la técnica no desaparece — pasa a la semana, dicho como tal.
    const cabenHoy = Math.floor(presupuesto / MINUTOS.finales);
    const objetivoHoy = Math.min(entrada.finalesPendientes + finalesHechosHoy, FINALES_POR_DIA, Math.max(0, cabenHoy));
    // Lo que falta, no lo que había: haber jugado uno de los dos que tocaban
    // tiene que verse como "queda uno", y haberlos jugado todos, como hecho.
    const restantes = Math.min(entrada.finalesPendientes, Math.max(0, objetivoHoy - finalesHechosHoy));
    const cumplida = finalesHechosHoy > 0 && restantes === 0;
    const cantidad = cumplida ? finalesHechosHoy : Math.max(1, restantes);
    const entraHoy = cumplida || restantes > 0;
    prescripciones.push({
      tipo: 'finales',
      estado: cumplida ? 'cumplida' : 'pendiente',
      cadencia: entraHoy ? 'hoy' : 'esta-semana',
      ...(entraHoy ? {} : { fueraDePresupuesto: true }),
      minutos: MINUTOS.finales * cantidad,
      ruta: '#/jugar/finales',
      cantidad,
    });
  }

  const proximoStoyko = stoykoProximaDisponibleEn(entrada.profile, now);
  // Stoyko es semanal por definición ("Stoyko de la semana") y está disponible
  // desde el primer día: se hace cuando el usuario quiera dentro de la semana.
  //
  // Antes el primero se escalonaba tres días después del diagnóstico, para no
  // cargar los primeros días. Eso quedó resuelto por la separación entre "hoy"
  // y "esta semana" —Stoyko nunca infló la lista de hoy—, y el escalonamiento
  // se volvió una promesa que la interfaz no podía cumplir: la tarjeta anuncia
  // el día ("se suma a tu plan el 29/7") pero la comparación era contra el
  // instante exacto del diagnóstico, así que ese mismo día seguía en espera
  // hasta la hora en que se había completado (bug reportado 2026-07-29).
  prescripciones.push(
    stoykoDisponible(entrada.profile, now)
      ? { tipo: 'stoyko', estado: 'pendiente', cadencia: 'esta-semana', minutos: MINUTOS.stoyko, ruta: '#/calculo/stoyko' }
      : {
          tipo: 'stoyko',
          estado: 'en-espera',
          cadencia: 'esta-semana',
          minutos: MINUTOS.stoyko,
          ruta: '#/calculo/stoyko',
          ...(proximoStoyko ? { fecha: proximoStoyko } : {}),
        },
  );

  if (entrada.fugaCalculo.activa) {
    // Seis minutos: el ejercicio corto. Entra hoy salvo que no quede nada de
    // presupuesto, y ahí espera a la semana como los demás.
    const entraHoy = presupuesto >= MINUTOS.compromiso;
    prescripciones.push({
      tipo: 'compromiso',
      estado: compromisoHechoHoy(entrada.calculoAttempts, now) ? 'cumplida' : 'pendiente',
      cadencia: entraHoy ? 'hoy' : 'esta-semana',
      ...(entraHoy ? {} : { fueraDePresupuesto: true }),
      minutos: MINUTOS.compromiso,
      ruta: '#/calculo',
      cantidad: Math.round((entrada.fugaCalculo.fallos / entrada.fugaCalculo.total) * 100),
    });
  }

  return prescripciones;
}

/** Cuántas prescripciones externas quedan por hacer hoy, para el resumen de Hoy. */
export function prescripcionesPendientes(prescripciones: PrescripcionExterna[]): number {
  return prescripciones.filter((prescripcion) => prescripcion.estado === 'pendiente').length;
}

/** Las de una cadencia, conservando el orden por valor documentado. */
export function prescripcionesDe(
  prescripciones: PrescripcionExterna[],
  cadencia: PrescripcionCadencia,
): PrescripcionExterna[] {
  return prescripciones.filter((prescripcion) => prescripcion.cadencia === cadencia);
}
