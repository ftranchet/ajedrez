// Marca, en cada posición `envenenada` del catálogo, CUÁL es la captura
// carnada y qué la refuta (RF-5.3).
//
// **Por qué el tablero no alcanza.** Una envenenada se define porque existe
// una captura que *parece* ganar material y la jugada correcta es declinarla.
// Identificar "capturas que parecen ganar" es aritmética de chess.js, pero en
// la mitad del lote publicado hay dos, tres o cuatro que cumplen ese criterio
// (enven-07 tiene cuatro: las cuatro promociones de dxc8). Cuál es *la* trampa
// lo decide el motor, no el conteo de material. Por eso este dato se calcula
// acá, fuera de línea, y viaja en el catálogo: la app nunca lo adivina.
//
// El criterio es el mismo que usó `mine-envenenada.mjs` para aceptar la
// posición —la carnada es la captura aparentemente ganadora que el motor más
// castiga— y la refutación son los primeros plies de su variante principal,
// re-verificados legales con chess.js antes de guardarse. Nunca se confía en
// la notación que devuelve el motor.
//
//   node scripts/build-carnadas.mjs [--depth 17] [--plies 4]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import { datasetVersion, renderSeedDataModule, validateRadarDataset } from './lib/radarDataset.mjs';
import { StockfishEngine } from './lib/stockfish.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');
const VALOR = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PROFUNDIDAD = Number(arg('depth', '17'));
const PLIES_REFUTACION = Number(arg('plies', '4'));
/** Mismo centinela que core/engineLevels.ts: un mate no se mide en centipeones. */
const CP_MATE = 100_000;

function loadItems() {
  const text = readFileSync(SEED_PATH, 'utf8');
  const marker = 'seedRadarItems: RadarItem[] = [';
  const start = text.indexOf(marker) + marker.length - 1;
  return JSON.parse(text.slice(start, text.lastIndexOf(']') + 1));
}

/** Material neto aparente de capturar, contando una sola recaptura. */
function netoAparente(fen, move) {
  if (!move.captured) return null;
  const chess = new Chess(fen);
  chess.move(move);
  const recaptura = chess.moves({ verbose: true }).some((m) => m.to === move.to && m.captured);
  return VALOR[move.captured] - (recaptura ? VALOR[move.piece] : 0);
}

/** Capturas que a ojo ganan material: las candidatas a carnada. */
function capturasAparentes(fen) {
  const chess = new Chess(fen);
  return chess
    .moves({ verbose: true })
    .map((move) => ({ move, neto: netoAparente(fen, move) }))
    .filter(({ neto }) => neto !== null && neto >= 1)
    .map(({ move, neto }) => ({ uci: `${move.from}${move.to}${move.promotion ?? ''}`, san: move.san, neto }));
}

async function multipv(engine, fen, lineas, depth) {
  engine.multipv.clear();
  engine.send('setoption name UCI_LimitStrength value false');
  engine.send(`setoption name MultiPV value ${lineas}`);
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send(`go depth ${depth}`);
  await engine.waitFor(/^bestmove\s+/);
  return [...engine.multipv.entries()].sort(([a], [b]) => a - b).map(([, linea]) => linea);
}

/** Los primeros plies de una línea UCI, en SAN, verificados legales acá. */
function sanVerificado(fen, uciMoves, maxPlies) {
  const chess = new Chess(fen);
  const san = [];
  for (const uci of uciMoves.slice(0, maxPlies)) {
    const move = chess
      .moves({ verbose: true })
      .find((m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4));
    if (!move) break;
    san.push(chess.move(move).san);
  }
  return san;
}

async function carnadaDe(engine, item) {
  const candidatas = capturasAparentes(item.fen);
  if (candidatas.length === 0) return null;

  // Se piden todas las líneas legales para tener el score de cada candidata en
  // la misma búsqueda; así "cuánto peor es" se mide contra la misma evaluación.
  const totalLegales = new Chess(item.fen).moves().length;
  const lineas = await multipv(engine, item.fen, totalLegales, PROFUNDIDAD);
  if (lineas.length === 0) return null;
  const mejor = Math.max(...lineas.map((l) => l.score));

  let peor = null;
  for (const candidata of candidatas) {
    const linea = lineas.find((l) => l.move === candidata.uci);
    if (!linea) continue;
    const costo = mejor - linea.score;
    if (!peor || costo > peor.costoCp) peor = { ...candidata, costoCp: costo, pv: linea.pv };
  }
  if (!peor) return null;

  // Tras la carnada, la refutación es la respuesta del rival: la PV de la
  // candidata arranca con la carnada misma, así que se saltea.
  const chessTrasCarnada = new Chess(item.fen);
  const jugada = chessTrasCarnada
    .moves({ verbose: true })
    .find((m) => `${m.from}${m.to}${m.promotion ?? ''}` === peor.uci || `${m.from}${m.to}` === peor.uci);
  if (!jugada) return null;
  chessTrasCarnada.move(jugada);
  const refutacionSan = sanVerificado(chessTrasCarnada.fen(), peor.pv.slice(1), PLIES_REFUTACION);

  return {
    san: peor.san,
    ganaPeones: peor.neto,
    refutacionSan,
    // Cuando la mejor jugada da mate, la resta contra un score normal da
    // ~100000: guardarlo como "centipeones" sería mentir sobre la unidad. Se
    // colapsa al mismo centinela de mate que usa core/engineLevels.ts.
    costoCp: peor.costoCp >= CP_MATE / 2 ? CP_MATE : Math.round(peor.costoCp),
    profundidad: PROFUNDIDAD,
  };
}

const engine = new StockfishEngine();
try {
  await engine.init();
  const items = loadItems();
  const envenenadas = items.filter((item) => item.tipo === 'envenenada');
  console.error(`Marcando la carnada de ${envenenadas.length} posiciones envenenadas (profundidad ${PROFUNDIDAD}).\n`);

  let marcadas = 0;
  for (const item of items) {
    if (item.tipo !== 'envenenada') continue;
    const carnada = await carnadaDe(engine, item);
    if (!carnada) {
      // No se inventa: sin carnada identificable el feedback cae a la frase
      // genérica del tipo, que es lo que había antes.
      delete item.carnada;
      console.error(`  ${item.id}: sin carnada identificable — queda con el texto genérico.`);
      continue;
    }
    item.carnada = carnada;
    marcadas++;
    console.error(
      `  ${item.id}: ${carnada.san} (+${carnada.ganaPeones}, cuesta ${carnada.costoCp} cp) → ` +
        `${carnada.refutacionSan.join(' ') || '(sin refutación legible)'}`,
    );
  }

  const check = validateRadarDataset(items);
  if (!check.ok) throw new Error(`Lote inválido:\n- ${check.errors.join('\n- ')}`);
  const version = datasetVersion(items);
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`\n${marcadas}/${envenenadas.length} con carnada marcada. Lote ${version} → ${SEED_PATH}.`);
} finally {
  engine.quit();
}
