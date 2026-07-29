// Finales teóricos elementales (E6, RF-6.2): criterio puro para decidir si
// la técnica se sostuvo contra el motor. La UI/orquestación vive fuera de
// core; acá solo entran hechos de la partida y la evaluación del rival.
import type { EngineEvaluation } from './ports';
import type { Color, CurriculumItem, ObjetivoFinal } from './types';

export const FINAL_DRAW_HOLD_MOVES = 12;
export const FINAL_SCORE_MARGIN_CP = 150;
/**
 * Cuánto tiene que seguir ganando la posición después de coronar para que la
 * coronación cuente como técnica demostrada. Coronar y perder la dama en la
 * jugada siguiente (el error clásico de Lucena: el jaque en la espalda y la
 * enfilada) no demuestra nada, y con el umbral de "todavía no está perdido"
 * (`FINAL_SCORE_MARGIN_CP`) se daba por bueno igual.
 */
export const FINAL_WIN_MARGIN_CP = 300;

export interface FinalPositionState {
  gameOver: boolean;
  draw: boolean;
  winner: Color | null;
  promoted: boolean;
  userMoves: number;
}

export type FinalVerdict = 'continuar' | 'demostrado' | 'perdido';

/**
 * Qué hay que lograr para dar por demostrado un final que se gana (RF-6.2).
 * El catálogo lo declara; para un ítem viejo (o sembrado por un test) se
 * deduce de la posición: con peón propio, la técnica termina al coronar; sin
 * peón, la técnica **es** el mate.
 */
export function objetivoDeFinal(item: CurriculumItem): ObjetivoFinal {
  if (item.objetivo) return item.objetivo;
  const piezas = item.fen.split(' ')[0] ?? '';
  const peon = item.ladoUsuario === 'b' ? 'p' : 'P';
  return piezas.includes(peon) ? 'coronar' : 'mate';
}

/** ¿La posición sigue siendo ganadora para quien acaba de jugar? La evaluación
 * viene desde la perspectiva del rival, que es quien mueve. */
function siguePerdiendoElRival(evaluacion: EngineEvaluation, margen: number): boolean {
  if (evaluacion.mateIn !== null) return evaluacion.mateIn < 0;
  return evaluacion.cp !== null && evaluacion.cp <= -margen;
}

/**
 * La evaluación se toma justo después de la jugada del usuario, por lo que
 * está expresada desde la perspectiva del rival que mueve.
 *
 * Qué cuenta como demostrar la técnica (RF-6.2):
 *
 * - **Mate** (rey y torre, rey y dama): hay que darlo. Antes alcanzaba con que
 *   Stockfish *viera* un mate forzado contra sí mismo, que en estos finales
 *   pasa después de la primera jugada razonable: el ejercicio se cerraba con
 *   "técnica demostrada" sin que el usuario hubiera demostrado nada. Si el
 *   rey escapa a las 50 jugadas o la posición se repite, la técnica se perdió,
 *   que es exactamente lo que habría pasado en una partida.
 * - **Coronar** (rey y peón, Lucena): hay que coronar **y** que la posición
 *   siga decidida después. Coronar era terminal por sí solo, así que ahogar al
 *   rival o regalar la dama recién coronada contaba como demostración.
 * - **Tablas** (Philidor, peón de torre, la oposición del que defiende): tablas
 *   alcanzadas, o doce jugadas propias sosteniendo la defensa sin que el rival
 *   pase a estar claramente ganando.
 */
export function evaluateFinalTechnique(
  item: CurriculumItem,
  state: FinalPositionState,
  opponentEvaluation: EngineEvaluation | null,
): FinalVerdict {
  if (item.tipo !== 'final' || !item.resultadoEsperado || !item.ladoUsuario) return 'perdido';

  if (item.resultadoEsperado === 'gana') {
    if (state.winner === item.ladoUsuario) return 'demostrado';
    // Ahogado, material insuficiente, 50 jugadas o repetición: el final se
    // terminó sin la técnica. Va antes que la coronación a propósito —
    // coronar ahogando al rival no demuestra nada.
    if (state.gameOver) return 'perdido';
    if (!opponentEvaluation) return 'continuar';
    if (state.promoted && objetivoDeFinal(item) === 'coronar') {
      return siguePerdiendoElRival(opponentEvaluation, FINAL_WIN_MARGIN_CP) ? 'demostrado' : 'perdido';
    }
    if (opponentEvaluation.mateIn !== null) {
      // Mate a favor del rival: se perdió. Mate a favor del usuario: falta
      // darlo, no es la demostración todavía.
      return opponentEvaluation.mateIn > 0 ? 'perdido' : 'continuar';
    }
    return opponentEvaluation.cp !== null && opponentEvaluation.cp > -FINAL_SCORE_MARGIN_CP
      ? 'perdido'
      : 'continuar';
  }

  // Defender tablas: ganar también las sostiene (el rival se equivocó feo).
  if (state.draw || state.winner === item.ladoUsuario) return 'demostrado';
  if (state.gameOver) return 'perdido';
  if (opponentEvaluation?.mateIn !== null && opponentEvaluation?.mateIn !== undefined) {
    if (opponentEvaluation.mateIn > 0) return 'perdido';
  }
  if (opponentEvaluation?.cp !== null && opponentEvaluation?.cp !== undefined && opponentEvaluation.cp > FINAL_SCORE_MARGIN_CP) {
    return 'perdido';
  }
  return state.userMoves >= FINAL_DRAW_HOLD_MOVES ? 'demostrado' : 'continuar';
}
