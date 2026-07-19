// Finales teóricos elementales (E6, RF-6.2): criterio puro para decidir si
// la técnica se sostuvo contra el motor. La UI/orquestación vive fuera de
// core; acá solo entran hechos de la partida y la evaluación del rival.
import type { EngineEvaluation } from './ports';
import type { Color, CurriculumItem } from './types';

export const FINAL_DRAW_HOLD_MOVES = 12;
export const FINAL_SCORE_MARGIN_CP = 150;

export interface FinalPositionState {
  gameOver: boolean;
  draw: boolean;
  winner: Color | null;
  promoted: boolean;
  userMoves: number;
}

export type FinalVerdict = 'continuar' | 'demostrado' | 'perdido';

/**
 * La evaluación se toma justo después de la jugada del usuario, por lo que
 * está expresada desde la perspectiva del rival que mueve. En finales
 * ganados el rival debe seguir claramente peor; en Philidor no debe quedar
 * claramente ganador. Doce defensas correctas contra Stockfish cuentan como
 * demostración práctica sin obligar a esperar la regla de 50 jugadas.
 */
export function evaluateFinalTechnique(
  item: CurriculumItem,
  state: FinalPositionState,
  opponentEvaluation: EngineEvaluation | null,
): FinalVerdict {
  if (item.tipo !== 'final' || !item.resultadoEsperado || !item.ladoUsuario) return 'perdido';

  if (item.resultadoEsperado === 'gana') {
    if (state.promoted || state.winner === item.ladoUsuario) return 'demostrado';
    if (state.gameOver) return 'perdido';
    if (!opponentEvaluation) return 'continuar';
    if (opponentEvaluation.mateIn !== null) {
      return opponentEvaluation.mateIn < 0 ? 'demostrado' : 'perdido';
    }
    return opponentEvaluation.cp !== null && opponentEvaluation.cp > -FINAL_SCORE_MARGIN_CP
      ? 'perdido'
      : 'continuar';
  }

  if (state.draw) return 'demostrado';
  if (state.gameOver) return 'perdido';
  if (opponentEvaluation?.mateIn !== null && opponentEvaluation?.mateIn !== undefined) {
    if (opponentEvaluation.mateIn > 0) return 'perdido';
  }
  if (opponentEvaluation?.cp !== null && opponentEvaluation?.cp !== undefined && opponentEvaluation.cp > FINAL_SCORE_MARGIN_CP) {
    return 'perdido';
  }
  return state.userMoves >= FINAL_DRAW_HOLD_MOVES ? 'demostrado' : 'continuar';
}
