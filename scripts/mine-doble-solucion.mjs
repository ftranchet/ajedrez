// Explora posiciones de autojuego del motor (no hay acceso a partidas reales
// en este entorno, ver docs/roadmap.md) buscando candidatas de doble
// solución (RF-5.7): una jugada "familiar" que gana con claridad, y otra
// claramente superior. Verificación con MultiPV a profundidad 14 — mismo
// estándar de rigor que ya usa el pipeline de posiciones tranquilas
// (scripts/lib/quietPositions.mjs, DEFAULT_QUIET_CONFIG.verificationDepth).
// Resumible: guarda progreso en --checkpoint para poder cortar y seguir.
//
// Uso: node scripts/mine-doble-solucion.mjs --target 6 --max-checked 1200 --checkpoint /tmp/doble-solucion.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const MATE_SCORE = 100000;
const MIN_FAMILIAR_SCORE = 80;
const MIN_GAP_CP = 120;
const SELFPLAY_DEPTH = 7;
const SCREEN_DEPTH = 14;

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

function gapEsClaro(best, second) {
  const bestEsMate = Math.abs(best.score) >= MATE_SCORE;
  const segundaEsMate = Math.abs(second.score) >= MATE_SCORE;
  if (bestEsMate && !segundaEsMate) return true;
  if (bestEsMate && segundaEsMate) return false;
  return best.score - second.score >= MIN_GAP_CP;
}

async function selfPlayPositions(engine, maxPlies) {
  const chess = new Chess();
  const positions = [];
  for (let i = 0; i < maxPlies; i++) {
    if (chess.isGameOver()) break;
    if (i >= 10 && i % 2 === 0 && materialOnBoard(chess) >= 8) positions.push(chess.fen());
    const lines = await engine.analyseMultiPv(chess.fen(), 1, SELFPLAY_DEPTH);
    const mv = lines[0]?.move;
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
  const target = Number(options.target ?? 6);
  const maxChecked = Number(options['max-checked'] ?? 1200);
  const checkpointPath = options.checkpoint;

  const state = loadCheckpoint(checkpointPath);
  const seenFens = new Set(state.seenFens);
  console.error(`Arrancando con ${state.found.length} candidatas y ${state.checked} posiciones ya revisadas.`);

  const engine = new StockfishEngine();
  await engine.init();

  try {
    while (state.found.length < target && state.checked < maxChecked) {
      const positions = await selfPlayPositions(engine, 30 + Math.floor(Math.random() * 15));
      for (const fen of positions) {
        if (state.found.length >= target || state.checked >= maxChecked) break;
        if (seenFens.has(fen)) continue;
        seenFens.add(fen);
        state.checked++;

        const lines = await engine.analyseMultiPv(fen, 3, SCREEN_DEPTH);
        const [best, second] = lines;
        if (!best || !second) continue;
        if (second.score < MIN_FAMILIAR_SCORE) continue;
        if (!gapEsClaro(best, second)) continue;

        state.found.push({ fen, superior: best.move, superiorScore: best.score, familiar: second.move, familiarScore: second.score });
        console.error(
          `Candidata ${state.found.length}/${target} (tras ${state.checked} posiciones): superior=${best.move}(${best.score}) familiar=${second.move}(${second.score})`,
        );
      }
      state.seenFens = [...seenFens];
      saveCheckpoint(checkpointPath, state);
      console.error(`Progreso: ${state.checked} posiciones revisadas, ${state.found.length}/${target} candidatas.`);
    }
  } finally {
    engine.quit();
  }

  state.seenFens = [...seenFens];
  saveCheckpoint(checkpointPath, state);
  console.error(`Terminado: ${state.found.length}/${target} candidatas tras revisar ${state.checked} posiciones.`);
  if (state.found.length < target) {
    console.error('No se alcanzó el objetivo. Volvé a correr el script con el mismo --checkpoint para seguir.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
