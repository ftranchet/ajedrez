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
  };
}
