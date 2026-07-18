// Genera posiciones "envenenada" reales (RF-5.1: oferta de material
// envenenada) por autojuego del motor local. A diferencia de las tácticas de
// Lichess —cuya solución es una jugada a JUGAR—, una envenenada es una
// posición donde una captura PARECE ganar material gratis pero es una trampa,
// y la jugada correcta es DECLINARLA. Ese tipo no se puede sacar de puzzles
// tácticos (auditoría 2026-07), así que se genera aparte, igual que las
// tranquilas.
//
// Criterio (perspectiva del que mueve S), criba a profundidad 14 y
// reconfirmación a 17:
//   - La mejor jugada NO es una captura (S declina material).
//   - Existe una captura C que parece ganar material (neto ≥1 a 1 ply) pero el
//     motor la condena: score(C) ≤ mejor − TRAP_MARGIN.
//   - La posición no está ya decidida (|mejor| ≤ EVAL_CAP): es una decisión
//     genuina de "¿me como esto o no?".
//   - 1 posición por partida de autojuego, para variedad real.
//
// Uso: node scripts/mine-envenenada.mjs --target 12 --max-checked 4000 --checkpoint /ruta/checkpoint.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const SELFPLAY_DEPTH = 7;
const SCREEN_DEPTH = 14;
const RECONFIRM_DEPTH = 17;
const TRAP_MARGIN = 150; // cp: cuánto peor que la mejor debe ser la captura-carnada
const EVAL_CAP = 300; // |mejor| ≤ esto: posición sin decidir, decisión genuina
const MAX_POR_JUEGO = 1;
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    options[arg.slice(2)] = argv[i + 1];
    i++;
  }
  return options;
}

function materialOnBoard(chess) {
  let count = 0;
  for (const row of chess.board()) for (const sq of row) if (sq && sq.type !== 'k') count++;
  return count;
}

/** Material neto (perspectiva del que mueve) de capturar en `to`, con recaptura a 1 ply. */
function netoCaptura(fen, uci) {
  const chess = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const mv = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
  if (!mv || !mv.captured) return null;
  chess.move({ from, to, promotion: uci[4] || undefined });
  const recaptura = chess.moves({ verbose: true }).some((m) => m.to === to && m.captured);
  return VAL[mv.captured] - (recaptura ? VAL[mv.piece] : 0);
}

function esCaptura(fen, uci) {
  const chess = new Chess(fen);
  const mv = chess.moves({ verbose: true }).find((m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4));
  return !!mv?.captured;
}

/** ¿La posición cumple la definición de envenenada a la profundidad dada? */
async function evaluarEnvenenada(engine, fen, depth) {
  const chess = new Chess(fen);
  const legales = chess.moves({ verbose: true });
  const ranked = await engine.analyseMultiPv(fen, legales.length, depth);
  if (ranked.length === 0) return null;
  const best = ranked[0];
  if (Math.abs(best.score) > EVAL_CAP) return null; // ya decidida
  if (esCaptura(fen, best.move)) return null; // la mejor debe declinar material
  const scoreDe = new Map(ranked.map((m) => [m.move, m.score]));
  const carnada = legales.some((m) => {
    if (!m.captured) return false;
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`;
    const neto = netoCaptura(fen, uci);
    if (neto === null || neto < 1) return false; // debe parecer material gratis
    const sc = scoreDe.get(uci);
    return sc !== undefined && best.score - sc >= TRAP_MARGIN;
  });
  return carnada ? { mejor: best.move } : null;
}

async function selfPlayPositions(engine, maxPlies) {
  const chess = new Chess();
  const positions = [];
  for (let i = 0; i < maxPlies; i++) {
    if (chess.isGameOver()) break;
    if (i >= 10 && materialOnBoard(chess) >= 8) positions.push(chess.fen());
    // Autojuego con bastante aleatoriedad (top-3 durante los primeros 16 plies):
    // un juego "perfecto" casi no deja material colgado, y la envenenada
    // necesita justamente posiciones con una pieza ofrecida como carnada. Más
    // desequilibrio → más candidatas. Muestrea cada ply (no cada 2) para no
    // perder posiciones tras la fase de aleatoriedad.
    const aleatorio = i < 16;
    const lines = await engine.analyseMultiPv(chess.fen(), aleatorio ? 3 : 1, SELFPLAY_DEPTH);
    const pick = aleatorio ? lines[Math.floor(Math.random() * Math.min(lines.length, 3))] : lines[0];
    const mv = pick?.move;
    if (!mv) break;
    try {
      chess.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
    } catch {
      break;
    }
  }
  return positions;
}

function loadCheckpoint(path) {
  if (!path || !existsSync(path)) return { checked: 0, found: [], seenFens: [] };
  return JSON.parse(readFileSync(path, 'utf8'));
}

function saveCheckpoint(path, state) {
  if (!path) return;
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = Number(options.target ?? 12);
  const maxChecked = Number(options['max-checked'] ?? 4000);
  const checkpointPath = options.checkpoint;

  const state = loadCheckpoint(checkpointPath);
  const seenFens = new Set(state.seenFens);
  console.error(`Arrancando con ${state.found.length} candidatas y ${state.checked} posiciones revisadas.`);

  const engine = new StockfishEngine();
  await engine.init();

  try {
    while (state.found.length < target && state.checked < maxChecked) {
      const positions = await selfPlayPositions(engine, 26 + Math.floor(Math.random() * 14));
      let aceptadasDeEsteJuego = 0;
      for (const fen of positions) {
        if (state.found.length >= target || state.checked >= maxChecked) break;
        if (aceptadasDeEsteJuego >= MAX_POR_JUEGO) break;
        if (seenFens.has(fen)) continue;
        seenFens.add(fen);
        state.checked++;

        const screen = await evaluarEnvenenada(engine, fen, SCREEN_DEPTH);
        if (!screen) continue;
        const confirm = await evaluarEnvenenada(engine, fen, RECONFIRM_DEPTH);
        if (!confirm || confirm.mejor !== screen.mejor) continue; // debe sostenerse a 17 con la misma jugada

        // Verificación de legalidad de la solución con chess.js.
        const chess = new Chess(fen);
        const legal = chess.moves({ verbose: true }).some((m) => `${m.from}${m.to}${m.promotion ?? ''}` === confirm.mejor);
        if (!legal) continue;

        state.found.push({ fen, solucion: confirm.mejor });
        aceptadasDeEsteJuego++;
        console.error(`Candidata ${state.found.length}/${target} (tras ${state.checked}): ${fen} → declina, juega ${confirm.mejor}`);
      }
      state.seenFens = [...seenFens];
      saveCheckpoint(checkpointPath, state);
      console.error(`Progreso: ${state.checked} revisadas, ${state.found.length}/${target} candidatas.`);
    }
  } finally {
    engine.quit();
  }

  state.seenFens = [...seenFens];
  saveCheckpoint(checkpointPath, state);
  console.error(`Terminado: ${state.found.length}/${target} candidatas tras revisar ${state.checked} posiciones.`);
  if (state.found.length < target) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
