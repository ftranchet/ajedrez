// Utilidades compartidas entre stores que envuelven chess.js para producir
// el mapa de destinos que espera chessground.
import { Chess } from 'chess.js';

export function computeDests(c: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}

/**
 * Reproduce una línea en UCI desde un FEN y devuelve su notación SAN, para
 * mostrarla en pantallas de feedback (Cálculo comprometido, Stoyko). Corta
 * en la primera jugada ilegal en vez de tirar, para no romper un feedback
 * por una línea parcial.
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
    san.push(chess.move(move).san);
  }
  return san;
}
