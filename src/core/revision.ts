// Revelación del error (RF-5.3, design system §5): con qué se muestra en el
// tablero una respuesta equivocada.
//
// Decir "la jugada correcta era Th5" en el panel deja el trabajo de ubicarla
// al usuario, justo cuando acaba de equivocarse. La flecha lo resuelve, pero
// solo tiene sentido sobre la posición **en la que se decidió**: después de la
// jugada equivocada la pieza ya no está donde estaba, y una flecha que sale de
// una casilla vacía confunde más que el texto.
//
// Este módulo arma ese paquete —posición, jugada jugada y jugada correcta— a
// partir de lo que cada bloque ya tiene (la jugada del usuario y la solución en
// UCI). Es dominio puro: no sabe de chessground ni de React.
import { Chess } from 'chess.js';

export interface RevisionDelError {
  /** Posición tal como estaba al decidir, antes de la jugada del usuario. */
  fen: string;
  /** Lo que jugó el usuario, en casillas de origen y destino. */
  jugada: [string, string] | null;
  /** Lo que había que jugar, en casillas de origen y destino. */
  correcta: [string, string];
  /**
   * Si en esa posición había jaque. El tablero muestra el jaque de la posición
   * que tiene cargada, y al rebobinar esa deja de ser la de después de la
   * jugada: sin este dato pintaría el aro de un jaque que en la posición
   * revelada no existe (o se comería el que sí existe).
   */
  jaque: boolean;
}

const CASILLA = /^[a-h][1-8]$/;

/** Origen y destino de una jugada UCI ("e2e4", "e7e8q"); null si no lo es. */
export function casillasDeUci(uci: string | null | undefined): [string, string] | null {
  if (!uci) return null;
  const desde = uci.slice(0, 2);
  const hasta = uci.slice(2, 4);
  return CASILLA.test(desde) && CASILLA.test(hasta) ? [desde, hasta] : null;
}

/**
 * La revisión de un error, o null si no hay jugada correcta que mostrar (un
 * ítem sin solución registrada, o un bloque que no se juega en el tablero).
 * La jugada del usuario es opcional a propósito: en el Radar con muestreo de
 * candidatas puede haberse deshecho, y la flecha que importa es la otra.
 */
export function revisionDelError(
  fen: string,
  jugadaUsuarioUci: string | null | undefined,
  jugadaCorrectaUci: string | null | undefined,
): RevisionDelError | null {
  const correcta = casillasDeUci(jugadaCorrectaUci);
  if (!fen || !correcta) return null;
  return { fen, jugada: casillasDeUci(jugadaUsuarioUci), correcta, jaque: enJaque(fen) };
}

function enJaque(fen: string): boolean {
  try {
    return new Chess(fen).inCheck();
  } catch {
    return false; // una posición ilegal no debería llegar acá; tampoco vale romper el feedback por eso
  }
}
