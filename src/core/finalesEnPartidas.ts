// Qué finales teóricos aparecen de verdad en tus partidas (RF-6.2b).
//
// **Por qué existe.** El catálogo de finales se ofrecía en el orden en que
// estaba escrito, así que la Lucena —que aparece cuando ya sabés llevar una
// torre a un final de torres— competía de igual a igual con el mate de rey y
// dama, en una lista de 16 donde nada indicaba por dónde empezar. La señal más
// fuerte para priorizar no está en el catálogo sino en las partidas del propio
// usuario: un final que ya se le presentó tres veces es el que le va a volver a
// aparecer.
//
// **Cómo se detecta.** Se recorren los últimos plies de cada partida y se
// clasifica el material que queda en el tablero. Es reconocimiento de material,
// no evaluación: no dice si el final estaba ganado, dice que se llegó a esa
// estructura. Alcanza para lo que se necesita —ordenar una lista— y no se
// afirma nada más que eso.
import { Chess, type Move } from 'chess.js';
import type { GameRecord, PatternKey } from './types';

/**
 * Cuántos plies del final de cada partida se miran. Un final de torres puede
 * durar 40 jugadas, pero para *reconocer* que se llegó a él alcanza con la
 * cola: si el material ya se simplificó, sigue simplificado.
 */
const PLIES_DE_COLA = 40;

/**
 * Cuántas partidas se miran, de la más reciente hacia atrás. El historial crece
 * sin límite y esto corre al abrir una pantalla: se acota a las recientes, que
 * además son las que describen cómo jugás **ahora**.
 */
const PARTIDAS_ANALIZADAS = 40;

/** Estructuras de final que el catálogo sabe entrenar. */
export type EstructuraFinal =
  | 'rey-peon'
  | 'peon-de-torre'
  | 'torre-contra-rey'
  | 'dama-contra-rey'
  | 'torres-con-peon';

/**
 * Qué ítems del catálogo entrena cada estructura. Un peón de torre no cuenta
 * como rey y peón genérico: su técnica es justamente la excepción (el rey
 * defensor se salva en la esquina), y mezclarlas haría que llegar a un peón de
 * alfil recomendara la posición equivocada.
 */
const CATALOGO_POR_ESTRUCTURA: Record<EstructuraFinal, PatternKey[]> = {
  'rey-peon': ['final-rey-peon', 'final-cuadrado'],
  'peon-de-torre': ['final-peon-torre'],
  'torre-contra-rey': ['final-torre'],
  'dama-contra-rey': ['final-dama'],
  'torres-con-peon': ['final-lucena', 'final-philidor'],
};

interface Material {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
}

function materialDe(chess: Chess): { w: Material; b: Material } {
  const vacio = (): Material => ({ p: 0, n: 0, b: 0, r: 0, q: 0 });
  const total = { w: vacio(), b: vacio() };
  for (const fila of chess.board()) {
    for (const casilla of fila) {
      if (!casilla || casilla.type === 'k') continue;
      total[casilla.color][casilla.type as keyof Material] += 1;
    }
  }
  return total;
}

function piezas(m: Material): number {
  return m.p + m.n + m.b + m.r + m.q;
}

/** ¿Hay un peón y está en la columna de torre? Decide la técnica que aplica. */
function peonDeTorre(chess: Chess): boolean {
  for (const fila of chess.board()) {
    for (const casilla of fila) {
      if (casilla?.type === 'p') return casilla.square[0] === 'a' || casilla.square[0] === 'h';
    }
  }
  return false;
}

/**
 * Clasifica una posición por el material que queda, o `null` si no es ninguno
 * de los finales del catálogo. Deliberadamente estricto: solo se reconocen las
 * estructuras que el catálogo sabe entrenar, y una posición con más material
 * no se fuerza dentro de la más parecida.
 */
export function estructuraDeFinal(chess: Chess): EstructuraFinal | null {
  const { w, b } = materialDe(chess);
  const fuerte = piezas(w) >= piezas(b) ? w : b;
  const debil = fuerte === w ? b : w;

  if (piezas(debil) === 0 && piezas(fuerte) === 1) {
    if (fuerte.p === 1) return peonDeTorre(chess) ? 'peon-de-torre' : 'rey-peon';
    if (fuerte.r === 1) return 'torre-contra-rey';
    if (fuerte.q === 1) return 'dama-contra-rey';
    return null;
  }
  // Torre y peón contra torre: la familia Lucena/Philidor.
  if (fuerte.r === 1 && fuerte.p === 1 && piezas(fuerte) === 2 && debil.r === 1 && piezas(debil) === 1) {
    return 'torres-con-peon';
  }
  return null;
}

/**
 * Cuántas de tus partidas llegaron a cada tipo de final del catálogo, contando
 * cada partida una sola vez por tipo: una partida que estuvo veinte jugadas en
 * un final de torres no vale veinte, vale una.
 */
export function finalesDeTusPartidas(
  games: GameRecord[],
  ahora: Date = new Date(),
): Map<PatternKey, number> {
  const conteo = new Map<PatternKey, number>();
  const recientes = [...games]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .filter((game) => new Date(game.fecha).getTime() <= ahora.getTime())
    .slice(0, PARTIDAS_ANALIZADAS);

  for (const game of recientes) {
    for (const patternKey of estructurasDeLaPartida(game)) {
      conteo.set(patternKey, (conteo.get(patternKey) ?? 0) + 1);
    }
  }
  return conteo;
}

/** Los ítems del catálogo que esta partida tocó, sin repetir. */
function estructurasDeLaPartida(game: GameRecord): Set<PatternKey> {
  const encontradas = new Set<PatternKey>();
  const replay = new Chess();
  let jugadas: Move[];
  try {
    replay.loadPgn(game.pgn, { strict: false });
    jugadas = replay.history({ verbose: true });
  } catch {
    // Un PGN que no se puede leer no invalida el resto del historial.
    return encontradas;
  }

  // Se usa el FEN que cada jugada deja (`after`) en vez de rehacer la partida
  // desde la posición inicial estándar: eso último clasificaría el tablero
  // equivocado en un PGN que arranca de una posición propia, que es el mismo
  // error que tenía el analizador de partidas.
  const desde = Math.max(0, jugadas.length - PLIES_DE_COLA);
  for (let i = desde; i < jugadas.length; i++) {
    const estructura = estructuraDeFinal(new Chess(jugadas[i]!.after));
    if (estructura) for (const key of CATALOGO_POR_ESTRUCTURA[estructura]) encontradas.add(key);
  }
  return encontradas;
}
