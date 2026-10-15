// De dónde sale la posición del preset abierto (ADR-0015, punto 4).
//
// El catálogo minado tiene ocho posiciones y cuesta ~1 candidata cada 70
// posiciones de autojuego revisadas: para un ejercicio semanal se agota en dos
// meses. Pero la app ya guarda algo mejor que cualquier posición sintética —las
// partidas propias analizadas, con los centipeones perdidos jugada por jugada y
// el tiempo consumido en cada una—, y el ejercicio gana justamente cuando el
// material es de máxima relevancia personal: la posición en la que dudaste de
// verdad, no una en la que dudó un motor jugando contra sí mismo.
//
// Este módulo elige esa posición. Es dominio puro: recibe partidas, devuelve
// una posición y el motivo por el que la eligió.
import type { GameRecord, MoveAnalysisEntry } from './types';

/** Cuánto tiene que haberse perdido en una jugada para que valga pararse ahí. */
const CP_PERDIDOS_MINIMO = 100;

/**
 * Cuántas partidas analizadas hacia atrás se miran. Más allá de esto la
 * posición deja de decir algo sobre cómo juega hoy.
 */
const PARTIDAS_RECIENTES = 10;

export type MotivoPosicion = 'mas-centipeones' | 'mas-tiempo';

export interface PosicionPropia {
  /** Posición **antes** de la jugada: es la decisión que se vuelve a tomar. */
  fen: string;
  gameId: string;
  ply: number;
  /** Qué la eligió, para poder decírselo al usuario en vez de servirla sin explicación. */
  motivo: MotivoPosicion;
  /** Jugada que el usuario jugó entonces, en UCI: se revela al final, no antes. */
  jugadaEntonces: string;
  cpPerdidos: number;
  /**
   * La evaluación antes y después de la jugada, **desde la perspectiva de quien
   * movió** (o sea, del usuario). Decir solo cuánto costó no alcanza: perder
   * dos peones desde +6 deja la partida ganada, y perderlos desde +1 la entrega.
   * Lo que ubica la jugada es el salto, no la magnitud suelta.
   */
  ventajaAntes: number;
  ventajaDespues: number;
  /** Milisegundos que consumió en esa jugada, si la partida los registró. */
  tiempoMs?: number;
}

/**
 * Jugadas del usuario en una partida analizada, con su tiempo si existe. Sin
 * su color (partidas previas a ese campo) no hay forma de saber cuáles son
 * suyas, y la partida no aporta ninguna: antes aportaba las de los dos lados,
 * y el ejercicio podía servir el error del rival como "tu ventaja pasó de
 * mate a favor a −5,0".
 */
function jugadasDelUsuario(game: GameRecord): { entry: MoveAnalysisEntry; tiempoMs?: number }[] {
  const jugadas = game.analisis?.jugadas ?? [];
  return jugadas
    .filter((entry) => entry.ladoQueMueve === game.jugadorColor)
    .map((entry) => ({ entry, tiempoMs: game.tiemposPorJugadaMs[entry.ply] }));
}

/** Una posición propia ya servida en un ejercicio: partida y media jugada (`CalculoAttempt.origen`). */
export interface PosicionUsada {
  gameId: string;
  ply: number;
}

// El ply va adelante y no tiene ':', así que la clave no se puede confundir
// aunque el id de la partida lo tenga.
const clave = (gameId: string, ply: number): string => `${ply}:${gameId}`;

/**
 * La posición de tu propia partida donde más caro salió pensar: primero la
 * jugada que más centipeones perdió; si ninguna perdió lo suficiente, la que
 * más tiempo consumió —dudar mucho y aun así jugar bien también es una posición
 * que vale volver a mirar—. Null si no hay partidas analizadas con tu color:
 * ahí el ejercicio cae al catálogo minado. Las que no lo tienen no entran en
 * la ventana de recientes, porque no pueden aportar posiciones propias.
 *
 * Las posiciones de `usadas` no se vuelven a servir: la elección es
 * determinista, y sin esto la misma posición —ya con la respuesta del motor
 * vista— volvía todas las semanas hasta que se analizara otra partida con un
 * error mayor. Se pasa a la siguiente candidata con el mismo criterio y, si no
 * queda ninguna, a null (el catálogo).
 */
export function posicionPropiaParaCalculo(
  games: GameRecord[],
  usadas: readonly PosicionUsada[] = [],
  recientes = PARTIDAS_RECIENTES,
): PosicionPropia | null {
  const yaUsadas = new Set(usadas.map(({ gameId, ply }) => clave(gameId, ply)));
  const analizadas = games
    .filter((game) => game.analisis?.analizadaEn && game.jugadorColor)
    .sort((a, b) => (b.analisis?.analizadaEn ?? '').localeCompare(a.analisis?.analizadaEn ?? ''))
    .slice(0, recientes);

  const candidatas = analizadas.flatMap((game) =>
    jugadasDelUsuario(game)
      .filter(({ entry }) => !yaUsadas.has(clave(game.id, entry.ply)))
      .map(({ entry, tiempoMs }) => ({ game, entry, tiempoMs })),
  );
  if (candidatas.length === 0) return null;

  const porCentipeones = candidatas
    .filter(({ entry }) => entry.cpPerdidos >= CP_PERDIDOS_MINIMO)
    .sort((a, b) => b.entry.cpPerdidos - a.entry.cpPerdidos)[0];
  const elegida = porCentipeones
    ?? candidatas
      .filter(({ tiempoMs }) => typeof tiempoMs === 'number' && tiempoMs > 0)
      .sort((a, b) => (b.tiempoMs ?? 0) - (a.tiempoMs ?? 0))[0];
  if (!elegida) return null;

  return {
    fen: elegida.entry.fenAntes,
    gameId: elegida.game.id,
    ply: elegida.entry.ply,
    motivo: porCentipeones ? 'mas-centipeones' : 'mas-tiempo',
    jugadaEntonces: elegida.entry.jugadaUsuario,
    cpPerdidos: elegida.entry.cpPerdidos,
    // `cpAntes`/`cpDespues` vienen en perspectiva blancas; para negras se
    // invierten, porque lo que se muestra es la ventaja de quien movió.
    ventajaAntes: elegida.entry.ladoQueMueve === 'w' ? elegida.entry.cpAntes : -elegida.entry.cpAntes,
    ventajaDespues: elegida.entry.ladoQueMueve === 'w' ? elegida.entry.cpDespues : -elegida.entry.cpDespues,
    ...(typeof elegida.tiempoMs === 'number' ? { tiempoMs: elegida.tiempoMs } : {}),
  };
}
