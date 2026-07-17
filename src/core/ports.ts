// Puertos que el dominio expone y los services implementan (ADR-0001:
// ui → core → interfaces de services).
import type { GameRecord } from './types';

export interface EngineLevel {
  id: string;
  /** Skill Level de Stockfish (0–20). */
  skill: number;
  /** Presupuesto de tiempo por jugada del motor. */
  movetimeMs: number;
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
