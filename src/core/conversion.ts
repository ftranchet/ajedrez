// Conversión de ventajas (E8, RF-8.1/8.3): posiciones ganadoras que se
// desperdiciaron, para rejugarlas.
//
// La conversión es, según `docs/evidence/tier-list-entrenamientos-ajedrez.md`,
// "una fuga masiva en aficionados y una habilidad real del resultado" — tier A.
// La épica figuraba como bloqueada porque RF-8.1 pide rejugarlas contra Maia y
// Lichess no es alcanzable desde el entorno de desarrollo. Pero RF-8.3 ya
// contempla el camino local, y el material no dependía nunca de la red: sale
// del análisis de las partidas propias, que la app ya produce.
//
// La limitación se declara en pantalla y no se disimula: Stockfish defiende
// mejor que un humano y sin las trampas prácticas que pondría un rival de
// verdad, así que convertir contra el motor es más difícil —y menos parecido a
// una partida— que convertir contra una persona.
import type { GameAnalysis, GameRecord, MoveAnalysisEntry } from './types';

/** Centipeones desde los que una posición se considera ganadora (RF-8.1: ≥ +3). */
export const VENTAJA_GANADORA_CP = 300;

export interface VentajaDesperdiciada {
  gameId: string;
  /** Posición ganadora, antes de la jugada que la empezó a tirar. */
  fen: string;
  ply: number;
  /** Ventaja en centipeones desde la perspectiva del usuario. */
  ventajaCp: number;
  /** Resultado real de la partida, para decir qué se perdió. */
  resultado: GameRecord['resultado'];
  fecha: string;
}

function resultadoDelUsuario(game: GameRecord): 'gano' | 'perdio' | 'tablas' | 'desconocido' {
  if (game.resultado === '1/2-1/2') return 'tablas';
  if (game.jugadorColor === undefined) return 'desconocido';
  if (game.resultado === '1-0') return game.jugadorColor === 'w' ? 'gano' : 'perdio';
  if (game.resultado === '0-1') return game.jugadorColor === 'b' ? 'gano' : 'perdio';
  return 'desconocido';
}

/** Ventaja del usuario en centipeones a partir de una evaluación en perspectiva blancas. */
function ventajaDelUsuario(cpBlancas: number, game: GameRecord): number {
  return game.jugadorColor === 'b' ? -cpBlancas : cpBlancas;
}

/**
 * La posición ganadora más clara de una partida que terminó en tablas o
 * derrota (RF-8.1). Se devuelve el **pico** de ventaja: es donde la conversión
 * todavía estaba entera y es la posición que tiene sentido rejugar.
 *
 * Se exige `jugadorColor` conocido: sin saber de qué lado jugó el usuario no se
 * puede decir si +4 era su ventaja o la del rival, y ofrecerle rejugar una
 * posición perdida sería exactamente lo contrario del ejercicio.
 */
export function ventajaDesperdiciada(game: GameRecord): VentajaDesperdiciada | null {
  const resultado = resultadoDelUsuario(game);
  if (resultado === 'gano' || resultado === 'desconocido') return null;
  const analisis: GameAnalysis | undefined = game.analisis;
  if (!analisis || game.jugadorColor === undefined) return null;

  let pico: MoveAnalysisEntry | null = null;
  let picoVentaja = 0;
  for (const jugada of analisis.jugadas) {
    // Solo posiciones en las que le tocaba mover al usuario: rejugar desde una
    // posición donde mueve el rival no es una conversión, es una espera.
    if (jugada.ladoQueMueve !== game.jugadorColor) continue;
    const ventaja = ventajaDelUsuario(jugada.cpAntes, game);
    if (ventaja >= VENTAJA_GANADORA_CP && ventaja > picoVentaja) {
      pico = jugada;
      picoVentaja = ventaja;
    }
  }
  if (!pico) return null;
  return {
    gameId: game.id,
    fen: pico.fenAntes,
    ply: pico.ply,
    ventajaCp: Math.round(picoVentaja),
    resultado: game.resultado,
    fecha: game.fecha,
  };
}

/**
 * Todas las ventajas desperdiciadas del historial, más recientes primero. Una
 * por partida: repetir varias posiciones de la misma partida entrenaría la
 * misma fuga con la misma estructura.
 */
export function ventajasDesperdiciadas(games: GameRecord[]): VentajaDesperdiciada[] {
  return games
    .map(ventajaDesperdiciada)
    .filter((ventaja): ventaja is VentajaDesperdiciada => ventaja !== null)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export type ResultadoConversion = 'convertida' | 'perdida' | 'en-curso';

/**
 * ¿Se convirtió la ventaja? Convertir es ganar; dejarla escapar hasta la
 * igualdad o peor es fallar, aunque la partida siga. El umbral de fallo es la
 * mitad de la ventaja ganadora: exigir que se sostenga el pico entero sería
 * pedir una técnica perfecta, no una conversión.
 */
export function evaluarConversion(
  ventajaActualCp: number,
  terminada: boolean,
  usuarioGano: boolean,
): ResultadoConversion {
  if (terminada) return usuarioGano ? 'convertida' : 'perdida';
  if (ventajaActualCp < VENTAJA_GANADORA_CP / 2) return 'perdida';
  return 'en-curso';
}
