// Verifica cada posición del currículo de patrones (E6, RF-6.1) antes de
// embeberla en src/services/puzzles/curriculumSeedData.ts: nunca se confía
// en una posición de memoria (lección de docs/roadmap.md — dos veces en Fase
// 2 un PGN "recordado" resultó ilegal). Cada patrón se verifica con la regla
// de ajedrez que realmente demuestra el motivo (mate forzado, jaque no
// bloqueable con la pieza atacada indefensa, pieza clavada sin jugadas
// legales, o el atacante detrás de un jaque descubierto siendo distinto del
// que se movió), usando chess.js como árbitro — nunca la palabra del autor.
//
// Uso: node scripts/verify-curriculum-patrones.mjs
import { Chess } from 'chess.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`FALLÓ: ${msg}`);
}

const items = [];

function check(id, nombre, patternKey, fen, solucion, verify) {
  const chess = new Chess(fen);
  assert(!chess.isCheck(), `${nombre}: el rey ya está en jaque antes de la jugada solución`);
  const from = solucion.slice(0, 2);
  const to = solucion.slice(2, 4);
  const legal = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
  assert(legal, `${nombre}: la jugada solución ${solucion} no es legal en la posición`);
  chess.move({ from, to });
  verify(chess, nombre);
  items.push({ id, nombre, patternKey, fen, solucion: [solucion] });
  console.log(`OK  ${nombre} (${patternKey})`);
}

// --- Mates típicos (RF-6.1) ---

check(
  'patron-mate-pasillo-1',
  'Mate de pasillo',
  'mate-pasillo',
  '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
  'a1a8',
  (c) => assert(c.isCheckmate(), 'no es mate'),
);

check(
  'patron-mate-escalera-1',
  'Mate de la escalera',
  'mate-escalera',
  '7k/1R6/8/8/8/8/8/R6K w - - 0 1',
  'a1a8',
  (c) => assert(c.isCheckmate(), 'no es mate'),
);

check(
  'patron-mate-dama-rey-1',
  'Mate de dama y rey',
  'mate-dama-rey',
  '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
  'g1g7',
  (c) => assert(c.isCheckmate(), 'no es mate'),
);

check(
  'patron-mate-coz-1',
  'Mate de la coz (ahogado)',
  'mate-coz',
  '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
  'g5f7',
  (c) => assert(c.isCheckmate(), 'no es mate'),
);

// --- Motivos tácticos (RF-6.1) ---

check(
  'patron-horquilla-1',
  'Horquilla de caballo',
  'horquilla',
  '4k1q1/8/8/3N4/8/8/8/K7 w - - 0 1',
  'd5f6',
  (c, nombre) => {
    assert(c.isCheck(), `${nombre}: la horquilla debería dar jaque`);
    assert(c.attackers('g8', 'w').includes('f6'), `${nombre}: el caballo no ataca la dama en g8`);
    assert(c.attackers('g8', 'b').length === 0, `${nombre}: la dama debería quedar indefensa`);
    const soloReyPuedeMover = c.moves({ verbose: true }).every((m) => m.piece === 'k');
    assert(soloReyPuedeMover, `${nombre}: debería ser jaque de caballo (no bloqueable) sin capturas posibles`);
  },
);

check(
  'patron-clavada-1',
  'Clavada absoluta',
  'clavada',
  '4k3/8/2n5/8/1N6/3B4/8/K7 w - - 0 1',
  'd3b5',
  (c, nombre) => {
    const movimientosCaballo = c.moves({ square: 'c6', verbose: true });
    assert(movimientosCaballo.length === 0, `${nombre}: el caballo clavado no debería tener jugadas legales`);
  },
);

check(
  'patron-descubierta-1',
  'Jaque a la descubierta',
  'descubierta',
  '4k3/8/8/8/8/4R3/4N3/4K3 w - - 0 1',
  'e2c3',
  (c, nombre) => {
    assert(c.isCheck(), `${nombre}: debería quedar en jaque`);
    const atacantes = c.attackers('e8', 'w');
    assert(atacantes.includes('e3'), `${nombre}: la torre e3 debería atacar al rey`);
    assert(!atacantes.includes('c3'), `${nombre}: el caballo que se movió no debería dar jaque directo`);
  },
);

check(
  'patron-rayos-x-1',
  'Rayos X (clavada de rey y dama)',
  'rayos-x',
  '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1',
  'a1e1',
  (c, nombre) => {
    assert(c.isCheck(), `${nombre}: debería dar jaque`);
    const respuestas = c.moves({ verbose: true });
    assert(respuestas.length > 0, `${nombre}: el rey debería tener alguna jugada legal`);
    for (const resp of respuestas) {
      const copia = new Chess(c.fen());
      copia.move(resp);
      assert(copia.get('e8')?.type === 'q', `${nombre}: la dama debería seguir en e8`);
      const capturaDisponible = copia.moves({ square: 'e1', verbose: true }).some((m) => m.to === 'e8' && m.captured === 'q');
      assert(capturaDisponible, `${nombre}: tras ${resp.san} la torre debería poder capturar la dama en e8`);
    }
  },
);

console.log(`\n${items.length} posiciones verificadas OK.`);
console.log(JSON.stringify(items, null, 2));
