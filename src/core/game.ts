import { Chess } from 'chess.js';
import type { Color, ContextoPartida, GameRecord, Resultado } from './types';

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
  /**
   * Lado que jugó el usuario: separa sus jugadas de las del rival en las
   * métricas de verdad (RF-12.1), las tarjetas de error y las posiciones de
   * Cálculo (RF-7.2).
   */
  jugadorColor?: Color;
  /** Elo del usuario en esta partida, cuando existe una fuente real. */
  ratingUsuario?: number;
  /** Contexto de la partida cuando no la eligió el usuario (hoy: el diagnóstico). */
  contexto?: ContextoPartida;
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
    ...(args.contexto ? { contexto: args.contexto } : {}),
  };
}

/**
 * Cantidad de medias jugadas de la partida, leída del PGN. A diferencia de
 * `tiemposPorJugadaMs.length` (que hoy solo se llena con un reloj real: las
 * partidas contra Maia o un PGN importado con `[%clk]`; las locales ya no se
 * cronometran, RF-1.5), esto vale para cualquier origen.
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
