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
// para la partida lenta y Stoyko, el vencimiento para los finales, la fecha del
// último intento para Cálculo), así que no hace falta persistir nada nuevo.
import type { CompromisoAttempt, GameRecord, Profile } from './types';
import { partidaLentaSemanal } from './slowGame';
import { stoykoDisponible, stoykoProximaDisponibleEn } from './stoyko';
import type { AjusteFugaCalculo } from './prescriptor';

export type PrescripcionExternaTipo = 'partida-lenta' | 'finales' | 'stoyko' | 'compromiso';

export type PrescripcionEstado =
  /** Corresponde hacerla hoy. */
  | 'pendiente'
  /** Ya cumplida en su período; se muestra igual, en segundo plano. */
  | 'cumplida'
  /** No corresponde todavía (Stoyko en enfriamiento). */
  | 'en-espera';

export interface PrescripcionExterna {
  tipo: PrescripcionExternaTipo;
  estado: PrescripcionEstado;
  /** Duración estimada, en la misma unidad que los bloques de la sesión. */
  minutos: number;
  /** Ruta hash a la pantalla donde se hace. */
  ruta: string;
  /** Dato que acompaña el texto (finales pendientes, día de reaparición). */
  cantidad?: number;
  fecha?: string;
  /** En espera porque nunca se hizo (escalonamiento inicial), no por el
   * enfriamiento semanal: el texto del motivo es distinto. */
  primeraVez?: boolean;
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

/**
 * El primer Stoyko no se prescribe el mismo día del diagnóstico: los primeros
 * días ya cargan con la sesión, la partida lenta semanal y los finales. La
 * pantalla de Cálculo queda disponible igual — esto escalona la prescripción,
 * no bloquea el ejercicio.
 */
const STOYKO_ESPERA_INICIAL_DIAS = 3;

const DIA_MS = 24 * 60 * 60 * 1000;

export interface EntradaPrescripciones {
  games: GameRecord[];
  finalesPendientes: number;
  profile: Pick<Profile, 'stoykoUltimaCompletadaEn' | 'diagnosticoCompletadoEn'>;
  compromisoAttempts: CompromisoAttempt[];
  fugaCalculo: AjusteFugaCalculo;
  now?: Date;
}

/** ¿Se hizo hoy algún ejercicio de línea comprometida? */
function compromisoHechoHoy(attempts: CompromisoAttempt[], now: Date): boolean {
  const inicioDelDia = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return attempts.some((attempt) => {
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

  const partidaLenta = partidaLentaSemanal(entrada.games, now);
  prescripciones.push({
    tipo: 'partida-lenta',
    estado: partidaLenta === 'completa' ? 'cumplida' : 'pendiente',
    minutos: partidaLenta === 'sin-analizar' ? 20 : MINUTOS['partida-lenta'],
    ruta: partidaLenta === 'sin-analizar' ? '#/panel/partidas' : '#/jugar',
  });

  if (entrada.finalesPendientes > 0) {
    const finalesHoy = Math.min(entrada.finalesPendientes, FINALES_POR_DIA);
    prescripciones.push({
      tipo: 'finales',
      estado: 'pendiente',
      minutos: MINUTOS.finales * finalesHoy,
      ruta: '#/jugar/finales',
      cantidad: finalesHoy,
    });
  }

  const primerStoykoDesde = !entrada.profile.stoykoUltimaCompletadaEn && entrada.profile.diagnosticoCompletadoEn
    ? new Date(new Date(entrada.profile.diagnosticoCompletadoEn).getTime() + STOYKO_ESPERA_INICIAL_DIAS * DIA_MS)
    : null;
  const proximoStoyko = stoykoProximaDisponibleEn(entrada.profile, now);
  prescripciones.push(
    primerStoykoDesde && now.getTime() < primerStoykoDesde.getTime()
      ? {
          tipo: 'stoyko',
          estado: 'en-espera',
          minutos: MINUTOS.stoyko,
          ruta: '#/calculo/stoyko',
          fecha: primerStoykoDesde.toISOString(),
          primeraVez: true,
        }
      : stoykoDisponible(entrada.profile, now)
        ? { tipo: 'stoyko', estado: 'pendiente', minutos: MINUTOS.stoyko, ruta: '#/calculo/stoyko' }
        : {
            tipo: 'stoyko',
            estado: 'en-espera',
            minutos: MINUTOS.stoyko,
            ruta: '#/calculo/stoyko',
            ...(proximoStoyko ? { fecha: proximoStoyko } : {}),
          },
  );

  if (entrada.fugaCalculo.activa) {
    prescripciones.push({
      tipo: 'compromiso',
      estado: compromisoHechoHoy(entrada.compromisoAttempts, now) ? 'cumplida' : 'pendiente',
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
