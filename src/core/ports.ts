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

export interface EnginePort {
  init(): Promise<void>;
  /** Devuelve la mejor jugada en notación UCI (p. ej. "e2e4", "e7e8q"). */
  bestMove(fen: string, level: EngineLevel): Promise<string>;
  dispose(): void;
}

export interface GameRepo {
  save(game: GameRecord): Promise<void>;
  list(): Promise<GameRecord[]>;
}
