import { Chess } from 'chess.js';
import type { Color, GameRecord, Resultado } from './types';

export interface ResultInput {
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  /** Color al que le toca mover en la posición final. */
  turn: Color;
  resignedBy?: Color;
}

/** Deriva el resultado PGN de una partida terminada. */
export function deriveResult(i: ResultInput): Resultado {
  if (i.resignedBy) return i.resignedBy === 'w' ? '0-1' : '1-0';
  if (i.isCheckmate) return i.turn === 'w' ? '0-1' : '1-0';
  if (i.isStalemate || i.isDraw) return '1/2-1/2';
  return '*';
}

export interface BuildGameArgs {
  pgn: string;
  resultado: Resultado;
  tiemposPorJugadaMs: number[];
  fuente: GameRecord['fuente'];
  ritmo: GameRecord['ritmo'];
  fecha?: string;
  id?: string;
  /** Lado que jugó el usuario (partidas locales contra el motor, RF-9.1). */
  jugadorColor?: Color;
  /** Elo del usuario en esta partida, cuando existe una fuente real. */
  ratingUsuario?: number;
}

export function buildGameRecord(args: BuildGameArgs): GameRecord {
  return {
    id: args.id ?? crypto.randomUUID(),
    pgn: args.pgn,
    fuente: args.fuente,
    ritmo: args.ritmo,
    resultado: args.resultado,
    tiemposPorJugadaMs: args.tiemposPorJugadaMs,
    analizada: false,
    fecha: args.fecha ?? new Date().toISOString(),
    ...(args.jugadorColor ? { jugadorColor: args.jugadorColor } : {}),
    ...(args.ratingUsuario !== undefined ? { ratingUsuario: args.ratingUsuario } : {}),
  };
}

/**
 * Cantidad de medias jugadas de la partida, leída del PGN. A diferencia de
 * `tiemposPorJugadaMs.length` (que solo tiene datos para partidas jugadas
 * localmente, RF-1.5), esto vale para cualquier origen — incluida una
 * importada por PGN (RF-2.2), donde `tiemposPorJugadaMs` siempre está vacío.
 */
export function plyCountFromPgn(pgn: string): number {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return 0;
  }
  return chess.history().length;
}
