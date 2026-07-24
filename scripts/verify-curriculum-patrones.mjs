// Verifica cada posición del currículo de patrones (E6, RF-6.1) antes de
// embeberla en src/services/puzzles/curriculumSeedData.ts: nunca se confía en
// una posición de memoria (lección de docs/roadmap.md — dos veces en Fase 2 un
// PGN "recordado" resultó ilegal). Cada patrón se verifica con la regla de
// ajedrez que realmente demuestra el motivo, usando chess.js como árbitro:
//   - mate: la jugada da mate.
//   - horquilla: jaque de caballo no bloqueable que ataca una pieza mayor.
//   - clavada: la pieza (caballo) clavada al rey queda sin jugadas legales.
//   - descubierta: el caballo TAPABA a la torre (antes de mover ella no daba
//     jaque) y al moverse revela el jaque de la torre, no uno propio (puro, no
//     doble).
//   - rayos-x/enfilada: tras el jaque, el rey debe moverse y la dama de atrás
//     queda capturable.
//
// Uso: node scripts/verify-curriculum-patrones.mjs
import { Chess } from 'chess.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`FALLÓ: ${msg}`);
}

function blackKing(chess) {
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === 'b') return sq.square;
  throw new Error('sin rey negro');
}

const items = [];

function jugar(nombre, fen, solucion) {
  const chess = new Chess(fen);
  assert(!chess.isCheck(), `${nombre}: el rey ya está en jaque antes de la jugada solución`);
  const [from, to] = [solucion.slice(0, 2), solucion.slice(2, 4)];
  const legal = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
  assert(legal, `${nombre}: la jugada solución ${solucion} no es legal en la posición`);
  return chess;
}

function mate(id, nombre, patternKey, fen, solucion) {
  const chess = jugar(nombre, fen, solucion);
  chess.move({ from: solucion.slice(0, 2), to: solucion.slice(2, 4) });
  assert(chess.isCheckmate(), `${nombre}: no es mate`);
  record(id, nombre, patternKey, fen, solucion);
}

function horquilla(id, nombre, fen, solucion, target) {
  const chess = jugar(nombre, fen, solucion);
  const dest = solucion.slice(2, 4);
  chess.move({ from: solucion.slice(0, 2), to: dest });
  assert(chess.isCheck(), `${nombre}: la horquilla debería dar jaque`);
  assert(chess.attackers(target, 'w').includes(dest), `${nombre}: el caballo no ataca la pieza en ${target}`);
  const pieza = chess.get(target);
  assert(pieza && (pieza.type === 'q' || pieza.type === 'r'), `${nombre}: ${target} debería tener dama o torre`);
  assert(chess.moves({ verbose: true }).every((m) => m.piece === 'k'), `${nombre}: debería ser jaque de caballo no bloqueable`);
  record(id, nombre, 'horquilla', fen, solucion);
}

function clavada(id, nombre, fen, solucion, target) {
  const chess = jugar(nombre, fen, solucion);
  chess.move({ from: solucion.slice(0, 2), to: solucion.slice(2, 4) });
  assert(chess.get(target), `${nombre}: no hay pieza clavada en ${target}`);
  assert(chess.moves({ square: target, verbose: true }).length === 0, `${nombre}: el caballo clavado no debería tener jugadas legales`);
  record(id, nombre, 'clavada', fen, solucion);
}

function descubierta(id, nombre, fen, solucion, rookSq) {
  const chess = jugar(nombre, fen, solucion);
  const bk = blackKing(chess);
  assert(!chess.attackers(bk, 'w').includes(rookSq), `${nombre}: la torre ${rookSq} ya daba jaque antes de mover (el caballo no la tapaba)`);
  const dest = solucion.slice(2, 4);
  chess.move({ from: solucion.slice(0, 2), to: dest });
  assert(chess.isCheck(), `${nombre}: debería quedar en jaque tras descubrir`);
  const at = chess.attackers(bk, 'w');
  assert(at.includes(rookSq), `${nombre}: la torre ${rookSq} debería dar el jaque descubierto`);
  assert(!at.includes(dest), `${nombre}: el caballo (${dest}) también da jaque: sería doble, no descubierto puro`);
  record(id, nombre, 'descubierta', fen, solucion);
}

function rayosX(id, nombre, fen, solucion, backSq) {
  const chess = jugar(nombre, fen, solucion);
  const rookDest = solucion.slice(2, 4);
  chess.move({ from: solucion.slice(0, 2), to: rookDest });
  assert(chess.isCheck(), `${nombre}: debería dar jaque`);
  assert(chess.get(backSq)?.type === 'q', `${nombre}: debería haber una dama detrás en ${backSq}`);
  const respuestas = chess.moves({ verbose: true });
  assert(respuestas.length > 0, `${nombre}: el rey debería tener alguna jugada legal`);
  for (const resp of respuestas) {
    const copia = new Chess(chess.fen());
    copia.move(resp);
    assert(copia.get(backSq)?.type === 'q', `${nombre}: la dama debería seguir en ${backSq}`);
    const captura = copia.moves({ square: rookDest, verbose: true }).some((m) => m.to === backSq && m.captured === 'q');
    assert(captura, `${nombre}: tras ${resp.san} la torre debería poder capturar la dama en ${backSq}`);
  }
  record(id, nombre, 'rayos-x', fen, solucion);
}

function record(id, nombre, patternKey, fen, solucion) {
  items.push({ id, nombre, patternKey, fen, solucion: [solucion] });
  console.log(`OK  ${nombre} (${patternKey})`);
}

// --- Mates típicos (RF-6.1) ---
mate('patron-mate-pasillo-1', 'Mate de pasillo', 'mate-pasillo', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8');
mate('patron-mate-pasillo-2', 'Mate de pasillo (otra torre)', 'mate-pasillo', '6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1', 'b1b8');
mate('patron-mate-pasillo-3', 'Mate de pasillo con la dama', 'mate-pasillo', '6k1/5ppp/8/8/8/8/8/Q5K1 w - - 0 1', 'a1a8');
mate('patron-mate-escalera-1', 'Mate de la escalera', 'mate-escalera', '7k/1R6/8/8/8/8/8/R6K w - - 0 1', 'a1a8');
mate('patron-mate-escalera-2', 'Mate de la escalera (muro en c7)', 'mate-escalera', '7k/2R5/8/8/8/8/8/R6K w - - 0 1', 'a1a8');
mate('patron-mate-escalera-3', 'Mate de la escalera en la esquina', 'mate-escalera', 'k7/6R1/8/8/8/8/8/2R4K w - - 0 1', 'c1c8');
mate('patron-mate-dama-rey-1', 'Mate de dama y rey', 'mate-dama-rey', '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1', 'g1g7');
mate('patron-mate-dama-rey-2', 'Mate de dama y rey (al lado del rey)', 'mate-dama-rey', '7k/8/5K1Q/8/8/8/8/8 w - - 0 1', 'h6g7');
mate('patron-mate-dama-rey-3', 'Mate de dama y rey en la esquina', 'mate-dama-rey', 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1', 'b1b7');
mate('patron-mate-coz-1', 'Mate de la coz (ahogado)', 'mate-coz', '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', 'g5f7');
mate('patron-mate-coz-2', 'Mate de la coz (desde h6)', 'mate-coz', '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1', 'h6f7');

// --- Motivos tácticos (RF-6.1) ---
horquilla('patron-horquilla-1', 'Horquilla de caballo', '4k1q1/8/8/3N4/8/8/8/K7 w - - 0 1', 'd5f6', 'g8');
horquilla('patron-horquilla-2', 'Horquilla de rey y dama en la esquina', 'q3k3/8/8/1N6/8/8/8/6K1 w - - 0 1', 'b5c7', 'a8');
horquilla('patron-horquilla-3', 'Horquilla con jaque a rey y dama', '4k3/8/8/3q4/4N3/8/8/K7 w - - 0 1', 'e4f6', 'd5');
clavada('patron-clavada-1', 'Clavada absoluta', '4k3/8/2n5/8/1N6/3B4/8/K7 w - - 0 1', 'd3b5', 'c6');
clavada('patron-clavada-2', 'Clavada del caballo en la diagonal', 'k7/1n6/8/3B4/8/8/8/K7 w - - 0 1', 'd5c6', 'b7');
clavada('patron-clavada-3', 'Clavada del caballo con la torre', '4k3/8/4n3/8/8/8/8/R6K w - - 0 1', 'a1e1', 'e6');
descubierta('patron-descubierta-1', 'Jaque a la descubierta', '4k3/8/2q5/4N3/8/8/8/4R1K1 w - - 0 1', 'e5c6', 'e1');
rayosX('patron-rayos-x-1', 'Rayos X (enfilada de rey y dama)', '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1', 'a1e1', 'e8');
rayosX('patron-rayos-x-2', 'Rayos X en la fila', '8/8/8/8/q3k3/8/6K1/7R w - - 0 1', 'h1h4', 'a4');

console.log(`\n${items.length} posiciones verificadas OK.`);
