// Orquesta el motor sobre una partida completa para la fase 2 (RF-3.2,
// RNF-3): recorre cada posición con chess.js y le pide al motor su
// evaluación y mejor jugada. Vive en services/ porque usa EnginePort; la
// lógica de clasificación es pura y está en core/analysis.ts.
import { Chess } from 'chess.js';
import type { EngineEvaluation, EnginePort } from '../../core/ports';
import type { EngineEvalAtPly } from '../../core/analysis';
import type { Color } from '../../core/types';

/** Profundidad por defecto para el análisis de partida completa (RNF-3: "profundidad 18 o 3s por posición crítica"; acá se prioriza no bloquear la UI por minutos en partidas largas). */
export const ANALYSIS_DEPTH = 14;

function cpInWhitePerspective(cp: number, mateIn: number | null, sideToMove: Color): number {
  const value = mateIn !== null ? Math.sign(mateIn) * 100_000 : cp;
  return sideToMove === 'w' ? value : -value;
}

export interface AnalyzeGameProgress {
  ply: number;
  totalPlies: number;
}

/**
 * Evalúa cada posición de la partida (incluida la final) con el motor a
 * máxima fuerza. Devuelve `totalPlies + 1` evaluaciones, listas para
 * `buildGameAnalysis` (core/analysis.ts).
 */
export async function analyzeGameWithEngine(
  pgn: string,
  engine: EnginePort,
  opts: { depth?: number; onProgress?: (p: AnalyzeGameProgress) => void } = {},
): Promise<EngineEvalAtPly[]> {
  const depth = opts.depth ?? ANALYSIS_DEPTH;
  const replay = new Chess();
  replay.loadPgn(pgn, { strict: false });
  const moves = replay.history({ verbose: true });

  const chess = new Chess();
  const evals: EngineEvalAtPly[] = [];

  for (let ply = 0; ply <= moves.length; ply++) {
    const fen = chess.fen();
    const sideToMove: Color = chess.turn();
    // Posición terminal (mate o ahogado): sin jugadas legales, el motor
    // responde "bestmove (none)" y el adaptador lo trata como error. Solo
    // puede pasar en la última posición de la partida; se sintetiza la
    // evaluación sin consultar al motor.
    const result: EngineEvaluation = chess.isCheckmate()
      ? { move: '', cp: null, mateIn: -1 } // quien mueve está en mate
      : chess.isStalemate()
        ? { move: '', cp: 0, mateIn: null }
        : await engine.evaluate(fen, depth);
    const cpAntes = cpInWhitePerspective(result.cp ?? 0, result.mateIn, sideToMove);

    const move = moves[ply];
    evals.push({
      ply,
      fen,
      san: move?.san ?? '',
      ladoQueMueve: sideToMove,
      jugadaUsuario: move ? move.from + move.to + (move.promotion ?? '') : '',
      cpAntes,
      jugadaMotor: result.move,
    });

    opts.onProgress?.({ ply, totalPlies: moves.length });
    if (move) chess.move({ from: move.from, to: move.to, promotion: move.promotion });
  }

  return evals;
}
