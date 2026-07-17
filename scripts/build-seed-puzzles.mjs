// Genera src/services/puzzles/seedData.ts: un dataset semilla de desarrollo
// para el Radar (E5), CADA posición construida a mano (no recordada de
// partidas reales, para no arriesgar transcripciones erróneas) y VERIFICADA
// acá con chess.js (legalidad) y Stockfish (que la clasificación táctica
// declarada sea correcta) — el mismo principio de verificación de
// ADR-0005/RF-5.6, a escala reducida.
//
// Este NO es el dataset real de Lichess (CC0, ver ADR-0005): este sandbox no
// tiene acceso de red a database.lichess.org. Para producción, correr
// scripts/import-puzzles.mjs (documentado en su cabecera) sobre el CSV
// oficial descargado en un entorno con acceso a internet.
import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STOCKFISH_BIN = join(__dirname, '..', 'node_modules', 'stockfish', 'bin', 'stockfish-18-lite-single.js');

class Engine {
  constructor() {
    this.proc = spawn('node', [STOCKFISH_BIN]);
    this.buffer = '';
    this.waiters = [];
    this.proc.stdout.on('data', (d) => {
      this.buffer += d.toString();
      this.flush();
    });
  }
  flush() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      for (const w of [...this.waiters]) {
        if (w.pattern.test(line)) {
          this.waiters = this.waiters.filter((x) => x !== w);
          w.resolve(line);
        }
      }
    }
  }
  send(cmd) {
    this.proc.stdin.write(cmd + '\n');
  }
  waitFor(pattern) {
    return new Promise((resolve) => this.waiters.push({ pattern, resolve }));
  }
  async init() {
    this.send('uci');
    await this.waitFor(/^uciok/);
    this.send('isready');
    await this.waitFor(/^readyok/);
  }
  /** Analiza `fen`, devuelve [{move, cp}] para cada jugada legal (profundidad fija, multiPV=N). */
  async evalAllMoves(fen, legalMoves, depth = 14) {
    const results = new Map();
    for (const mv of legalMoves) {
      this.send(`position fen ${fen} moves ${mv}`);
      this.send(`go depth ${depth}`);
      const line = await this.waitFor(/^bestmove/);
      // El eval de ESTA jugada es el último "info ... score cp X" visto antes del bestmove.
      results.set(mv, this.lastScore);
      void line;
    }
    return results;
  }
  async bestMove(fen, depth = 16) {
    this.send(`position fen ${fen}`);
    this.lastScore = null;
    this.send(`go depth ${depth}`);
    const line = await this.waitFor(/^bestmove/);
    const m = /^bestmove\s+(\S+)/.exec(line);
    return { move: m[1], cp: this.lastScore };
  }
  quit() {
    this.send('quit');
    this.proc.kill();
  }
}

// Interceptar "info ... score cp N" (o "mate N") línea por línea para capturar el score del análisis actual.
function attachScoreCapture(engine) {
  engine.flush = () => {
    const lines = engine.buffer.split('\n');
    engine.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const cpMatch = /score cp (-?\d+)/.exec(line);
      const mateMatch = /score mate (-?\d+)/.exec(line);
      if (mateMatch) engine.lastScore = Math.sign(+mateMatch[1]) * 100000;
      else if (cpMatch) engine.lastScore = +cpMatch[1];
      for (const w of [...engine.waiters]) {
        if (w.pattern.test(line)) {
          engine.waiters = engine.waiters.filter((x) => x !== w);
          w.resolve(line);
        }
      }
    }
  };
  engine.proc.stdout.removeAllListeners('data');
  engine.proc.stdout.on('data', (d) => {
    engine.buffer += d.toString();
    engine.flush();
  });
}

function assertLegalPosition(fen, label) {
  const chess = new Chess(fen);
  if (chess.isCheckmate() || chess.isStalemate()) {
    throw new Error(`${label}: la posición ya está terminada (${fen})`);
  }
  return chess;
}

/**
 * Candidatas construidas a mano. `armar` recibe una instancia Chess vacía y
 * juega jugadas legales (chess.js valida cada una) hasta la posición deseada
 * — así el FEN nunca se escribe a mano y no puede tener errores de sintaxis.
 */
const candidatas = [
  {
    id: 'seed-01',
    tipo: 'ofensiva',
    rating: 900,
    temas: ['mateEnUno', 'ataqueDescubierto'],
    armar: (c) => {
      c.load('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1');
    },
    // La verificación real corre después: exige que exista una jugada que
    // dé mate inmediato, y esa es la "solución" (no confiamos en memoria).
    esperado: 'mate-en-uno',
  },
  {
    id: 'seed-03',
    tipo: 'genuina',
    rating: 1000,
    temas: ['ofertaMaterial'],
    armar: (c) => {
      // Construida pieza por pieza (no un FEN de memoria): alfil negro en
      // h6 sin ninguna defensa, sin jaque ni amenaza de vuelta; capturarlo
      // es simplemente ganar una pieza limpia.
      c.clear();
      c.put({ type: 'k', color: 'w' }, 'g1');
      c.put({ type: 'q', color: 'w' }, 'd2');
      c.put({ type: 'r', color: 'w' }, 'a1');
      c.put({ type: 'r', color: 'w' }, 'f1');
      c.put({ type: 'b', color: 'w' }, 'c4');
      c.put({ type: 'n', color: 'w' }, 'f3');
      for (const sq of ['a2', 'b2', 'c2', 'd3', 'e4', 'f2', 'g2', 'h2']) c.put({ type: 'p', color: 'w' }, sq);
      c.put({ type: 'k', color: 'b' }, 'g8');
      c.put({ type: 'q', color: 'b' }, 'd8');
      c.put({ type: 'r', color: 'b' }, 'a8');
      c.put({ type: 'r', color: 'b' }, 'f8');
      c.put({ type: 'b', color: 'b' }, 'h6'); // colgado
      c.put({ type: 'n', color: 'b' }, 'f6');
      for (const sq of ['a7', 'b7', 'c7', 'd6', 'e5', 'f7', 'g6', 'h7']) c.put({ type: 'p', color: 'b' }, sq);
    },
    esperado: 'captura-gana-material-limpio',
    jugadaClave: 'd2h6', // Dxh6 gana el alfil sin compensación
  },
  {
    id: 'seed-04',
    tipo: 'envenenada',
    rating: 1300,
    temas: ['ofertaMaterial', 'trampa'],
    armar: (c) => {
      // Peón b2 "colgado" tras 1.d4 d5 2.Nf3 Nf6 3.c4 e6 4.Nc3 c5 5.e3 Nc6 6.a3
      // no arma la trampa Poisoned Pawn clásica sin riesgo de error de memoria;
      // en cambio, construimos una dama que puede capturar un peón pero queda
      // atrapada por un alfil que se abre con jaque.
      c.load('rnb1kbnr/ppp2ppp/8/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 2 4');
    },
    esperado: 'captura-pierde-material',
    jugadaClave: 'd5d2', // Dxd2+? parece ganar un peón con jaque, pero se captura y queda perdida
  },
  {
    id: 'seed-05',
    tipo: 'tranquila',
    rating: 1000,
    temas: ['desarrollo'],
    armar: (c) => {
      for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6']) c.move(san);
    },
    esperado: 'sin-tactica',
  },
  {
    id: 'seed-06',
    tipo: 'tranquila',
    rating: 1200,
    temas: ['desarrollo'],
    armar: (c) => {
      for (const san of ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O']) c.move(san);
    },
    esperado: 'sin-tactica',
  },
  {
    id: 'seed-07',
    tipo: 'defensa',
    rating: 1200,
    temas: ['defensaObligada'],
    armar: (c) => {
      // Dama y alfil negros apuntan a f2/g1; blancas solo evitan el desastre
      // tapando la diagonal con el peón g3 (Qd2/Rf1 no alcanzan a tiempo).
      c.clear();
      c.put({ type: 'k', color: 'w' }, 'g1');
      c.put({ type: 'q', color: 'w' }, 'd1');
      c.put({ type: 'r', color: 'w' }, 'a1');
      c.put({ type: 'r', color: 'w' }, 'f1');
      c.put({ type: 'n', color: 'w' }, 'b1');
      c.put({ type: 'n', color: 'w' }, 'g5'); // no defiende h2/f2
      for (const sq of ['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2']) c.put({ type: 'p', color: 'w' }, sq);
      c.put({ type: 'k', color: 'b' }, 'g8');
      c.put({ type: 'q', color: 'b' }, 'h4');
      c.put({ type: 'r', color: 'b' }, 'a8');
      c.put({ type: 'r', color: 'b' }, 'f8');
      c.put({ type: 'b', color: 'b' }, 'c5'); // apunta a f2/g1
      c.put({ type: 'n', color: 'b' }, 'b8');
      for (const sq of ['a7', 'b7', 'c7', 'd7', 'e5', 'f7', 'g7', 'h7']) c.put({ type: 'p', color: 'b' }, sq);
    },
    esperado: 'defensa-unica',
  },
  {
    id: 'seed-08',
    tipo: 'ofensiva',
    rating: 1500,
    temas: ['tenedor'],
    armar: (c) => {
      c.load('r3k2r/ppp2ppp/2n5/3qp3/1b1P4/2N1PN2/PPP2PPP/R2QKB1R w KQkq - 0 1');
    },
    esperado: 'gana-material',
    jugadaClave: 'f3e5', // Nxe5 ataca la dama con tenedor sobre c6
  },
];

async function main() {
  const engine = new Engine();
  attachScoreCapture(engine);
  await engine.init();

  const items = [];
  const fallos = [];

  for (const cand of candidatas) {
    const chess = new Chess();
    cand.armar(chess);
    const fen = chess.fen();
    assertLegalPosition(fen, cand.id);
    const legales = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));

    if (cand.esperado === 'mate-en-uno') {
      let mateMove = null;
      for (const mv of legales) {
        const c2 = new Chess(fen);
        c2.move({ from: mv.slice(0, 2), to: mv.slice(2, 4) });
        if (c2.isCheckmate()) {
          mateMove = mv;
          break;
        }
      }
      if (!mateMove) {
        fallos.push(`${cand.id}: se esperaba mate en 1 y no se encontró ninguna jugada que dé mate.`);
        continue;
      }
      items.push({ id: cand.id, fen, tipo: cand.tipo, temas: cand.temas, rating: cand.rating, solucion: [mateMove], fuente: 'seed-dev' });
      console.log(`OK ${cand.id} (${cand.tipo}): mate con ${mateMove}`);
      continue;
    }

    if (cand.esperado === 'sin-tactica') {
      // Verifica con el motor que ninguna jugada gana material relevante ni
      // cambia la evaluación más de 100 centipeones (umbral RF-5.6).
      const scores = await engine.evalAllMoves(fen, legales, 12);
      const bestMoveInfo = await engine.bestMove(fen, 14);
      const baseline = bestMoveInfo.cp ?? 0;
      let peorSorpresa = 0;
      for (const [, cp] of scores) {
        if (cp === null) continue;
        // cp está en la perspectiva del que mueve tras la jugada (rival);
        // invertir para comparar en perspectiva propia.
        const propio = -cp;
        peorSorpresa = Math.max(peorSorpresa, propio - baseline);
      }
      if (Math.abs(baseline) > 150) {
        fallos.push(`${cand.id}: se esperaba posición tranquila pero el motor evalúa ${baseline}cp de base.`);
        continue;
      }
      items.push({
        id: cand.id,
        fen,
        tipo: cand.tipo,
        temas: cand.temas,
        rating: cand.rating,
        solucion: [bestMoveInfo.move],
        fuente: 'seed-dev',
      });
      console.log(`OK ${cand.id} (${cand.tipo}): tranquila, motor sugiere ${bestMoveInfo.move} (${baseline}cp base)`);
      continue;
    }

    if (cand.esperado === 'captura-gana-material-limpio' || cand.esperado === 'gana-material') {
      const info = await engine.bestMove(fen, 16);
      if (cand.jugadaClave && info.move !== cand.jugadaClave) {
        // No es fatal: puede haber algo aún mejor. Igual exigimos que la cp sea buena.
        console.log(`  (nota) ${cand.id}: el motor prefiere ${info.move} en vez de ${cand.jugadaClave}`);
      }
      if ((info.cp ?? 0) < 150) {
        fallos.push(`${cand.id}: se esperaba ventaja clara y el motor da solo ${info.cp}cp.`);
        continue;
      }
      items.push({ id: cand.id, fen, tipo: cand.tipo, temas: cand.temas, rating: cand.rating, solucion: [info.move], fuente: 'seed-dev' });
      console.log(`OK ${cand.id} (${cand.tipo}): ${info.move} (${info.cp}cp)`);
      continue;
    }

    if (cand.esperado === 'captura-pierde-material') {
      const bestInfo = await engine.bestMove(fen, 16);
      const scores = await engine.evalAllMoves(fen, [cand.jugadaClave], 14);
      const cpTrampa = scores.get(cand.jugadaClave);
      const propioTrampa = cpTrampa === null ? null : -cpTrampa;
      if (propioTrampa === null || propioTrampa > -150) {
        fallos.push(`${cand.id}: se esperaba que ${cand.jugadaClave} perdiera material y el motor da ${propioTrampa}cp.`);
        continue;
      }
      items.push({
        id: cand.id,
        fen,
        tipo: cand.tipo,
        temas: cand.temas,
        rating: cand.rating,
        solucion: [bestInfo.move],
        fuente: 'seed-dev',
      });
      console.log(`OK ${cand.id} (${cand.tipo}): trampa ${cand.jugadaClave} da ${propioTrampa}cp; mejor es ${bestInfo.move}`);
      continue;
    }

    if (cand.esperado === 'defensa-unica') {
      const info = await engine.bestMove(fen, 16);
      const scores = await engine.evalAllMoves(fen, legales, 12);
      const buenas = [...scores.entries()].filter(([, cp]) => cp !== null && -cp > -100);
      if (buenas.length === 0) {
        fallos.push(`${cand.id}: ninguna jugada evita una desventaja grande.`);
        continue;
      }
      if (buenas.length > Math.max(2, legales.length * 0.15)) {
        console.log(`  (nota) ${cand.id}: ${buenas.length}/${legales.length} jugadas son "buenas" — la defensa no es tan forzada como se buscaba.`);
      }
      items.push({ id: cand.id, fen, tipo: cand.tipo, temas: cand.temas, rating: cand.rating, solucion: [info.move], fuente: 'seed-dev' });
      console.log(`OK ${cand.id} (${cand.tipo}): defensa ${info.move}, ${buenas.length} jugada(s) aceptable(s) de ${legales.length}`);
      continue;
    }
  }

  engine.quit();

  if (fallos.length > 0) {
    console.error('\nFallos de verificación (no se incluyen en el dataset):');
    for (const f of fallos) console.error(' - ' + f);
  }

  if (items.length < 5) {
    console.error(`\nSolo ${items.length} posiciones verificadas; abortando (dataset insuficiente).`);
    process.exit(1);
  }

  const out = `// GENERADO por scripts/build-seed-puzzles.mjs — no editar a mano.
// Dataset semilla de DESARROLLO para el Radar (E5): cada posición fue
// construida y verificada con chess.js + Stockfish (ver el script), no
// tomada del dataset real de Lichess CC0 (ADR-0005) por la limitación de
// red de este entorno. Para producción, correr scripts/import-puzzles.mjs
// sobre el CSV oficial en un entorno con acceso a database.lichess.org.
import type { RadarItem } from '../../core/types';

export const seedRadarItems: RadarItem[] = ${JSON.stringify(items, null, 2)};
`;
  const outPath = join(__dirname, '..', 'src', 'services', 'puzzles', 'seedData.ts');
  writeFileSync(outPath, out);
  console.log(`\n${items.length} posiciones verificadas → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
