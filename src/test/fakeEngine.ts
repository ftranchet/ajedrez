// Motor falso y determinístico para tests de análisis (services/analysis,
// ui/state/analysisStore): evalúa por material en el tablero más una
// búsqueda de 1 jugada por si el bando a mover puede ganar material gratis
// (sin eso, "colgar" una pieza recién se nota en el ply en que la capturan,
// no en el que la deja indefensa — un motor real sí lo ve de inmediato).
import { Chess } from 'chess.js';
import type { EngineEvaluation, EnginePort } from '../core/ports';

const VALORES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function materialDiff(fen: string): number {
  const board = fen.split(' ')[0];
  let diff = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase();
    if (!(lower in VALORES)) continue;
    diff += ch === lower ? -VALORES[lower] : VALORES[lower];
  }
  return diff; // positivo = blancas arriba en material
}

/** Mejor ganancia de material capturable de inmediato, sin recaptura, para quien mueve en `fen`. */
function bestFreeCapture(fen: string): number {
  const chess = new Chess(fen);
  let mejor = 0;
  for (const mv of chess.moves({ verbose: true })) {
    if (!mv.captured) continue;
    const after = new Chess(chess.fen());
    after.move(mv.san);
    const puedenRecapturar = after.moves({ verbose: true }).some((r) => r.to === mv.to && r.captured);
    const ganancia = VALORES[mv.captured] - (puedenRecapturar ? VALORES[mv.piece] : 0);
    if (ganancia > mejor) mejor = ganancia;
  }
  return mejor;
}

export class FakeAnalysisEngine implements EnginePort {
  async init(): Promise<void> {}

  async bestMove(): Promise<string> {
    return '';
  }

  async evaluate(fen: string): Promise<EngineEvaluation> {
    const sideToMove = fen.split(' ')[1];
    const diffBlancas = materialDiff(fen);
    // UCI "score cp" siempre es perspectiva de quien mueve: convertir acá.
    const propio = sideToMove === 'w' ? diffBlancas : -diffBlancas;
    const cp = (propio + bestFreeCapture(fen)) * 100;
    return { move: 'a2a3', cp, mateIn: null };
  }

  dispose(): void {}
}
