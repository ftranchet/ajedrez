// Puertos que el dominio expone y los services implementan (ADR-0001:
// ui → core → interfaces de services).
import type { Color, GameRecord } from './types';

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

/** Estado de una partida de Lichess, tal como llega por su stream (RF-1.4). */
export interface EstadoPartidaLichess {
  /** Jugadas en UCI separadas por espacio, desde el inicio. */
  moves: string;
  status: string;
  winner?: 'white' | 'black';
}

export interface PartidaLichessIniciada {
  gameId: string;
  /** Color que juega el usuario. */
  color: Color;
  /** Usuario del rival, para mostrarlo. */
  rival: string;
  estadoInicial: EstadoPartidaLichess;
}

/**
 * Adaptador de Lichess para jugar contra los bots Maia (ADR-0004). Vive detrás
 * de un puerto por dos motivos: el dominio no hace fetch (CONTRIBUTING regla 4),
 * y este es el único módulo del proyecto que no se puede ejercitar desde el
 * entorno de desarrollo —la red a lichess.org está bloqueada ahí, aunque sí
 * funcione desde el navegador del usuario—, así que tiene que poder probarse
 * con un doble.
 */
export interface LichessPort {
  /** Valida el token y devuelve el usuario dueño. */
  cuenta(token: string): Promise<{ username: string }>;
  /**
   * Desafía a un bot y resuelve cuando la partida arranca. Escucha el stream de
   * eventos antes de mandar el desafío: al revés se pierde el `gameStart` si el
   * bot acepta rápido.
   */
  desafiarBot(token: string, bot: string, control: { minutos: number; incremento: number }, signal: AbortSignal): Promise<PartidaLichessIniciada>;
  /** Sigue la partida hasta que termina o se aborta la señal. */
  seguirPartida(token: string, gameId: string, onEstado: (estado: EstadoPartidaLichess) => void, signal: AbortSignal): Promise<void>;
  enviarJugada(token: string, gameId: string, uci: string): Promise<void>;
  abandonar(token: string, gameId: string): Promise<void>;
  /** PGN final, para guardar la partida en el historial local. */
  pgn(token: string, gameId: string): Promise<string>;
}

export interface GameRepo {
  save(game: GameRecord): Promise<void>;
  list(): Promise<GameRecord[]>;
}
