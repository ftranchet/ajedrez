// Cola Universal de errores (E4): construir y repasar tarjetas. Una sola
// cola para fallos de partida, Radar, final o apertura (RF-4.1); sin silos.
import type { CategoriaError, Color, ErrorCard, OrigenTarjeta } from './types';
import { isDue, newFsrsState, reviewFsrsState } from './scheduler';
import { dailyAssignmentId } from './dailyAssignment';

export interface BuildErrorCardArgs {
  fen: string;
  ladoAMover: Color;
  jugadaUsuario: string;
  jugadaCorrecta: string;
  categoria: CategoriaError;
  origen: OrigenTarjeta;
  id?: string;
  now?: Date;
}

export function buildErrorCard(args: BuildErrorCardArgs): ErrorCard {
  const now = args.now ?? new Date();
  return {
    id: args.id ?? crypto.randomUUID(),
    fen: args.fen,
    ladoAMover: args.ladoAMover,
    jugadaUsuario: args.jugadaUsuario,
    jugadaCorrecta: args.jugadaCorrecta,
    categoria: args.categoria,
    origen: args.origen,
    fsrs: newFsrsState(now),
    creadaEn: now.toISOString(),
  };
}

/** Aplica el resultado de un repaso (RF-4.2): no muta, devuelve una tarjeta nueva. */
export function reviewErrorCard(card: ErrorCard, acierto: boolean, now: Date = new Date()): ErrorCard {
  return { ...card, fsrs: reviewFsrsState(card.fsrs, acierto, now) };
}

/** Tarjetas vencidas, más antiguas primero: van al frente de cada sesión (RF-4.4). */
export function dueErrorCards(cards: ErrorCard[], now: Date = new Date()): ErrorCard[] {
  return cards
    .filter((c) => isDue(c.fsrs, now))
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime());
}

/** Tarjetas "sanguijuela": fallan repetidamente (RF-4.6). */
export function leechCards(cards: ErrorCard[], umbralLapsos = 5): ErrorCard[] {
  return cards.filter((c) => c.fsrs.lapses > umbralLapsos);
}

/**
 * Identidad ajedrecística de una tarjeta: misma posición y misma respuesta
 * correcta. Dos fallos de la misma posición (p. ej. un ítem del Radar que
 * reaparece, o el mismo error en dos análisis) no deben crear dos tarjetas
 * distintas — la Cola es una sola cola sin duplicados (E4).
 */
export function tarjetaEquivalente(cards: ErrorCard[], fen: string, jugadaCorrecta: string): ErrorCard | undefined {
  return cards.find((c) => c.fen === fen && c.jugadaCorrecta === jugadaCorrecta);
}

/**
 * Tope diario de tarjetas nuevas por defecto (RF-4.5): evita avalanchas de
 * repaso. Limita cuántas tarjetas nuevas **entran a repaso** cada día, no
 * cuántas se **crean** (el criterio de Anki con su límite de nuevas por día):
 * antes, pasado el tope la tarjeta no se creaba y el error confirmado se
 * perdía para siempre —la partida ya quedaba analizada y no se volvía a
 * ofrecer—, que en un análisis exprés de un lote era el caso normal.
 */
export const TOPE_DIARIO_NUEVAS = 10;

/**
 * Día local en que una tarjeta entra (o entró) a repaso: el que fijó el tope
 * al diferirla (`entraEn`), o el de su creación. Día local y no UTC: en UTC−3
 * el día UTC cambia a las 21:00 y una tarjeta del mediodía dejaba de contar a
 * la noche (B3).
 *
 * Las tarjetas diferidas antes de que existiera `entraEn` no lo traen: para
 * ellas se usa su `due` mientras sigan sin repasar, que es lo mejor que se
 * puede deducir.
 */
function diaDeEntrada(card: ErrorCard): string {
  if (card.entraEn) return card.entraEn;
  const creada = new Date(card.creadaEn);
  const due = new Date(card.fsrs.due);
  return dailyAssignmentId(card.fsrs.state === 'new' && due > creada ? due : creada);
}

/** ¿La tarjeta todavía espera el día en que entra a repaso? */
function esperaSuDia(card: ErrorCard, now: Date): boolean {
  return card.fsrs.state === 'new' && new Date(card.fsrs.due).getTime() > now.getTime();
}

/** Cuántas tarjetas nuevas entran a repaso hoy (día local), para el tope de RF-4.5. */
export function tarjetasNuevasHoy(cards: ErrorCard[], now: Date = new Date()): number {
  const hoy = dailyAssignmentId(now);
  return cards.filter((c) => diaDeEntrada(c) === hoy).length;
}

export type AltaTarjeta =
  | {
      accion: 'crear';
      card: ErrorCard;
      /** Solo si el cupo de hoy estaba lleno: instante (ISO) en que la tarjeta entra a repaso. */
      diferidaHasta?: string;
    }
  | {
      accion: 'reforzar';
      card: ErrorCard;
      /** Solo si la tarjeta todavía espera su día de entrada: instante (ISO) en que entra a repaso. */
      diferidaHasta?: string;
    };

/**
 * Decide qué hacer ante un nuevo fallo, antes de tocar el almacenamiento
 * (RF-4.1/4.5):
 * - si ya existe una tarjeta con la misma identidad → **reforzar** (un fallo
 *   sobre la existente, que adelanta su repaso), en vez de duplicar. Si esa
 *   tarjeta todavía espera su día de entrada, queda como está y se devuelve
 *   ese día, para avisar que no entra hoy: el error ya está registrado, y
 *   adelantarla a hoy la sumaría por encima del cupo (el mismo error de
 *   apertura repetido en dos partidas de un lote exprés);
 * - si no → **crear** una tarjeta nueva, siempre. Si el cupo de hoy ya está
 *   lleno, la tarjeta nace con su `due` en el inicio del primer día local con
 *   cupo, y ese día queda fijado en `entraEn`: el excedente se reparte de a
 *   `topeDiario` por día, y lo ya diferido ocupa el cupo de su día aunque se
 *   haya repasado, así que lo nuevo de mañana va detrás y no se suma.
 *   `creadaEn` sigue siendo el instante real del fallo.
 *
 * El cupo cuenta tarjetas de todos los orígenes: la carga de repaso del día es
 * una sola. Lo que cambió (ADR-0017) es que el cupo lleno ya no impide crear la
 * tarjeta, solo demora su entrada.
 */
export function altaErrorCard(
  cards: ErrorCard[],
  args: BuildErrorCardArgs,
  opts: { topeDiario?: number } = {},
): AltaTarjeta {
  const now = args.now ?? new Date();
  const existente = tarjetaEquivalente(cards, args.fen, args.jugadaCorrecta);
  if (existente) {
    if (esperaSuDia(existente, now)) return { accion: 'reforzar', card: existente, diferidaHasta: existente.fsrs.due };
    return { accion: 'reforzar', card: reviewErrorCard(existente, false, now) };
  }
  const card = buildErrorCard({ ...args, now });
  // Con un tope menor a 1 ningún día tendría cupo y la búsqueda no terminaría.
  const tope = Math.max(1, Math.floor(opts.topeDiario ?? TOPE_DIARIO_NUEVAS));
  const entradasPorDia = new Map<string, number>();
  for (const c of cards) {
    const dia = diaDeEntrada(c);
    entradasPorDia.set(dia, (entradasPorDia.get(dia) ?? 0) + 1);
  }
  let dias = 0;
  while ((entradasPorDia.get(dailyAssignmentId(inicioDelDiaLocal(now, dias))) ?? 0) >= tope) dias += 1;
  if (dias === 0) return { accion: 'crear', card };
  const inicio = inicioDelDiaLocal(now, dias);
  const diferidaHasta = inicio.toISOString();
  return {
    accion: 'crear',
    card: { ...card, fsrs: { ...card.fsrs, due: diferidaHasta }, entraEn: dailyAssignmentId(inicio) },
    diferidaHasta,
  };
}

/** Medianoche local de `dias` días después de `now` (el constructor de Date resuelve fin de mes y horario de verano). */
function inicioDelDiaLocal(now: Date, dias: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dias);
}
