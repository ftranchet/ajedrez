// Busca posiciones "ricas" para el ejercicio de Stoyko semanal (E7, RF-7.2):
// varias jugadas genuinamente competitivas (no una sola claramente mejor,
// como en el Radar) en una posición sin definir. Autojuego del motor local
// (sin acceso a partidas reales en este entorno, ver docs/roadmap.md),
// cribado con MultiPV a profundidad 14 (mismo estándar que
// scripts/lib/quietPositions.mjs) y reconfirmación a profundidad 17 antes de
// aceptar — la lección de scripts/mine-doble-solucion.mjs es que 14 sola no
// alcanza para afirmaciones finas sobre qué tan cerca están las candidatas.
// Verificación final de legalidad de la línea con chess.js, nunca de memoria.
//
// Uso: node scripts/mine-stoyko.mjs --target 8 --max-checked 800
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const SELFPLAY_DEPTH = 7;
const SCREEN_DEPTH = 14;
const RECONFIRM_DEPTH = 17;
const GAP_MAX_CP = 50; // best - tercera candidata: cuanto más chico, más "empatadas" están.
const EVAL_CAP_CP = 150; // |mejor jugada| ≤ esto: posición sin definir, no una ventaja clara ya jugada.
const MEJOR_LINEA_PLIES = 3;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'stoykoSeedData.ts');

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

function esRica(lines) {
  const [best, , third] = lines;
  if (!best || !third) return false;
  if (Math.abs(best.score) > EVAL_CAP_CP) return false;
  return best.score - third.score <= GAP_MAX_CP;
}

// Máximo de candidatas aceptadas de UN MISMO autojuego: sin esto, una vez
// que un juego entra en una posición "rica", suele seguir siéndolo varias
// jugadas seguidas (la posición cambia poco de un ply al siguiente), y el
// catálogo termina con varias entradas casi idénticas del mismo juego/
// apertura en vez de posiciones realmente variadas.
const MAX_POR_JUEGO = 1;

async function selfPlayPositions(engine, maxPlies) {
  const chess = new Chess();
  const positions = [];
  for (let i = 0; i < maxPlies; i++) {
    if (chess.isGameOver()) break;
    if (i >= 16 && i % 2 === 0 && materialOnBoard(chess) >= 10) positions.push(chess.fen());
    // Primeras jugadas al azar entre las top-3 del motor (en vez de siempre
    // la mejor): sin esto, cada autojuego repite la misma línea "principal"
    // determinística y todos los juegos convergen a la misma apertura.
    const candidateCount = i < 8 ? 3 : 1;
    const lines = await engine.analyseMultiPv(chess.fen(), candidateCount, SELFPLAY_DEPTH);
    const pick = i < 8 ? lines[Math.floor(Math.random() * Math.min(lines.length, 3))] : lines[0];
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

// Mismos umbrales que core/analysis.ts#evalToSymbol (perspectiva blancas);
// duplicado acá porque los scripts no importan TypeScript de src/.
function evalToSymbol(cpBlancas) {
  if (cpBlancas >= 150) return '+-';
  if (cpBlancas >= 50) return '±';
  if (cpBlancas > -50) return '=';
  if (cpBlancas > -150) return '∓';
  return '-+';
}

function verificarLineaLegal(fen, uciMoves) {
  const chess = new Chess(fen);
  for (const uci of uciMoves) {
    const legales = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    if (!legales.includes(uci)) return false;
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return true;
}

function renderSeedModule(items) {
  const body = items
    .map(
      (item) =>
        `  {\n    id: ${JSON.stringify(item.id)},\n    fen: ${JSON.stringify(item.fen)},\n    mejorLinea: ${JSON.stringify(item.mejorLinea)},\n    evaluacionMotor: ${JSON.stringify(item.evaluacionMotor)},\n    fuente: ${JSON.stringify(item.fuente)},\n  },`,
    )
    .join('\n');
  return `// Catálogo del ejercicio de Stoyko semanal (E7, RF-7.2): posiciones "ricas"
// (varias jugadas genuinamente competitivas, sin ganador claro) obtenidas
// por autojuego del motor local y verificadas con MultiPV a profundidad 14 +
// reconfirmación a 17 (scripts/mine-stoyko.mjs; metodología documentada en
// docs/radar-dataset.md). Set inicial deliberadamente chico: a un ejercicio
// por semana, alcanza para varios meses sin repetir. \`mejorLinea\` son las
// primeras ${MEJOR_LINEA_PLIES} jugadas de la variante principal del motor a
// profundidad ${RECONFIRM_DEPTH}, verificadas legales con chess.js.
import type { StoykoItem } from '../../core/types';

export const STOYKO_DATASET_VERSION = ${JSON.stringify(`stoyko-v1-${items.length}`)};

export const seedStoykoItems: StoykoItem[] = [
${body}
];
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = Number(options.target ?? 8);
  const maxChecked = Number(options['max-checked'] ?? 800);

  const engine = new StockfishEngine();
  await engine.init();

  const found = [];
  const seenFens = new Set();
  let checked = 0;

  try {
    while (found.length < target && checked < maxChecked) {
      const positions = await selfPlayPositions(engine, 30 + Math.floor(Math.random() * 15));
      let aceptadasDeEsteJuego = 0;
      for (const fen of positions) {
        if (found.length >= target || checked >= maxChecked) break;
        if (aceptadasDeEsteJuego >= MAX_POR_JUEGO) break;
        if (seenFens.has(fen)) continue;
        seenFens.add(fen);
        checked++;

        const screen = await engine.analyseMultiPv(fen, 3, SCREEN_DEPTH);
        if (!esRica(screen)) continue;

        const confirm = await engine.analyseMultiPv(fen, 3, RECONFIRM_DEPTH);
        if (!esRica(confirm)) continue;

        const best = confirm[0];
        const mejorLinea = best.pv.slice(0, MEJOR_LINEA_PLIES);
        if (!verificarLineaLegal(fen, mejorLinea)) continue;

        const turnoNegras = fen.split(' ')[1] === 'b';
        const cpBlancas = turnoNegras ? -best.score : best.score;

        found.push({
          id: `stoyko-${String(found.length + 1).padStart(2, '0')}`,
          fen,
          mejorLinea,
          evaluacionMotor: evalToSymbol(cpBlancas),
          fuente: 'pipeline-stoyko',
        });
        aceptadasDeEsteJuego++;
        console.error(`Candidata ${found.length}/${target} (tras ${checked} posiciones revisadas): ${fen} → ${mejorLinea.join(' ')}`);
      }
      console.error(`Progreso: ${checked} posiciones revisadas, ${found.length}/${target} candidatas.`);
    }
  } finally {
    engine.quit();
  }

  if (found.length < target) {
    console.error(`No se alcanzó el objetivo: ${found.length}/${target}. Volvé a correr el script (o subí --max-checked).`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(SEED_PATH, renderSeedModule(found));
  console.error(`Listo: ${found.length} posiciones escritas en ${SEED_PATH}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
