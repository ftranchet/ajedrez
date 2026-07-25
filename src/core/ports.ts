// Puertos que el dominio expone y los services implementan (ADR-0001:
// ui → core → interfaces de services).
import type { GameRecord } from './types';

export interface EngineLevel {
  id: string;
  /**
   * Elo objetivo que se le pide al motor vía `UCI_LimitStrength` + `UCI_Elo`
   * (piso duro de Stockfish: 1320). Reemplaza al viejo `Skill Level`, que no
   * era una curva de dificultad sino fuerza casi plena con errores aleatorios
   * — ver `core/engineLevels.ts`.
   */
  uciElo: number;
  /** Presupuesto de tiempo por jugada del motor. */
  movetimeMs: number;
  /**
   * Probabilidad (0–1) de jugar una alternativa en vez de la mejor línea, para
   * bajar del piso de 1320 que impone `UCI_Elo`. Ausente o 0 = siempre la mejor.
   */
  imprecision?: number;
}

/** Resultado de evaluar una posición a máxima fuerza (E3, análisis en dos fases). */
export interface EngineEvaluation {
  /** Mejor jugada en UCI. */
  move: string;
  /** Centipeones desde la perspectiva de quien mueve en la posición analizada; null si hay mate forzado. */
  cp: number | null;
  /** Jugadas hasta el mate si `cp` es null (positivo = mate a favor de quien mueve). */
  mateIn: number | null;
}

export interface EnginePort {
  init(): Promise<void>;
  /** Devuelve la mejor jugada en notación UCI (p. ej. "e2e4", "e7e8q"). */
  bestMove(fen: string, level: EngineLevel): Promise<string>;
  /** Análisis a máxima fuerza por profundidad, para el análisis de partidas (RNF-3): sin Skill Level limitado. */
  evaluate(fen: string, depth: number): Promise<EngineEvaluation>;
  dispose(): void;
}

export interface GameRepo {
  save(game: GameRecord): Promise<void>;
  list(): Promise<GameRecord[]>;
}
