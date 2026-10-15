// Utilidades compartidas entre stores que envuelven chess.js para producir
// el mapa de destinos que espera chessground.
import { Chess } from 'chess.js';
import { aNotacion } from '../../core/notacion';
import { readIdiomaNotacion } from '../notacionPrefs';
import { t } from '../i18n/es';

export function computeDests(c: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    // Destinos, no jugadas: un peón que corona produce cuatro jugadas hacia la
    // misma casilla y antes las cuatro entraban en la lista. chessground solo
    // pregunta "¿puedo soltar acá?", y qué pieza se corona lo resuelve el
    // diálogo de promoción.
    if (!list.includes(m.to)) list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}

/**
 * Reproduce una línea en UCI desde un FEN y devuelve su notación algebraica en
 * el idioma que el usuario eligió (RNF-9), para mostrarla en pantallas de
 * feedback.
 * Corta en la primera jugada ilegal en vez de tirar, para no romper un feedback
 * por una línea parcial.
 *
 * Es el embudo único de UCI → notación en la interfaz: Cola, patrones, Radar,
 * diagnóstico, finales y Cálculo pasan por acá, así que traducir en este punto
 * es lo que mantiene una sola notación en toda la app y lo que hace que la
 * preferencia se aplique en todas partes con un solo cambio.
 */
export function sanDeLinea(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promocion = uci.slice(4, 5) || undefined;
    // La pieza de promoción no es decorativa: emparejar solo origen y destino
    // hacía que `c2c1q` se resolviera como `c1=N`, que da jaque donde la dama
    // no lo da y volvía ilegal —y por lo tanto invisible— el resto de la línea.
    const candidatas = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
    const move = promocion ? candidatas.find((m) => m.promotion === promocion) : candidatas[0];
    if (!move) break;
    san.push(aNotacion(chess.move(move).san, readIdiomaNotacion()));
  }
  return san;
}

/**
 * SAN de una jugada suelta para mostrarla en el feedback (design system §5,
 * MoveList: "font-mono" pero notación legible, no UCI crudo); `fen` es la
 * posición **antes** de la jugada.
 *
 * Si la jugada no es legal en esa posición no hay notación que mostrar, y el
 * texto lo dice. Antes caía al UCI: rompía RNF-9 y presentaba como respuesta
 * un dato roto (auditoría 2026-10-15, N2). Ocultar el renglón también lo
 * escondería. Por los caminos normales no llega una jugada ilegal —la
 * solución del catálogo se verifica en los tests, la del motor sale de la
 * misma posición y la del usuario la valida el tablero—, pero sí puede llegar
 * con un respaldo restaurado, que valida la jugada de una tarjeta o de un
 * análisis solo como texto, o con un bug: una jugada del motor asociada a otra
 * posición, como la que producía su `bestmove` tardío (ver `descartarWorker`
 * en stockfishEngine.ts), se vería exactamente así.
 */
export function sanDeJugada(fen: string, jugadaUci: string): string {
  return sanDeLinea(fen, [jugadaUci])[0] ?? t.tablero.jugadaNoLegal;
}
