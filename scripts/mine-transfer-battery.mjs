// Genera el instrumento separado de RF-12.2. Las posiciones salen de
// autojuegos nuevos y nunca se incorporan a ningún catálogo de entrenamiento.
// Se acepta una posición solo si la misma mejor jugada se mantiene entre la
// criba (profundidad 14) y la reconfirmación (17), con una segunda opción al
// menos 90 cp peor. Una posición por autojuego evita variantes casi idénticas.
//
// Uso: node scripts/mine-transfer-battery.mjs --target 30
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const SELFPLAY_DEPTH = 7;
const SCREEN_DEPTH = 14;
const CONFIRM_DEPTH = 17;
const MIN_GAP_CP = 90;
const MAX_ABS_EVAL_CP = 600;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(scriptDir, '..', 'src', 'services', 'puzzles', 'transferSeedData.ts');

function targetFromArgs(argv) {
  const at = argv.indexOf('--target');
  return at >= 0 ? Number(argv[at + 1]) : 30;
}

function applyUci(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

async function selfPlay(engine, maxPlies) {
  const chess = new Chess();
  const positions = [];
  for (let ply = 0; ply < maxPlies && !chess.isGameOver(); ply++) {
    if (ply >= 12) positions.push(chess.fen());
    const count = ply < 12 ? 3 : 1;
    const lines = await engine.analyseMultiPv(chess.fen(), count, SELFPLAY_DEPTH);
    const choices = lines.slice(0, Math.min(lines.length, count));
    const selected = choices[Math.floor(Math.random() * choices.length)];
    if (!selected?.move) break;
    try {
      applyUci(chess, selected.move);
    } catch {
      break;
    }
  }
  return positions;
}

function phaseOf(fen) {
  const fullmove = Number(fen.split(' ')[5]);
  if (fullmove <= 12) return 'temprana';
  if (fullmove <= 18) return 'media';
  return 'tardia';
}

function shuffled(values) {
  return values
    .map((value) => ({ value, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map(({ value }) => value);
}

function stableAndClear(screen, confirm) {
  const [screenBest, screenSecond] = screen;
  const [best, second] = confirm;
  if (!screenBest || !screenSecond || !best || !second) return false;
  if (screenBest.move !== best.move) return false;
  if (Math.abs(best.score) > MAX_ABS_EVAL_CP) return false;
  return best.score - second.score >= MIN_GAP_CP;
}

function render(items) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(items.map(({ fen, acceptedMoves }) => ({ fen, acceptedMoves }))))
    .digest('hex')
    .slice(0, 12);
  return `// GENERADO por scripts/mine-transfer-battery.mjs — no editar a mano.\n// Instrumento RF-12.2: catálogo reservado, sin feedback de soluciones y\n// deliberadamente separado de todos los catálogos de entrenamiento.\nimport type { TransferItem } from '../../core/types';\n\nexport const TRANSFER_DATASET_VERSION = ${JSON.stringify(`transfer-${fingerprint}`)};\n\nexport const seedTransferItems: TransferItem[] = ${JSON.stringify(items, null, 2)};\n`;
}

async function main() {
  const target = targetFromArgs(process.argv.slice(2));
  if (!Number.isInteger(target) || target < 6 || target % 6 !== 0) {
    throw new Error('--target debe ser un entero positivo divisible por 6 para balancear fases y colores.');
  }
  const engine = new StockfishEngine();
  await engine.init();
  const found = [];
  const seen = new Set();
  const phaseCounts = { temprana: 0, media: 0, tardia: 0 };
  const colorCounts = { w: 0, b: 0 };

  try {
    while (found.length < target) {
      const positions = await selfPlay(engine, 42 + Math.floor(Math.random() * 18));
      for (const fen of shuffled(positions)) {
        if (found.length >= target) break;
        if (seen.has(fen)) continue;
        seen.add(fen);
        const phase = phaseOf(fen);
        const color = fen.split(' ')[1];
        if (phaseCounts[phase] >= target / 3 || colorCounts[color] >= target / 2) continue;
        const screen = await engine.analyseMultiPv(fen, 2, SCREEN_DEPTH);
        const confirm = await engine.analyseMultiPv(fen, 2, CONFIRM_DEPTH);
        if (!stableAndClear(screen, confirm)) continue;
        const best = confirm[0];
        const chess = new Chess(fen);
        try {
          applyUci(chess, best.move);
        } catch {
          continue;
        }
        found.push({
          id: `transfer-${String(found.length + 1).padStart(2, '0')}`,
          fen,
          acceptedMoves: [best.move],
          source: 'pipeline-transfer',
          verificationDepth: CONFIRM_DEPTH,
        });
        phaseCounts[phase]++;
        colorCounts[color]++;
        console.error(`Transfer ${found.length}/${target}: ${fen} -> ${best.move}`);
        break;
      }
    }
  } finally {
    engine.quit();
  }

  writeFileSync(OUTPUT, render(found));
  console.error(`Listo: ${found.length} posiciones reservadas en ${OUTPUT}. Fases=${JSON.stringify(phaseCounts)} colores=${JSON.stringify(colorCounts)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
