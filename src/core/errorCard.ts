// Cola Universal de errores (E4): construir y repasar tarjetas. Una sola
// cola para fallos de partida, Radar, final o apertura (RF-4.1); sin silos.
import type { CategoriaError, Color, ErrorCard, OrigenTarjeta } from './types';
import { isDue, newFsrsState, reviewFsrsState } from './scheduler';

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

/** Tope diario de tarjetas nuevas por defecto (RF-4.5): evita avalanchas de repaso. */
export const TOPE_DIARIO_NUEVAS = 10;

/** Cuántas tarjetas nuevas se crearon hoy (por `creadaEn`), para el tope de RF-4.5. */
export function tarjetasNuevasHoy(cards: ErrorCard[], now: Date = new Date()): number {
  const hoy = now.toISOString().slice(0, 10);
  return cards.filter((c) => c.creadaEn.slice(0, 10) === hoy).length;
}

export type AltaTarjeta =
  | { accion: 'crear'; card: ErrorCard }
  | { accion: 'reforzar'; card: ErrorCard }
  | { accion: 'omitir' };

/**
 * Decide qué hacer ante un nuevo fallo, antes de tocar el almacenamiento
 * (RF-4.1/4.5):
 * - si ya existe una tarjeta con la misma identidad → **reforzar** (un fallo
 *   sobre la existente, que adelanta su repaso), en vez de duplicar;
 * - si no existe pero ya se alcanzó el tope diario de tarjetas nuevas → **omitir**;
 * - si no → **crear** una tarjeta nueva.
 */
export function altaErrorCard(
  cards: ErrorCard[],
  args: BuildErrorCardArgs,
  opts: { topeDiario?: number } = {},
): AltaTarjeta {
  const now = args.now ?? new Date();
  const tope = opts.topeDiario ?? TOPE_DIARIO_NUEVAS;
  const existente = tarjetaEquivalente(cards, args.fen, args.jugadaCorrecta);
  if (existente) return { accion: 'reforzar', card: reviewErrorCard(existente, false, now) };
  if (tarjetasNuevasHoy(cards, now) >= tope) return { accion: 'omitir' };
  return { accion: 'crear', card: buildErrorCard(args) };
}
