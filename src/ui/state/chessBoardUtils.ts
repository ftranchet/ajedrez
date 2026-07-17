// Utilidades compartidas entre stores que envuelven chess.js para producir
// el mapa de destinos que espera chessground.
import type { Chess } from 'chess.js';

export function computeDests(c: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}
