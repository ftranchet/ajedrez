// En qué orden conviene practicar los 16 finales teóricos (RF-6.2b).
//
// **El problema.** La lista se ofrecía en el orden en que está escrito el
// catálogo, y nada indicaba por dónde empezar: la Lucena —que recién importa
// cuando ya llegás a finales de torres— aparecía al lado del mate de rey y
// dama. Elegir quedaba a cargo del usuario sin ninguna información, que es
// exactamente el buffet que el producto dice no querer.
//
// **La decisión: se ordena, no se decide por vos.** Siguen estando los 16 y
// cualquiera se puede jugar cuando se quiera, incluido uno ya automatizado. Lo
// que cambia es el orden y que cada final dice **por qué** está donde está.
// Ordenar es una sugerencia; esconder sería una decisión ajena.
//
// **Con qué se ordena.** Cuatro señales, todas medidas, ninguna estimada:
//
// 1. *Que te aparezca de verdad.* Cuántas de tus partidas recientes llegaron a
//    ese tipo de final (core/finalesEnPartidas.ts). Es la señal más fuerte: un
//    final que ya se te presentó tres veces va a volver a presentarse.
// 2. *Qué tan mal te sale.* Fallos registrados sobre demostraciones hechas, y
//    si la **última** se te escapó. Ojo con `demostracionesLimpias`: es una
//    racha hacia la automatización que se resetea a cero con cada fallo, no un
//    contador de aciertos, así que `limpias / reps` **no** es una tasa de
//    acierto y usarla mostraría un porcentaje falso.
// 3. *Cuánto lo practicaste.* Lo nunca visto pesa más que lo ya trabajado.
// 4. *Cuánto tardás.* Tu tiempo típico en ese final contra tu propia mediana:
//    resolverlo al doble de lento es señal de que la técnica no está
//    automatizada aunque termine saliendo.
//
// **Sobre los pesos.** Son un criterio, no un resultado experimental. Se
// eligieron para que la señal de partidas propias domine y la de tiempo sea la
// más débil (la más ruidosa: una interrupción infla un tramo). Están todos
// juntos y con nombre para poder discutirlos; no hay ningún número mágico
// escondido en el medio del cálculo.
import type { CurriculumItem, CurriculumProgress, PatternKey, TrainingEvent } from './types';
import { isAutomatizado } from './curriculum';
import { isDue } from './scheduler';

const PESOS = {
  /** Por cada partida tuya que llegó a este final, hasta el tope. */
  porPartida: 12,
  topePartidas: 5,
  /** Multiplica la proporción de demostraciones falladas. */
  falla: 20,
  /** La última demostración se escapó: exacto y sin depender de FSRS. */
  ultimaFallada: 18,
  /** Nunca demostrado. */
  sinPracticar: 20,
  /** Vencido según la repetición espaciada. */
  vencido: 15,
  /** Multiplica cuánto más lento sos que tu propia mediana (tope 1 = el doble). */
  lentitud: 15,
  /** Ya automatizado: baja al fondo, pero sigue estando. */
  automatizado: -40,
} as const;

/** Por qué un final está donde está. La UI lo traduce a texto. */
export type MotivoPrioridad =
  | 'aparece-en-tus-partidas'
  | 'te-sale-mal'
  | 'sin-practicar'
  | 'tardas-mucho'
  | 'toca-repasarlo'
  | 'automatizado'
  | 'al-dia';

export interface SeñalesFinal {
  /** Partidas tuyas recientes que llegaron a este tipo de final. */
  partidas: number;
  /** Demostraciones hechas (limpias o no). */
  practicas: number;
  /** Fallos registrados por la repetición espaciada. */
  fallos: number;
  /** Fallos sobre demostraciones hechas; null si nunca se practicó. */
  tasaFallo: number | null;
  /**
   * La última demostración se escapó. Es exacto —`demostracionesLimpias` vuelve
   * a cero con cada fallo— y no depende de cómo FSRS cuente sus lapsos.
   */
  ultimaFallada: boolean;
  /** Demostraciones limpias seguidas; 3 automatizan la técnica (RF-6.3). */
  rachaLimpia: number;
  /** Segundos que tardás típicamente; null si no hay tiempo medido. */
  segundosTipicos: number | null;
  /** Tu tiempo contra tu propia mediana (1 = igual); null sin datos. */
  lentitudRelativa: number | null;
  vencido: boolean;
  automatizado: boolean;
}

export interface FinalPriorizado {
  item: CurriculumItem;
  progress: CurriculumProgress | undefined;
  prioridad: number;
  motivo: MotivoPrioridad;
  señales: SeñalesFinal;
}

/** Mediana: resiste el tramo enorme de la sesión que quedó abierta. */
function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1]! + ordenados[medio]!) / 2
    : ordenados[medio]!;
}

/**
 * Segundos por ítem, de los tramos medidos. El `refId` de un final es
 * `itemId:inicio`, así que el id del ítem es todo lo anterior al último `:`.
 */
function segundosPorItem(eventos: TrainingEvent[]): Map<string, number[]> {
  const porItem = new Map<string, number[]>();
  for (const evento of eventos) {
    if (evento.modalidad !== 'final' || !evento.refId) continue;
    const itemId = evento.refId.slice(0, evento.refId.lastIndexOf(':'));
    if (!itemId) continue;
    const previos = porItem.get(itemId) ?? [];
    previos.push(evento.ms / 1000);
    porItem.set(itemId, previos);
  }
  return porItem;
}

function señalesDe(
  progress: CurriculumProgress | undefined,
  partidas: number,
  segundos: number[] | undefined,
  medianaGlobal: number | null,
  ahora: Date,
): SeñalesFinal {
  const practicas = progress?.fsrs.reps ?? 0;
  const fallos = progress?.fsrs.lapses ?? 0;
  const rachaLimpia = progress?.demostracionesLimpias ?? 0;
  const segundosTipicos = mediana(segundos ?? []);
  return {
    partidas,
    practicas,
    fallos,
    tasaFallo: practicas > 0 ? Math.min(1, fallos / practicas) : null,
    ultimaFallada: practicas > 0 && rachaLimpia === 0,
    rachaLimpia,
    segundosTipicos,
    lentitudRelativa:
      segundosTipicos !== null && medianaGlobal !== null && medianaGlobal > 0
        ? segundosTipicos / medianaGlobal
        : null,
    vencido: progress === undefined || isDue(progress.fsrs, ahora),
    automatizado: progress !== undefined && isAutomatizado(progress),
  };
}

/** El motivo dominante: el que más aportó al puntaje, con desempate estable. */
function motivoDe(señales: SeñalesFinal): MotivoPrioridad {
  if (señales.automatizado) return 'automatizado';
  const candidatos: Array<[MotivoPrioridad, number]> = [
    ['aparece-en-tus-partidas', Math.min(señales.partidas, PESOS.topePartidas) * PESOS.porPartida],
    ['te-sale-mal', puntajeDeFalla(señales)],
    ['sin-practicar', señales.practicas === 0 ? PESOS.sinPracticar : 0],
    [
      'tardas-mucho',
      señales.lentitudRelativa !== null && señales.lentitudRelativa > 1
        ? Math.min(señales.lentitudRelativa - 1, 1) * PESOS.lentitud
        : 0,
    ],
    ['toca-repasarlo', señales.vencido ? PESOS.vencido : 0],
  ];
  const mejor = candidatos.reduce((a, b) => (b[1] > a[1] ? b : a));
  return mejor[1] > 0 ? mejor[0] : 'al-dia';
}

/** Lo que aporta "te sale mal": lo acumulado más lo más reciente. */
function puntajeDeFalla(señales: SeñalesFinal): number {
  return (señales.tasaFallo ?? 0) * PESOS.falla + (señales.ultimaFallada ? PESOS.ultimaFallada : 0);
}

function puntajeDe(señales: SeñalesFinal): number {
  let total = 0;
  total += Math.min(señales.partidas, PESOS.topePartidas) * PESOS.porPartida;
  total += puntajeDeFalla(señales);
  if (señales.practicas === 0) total += PESOS.sinPracticar;
  if (señales.vencido) total += PESOS.vencido;
  if (señales.lentitudRelativa !== null && señales.lentitudRelativa > 1) {
    total += Math.min(señales.lentitudRelativa - 1, 1) * PESOS.lentitud;
  }
  if (señales.automatizado) total += PESOS.automatizado;
  return total;
}

/**
 * Los finales ordenados por lo que conviene practicar primero. Devuelve **todos**
 * —incluidos los automatizados, al fondo—: la lista es una sugerencia de orden,
 * no un filtro.
 *
 * `partidasPorPatron` sale de `finalesDeTusPartidas`; `eventos`, del registro de
 * tiempo entrenado. Sin ninguno de los dos la función sigue funcionando: se
 * ordena con lo que haya, que el primer día es solo la repetición espaciada.
 */
export function priorizarFinales(
  items: CurriculumItem[],
  progressById: Map<string, CurriculumProgress>,
  opciones: {
    partidasPorPatron?: Map<PatternKey, number>;
    eventos?: TrainingEvent[];
    ahora?: Date;
  } = {},
): FinalPriorizado[] {
  const ahora = opciones.ahora ?? new Date();
  const finales = items.filter((item) => item.tipo === 'final');
  const tiempos = segundosPorItem(opciones.eventos ?? []);
  // La referencia es el propio usuario: "tardás mucho" solo significa algo
  // comparado con lo que tardás vos en los demás finales.
  const medianaGlobal = mediana([...tiempos.values()].flat());

  return finales
    .map((item) => {
      const progress = progressById.get(item.id);
      const señales = señalesDe(
        progress,
        opciones.partidasPorPatron?.get(item.patternKey) ?? 0,
        tiempos.get(item.id),
        medianaGlobal,
        ahora,
      );
      return { item, progress, señales, prioridad: puntajeDe(señales), motivo: motivoDe(señales) };
    })
    // Empate: se conserva el orden del catálogo, que va de lo elemental a lo
    // avanzado. Sin esto, dos finales idénticos en señales se ordenarían al
    // azar entre visitas y la lista se movería sola.
    .sort((a, b) => b.prioridad - a.prioridad || finales.indexOf(a.item) - finales.indexOf(b.item));
}
