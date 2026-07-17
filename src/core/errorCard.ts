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
