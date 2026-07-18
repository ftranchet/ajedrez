// Corrección de auditoría (2026-07): re-deriva el TIPO de las posiciones del
// Radar provenientes de puzzles de Lichess con el motor, en vez de mapearlo
// por etiqueta de tema. El mapeo viejo `sacrifice/trappedPiece → envenenada`
// era inválido: el tema `sacrifice` describe un sacrificio *correcto del
// solucionador* (la jugada a jugar), no una carnada a rechazar, así que la
// mitad de las "envenenada" tenían una captura correcta como solución y el
// feedback quedaba invertido ("detectaste la trampa" cuando en realidad
// capturaste).
//
// Reglas nuevas (solo sobre items `lichess-cc0`; tranquilas y doble solución
// no se tocan), en orden de prioridad:
//   1. tema `defensiveMove` → `defensa` (etiqueta explícita y fiable de Lichess).
//   2. envenenada REAL: existe una captura "tentadora" (de material ≥1) que el
//      motor evalúa como una trampa (pierde ≥TRAP_MARGIN cp respecto a la mejor)
//      y la solución NO es esa captura (el solver la rechaza).
//   3. genuina: la solución captura una pieza (valor ≥3) que queda de arriba
//      sin recaptura adecuada — material libre real.
//   4. ofensiva: cualquier otra táctica (combinación, sacrificio, golpe).
//
// Uso: node scripts/reclassify-radar-tipos.mjs [--apply]
//   sin --apply: dry-run, imprime la distribución propuesta sin escribir.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';
import { MIN_POR_TIPO, datasetVersion, renderSeedDataModule, validateRadarDataset } from './lib/radarDataset.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');

const DEPTH = 14;
const TRAP_MARGIN = 200; // cp: cuánto peor que la mejor debe ser la captura-carnada para contar como trampa
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function loadItems() {
  const text = readFileSync(SEED_PATH, 'utf8');
  const marker = 'seedRadarItems: RadarItem[] = [';
  const start = text.indexOf(marker) + marker.length - 1;
  const end = text.lastIndexOf(']');
  return JSON.parse(text.slice(start, end + 1));
}

/** Material neto (perspectiva del que mueve) de capturar en `to` con recaptura a 1 ply. */
function netoCaptura(fen, uci) {
  const chess = new Chess(fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const mv = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
  if (!mv || !mv.captured) return null;
  chess.move({ from, to, promotion: uci[4] || undefined });
  const recaptura = chess.moves({ verbose: true }).some((m) => m.to === to && m.captured);
  return { capturado: VAL[mv.captured], neto: VAL[mv.captured] - (recaptura ? VAL[mv.piece] : 0) };
}

async function clasificar(engine, item) {
  if (item.temas.includes('defensiveMove')) return 'defensa';

  const chess = new Chess(item.fen);
  const legales = chess.moves({ verbose: true });
  const ranked = await engine.analyseMultiPv(item.fen, legales.length, DEPTH);
  if (ranked.length === 0) return 'ofensiva';
  const bestScore = ranked[0].score;
  const scorePorJugada = new Map(ranked.map((m) => [m.move, m.score]));
  const sol = item.solucion[0];
  const solMv = legales.find((m) => `${m.from}${m.to}${m.promotion ?? ''}` === sol);
  const solEsCaptura = !!solMv?.captured;

  // 2. Envenenada real: hay una captura que PARECE ganar material (neto ≥1 a 1
  //    ply, la trampa de "material gratis") pero que el motor condena como
  //    mucho peor que la mejor jugada, Y la solución DECLINA material (no es
  //    una captura). El "no es captura" es esencial: el feedback de envenenada
  //    dice "evitaste la captura envenenada", así que la jugada correcta tiene
  //    que ser precisamente no capturar. El filtro "parece ganar material"
  //    evita etiquetar como envenenada cualquier posición táctica (casi todas
  //    tienen alguna captura mala).
  if (!solEsCaptura) {
    const hayCarnada = legales.some((m) => {
      if (!m.captured) return false;
      const uci = `${m.from}${m.to}${m.promotion ?? ''}`;
      const neto = netoCaptura(item.fen, uci);
      if (!neto || neto.neto < 1) return false; // debe parecer que gana material a simple vista
      const score = scorePorJugada.get(uci);
      return score !== undefined && bestScore - score >= TRAP_MARGIN;
    });
    if (hayCarnada) return 'envenenada';
  }

  // 3. Genuina: la solución captura material que queda de arriba sin recaptura
  //    adecuada (material realmente ofrecido, "pieza colgada").
  if (solEsCaptura) {
    const neto = netoCaptura(item.fen, sol);
    if (neto && neto.neto >= 2) return 'genuina';
  }

  // 4. Resto: ofensiva (combinación, sacrificio, golpe forzado).
  return 'ofensiva';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const items = loadItems();
  const puzzles = items.filter((it) => it.fuente === 'lichess-cc0');
  console.error(`Reclasificando ${puzzles.length} posiciones de puzzles (profundidad ${DEPTH})… ${apply ? '[APLICAR]' : '[dry-run]'}`);

  const engine = new StockfishEngine();
  await engine.init();

  const antes = {};
  const despues = {};
  const cambios = [];
  try {
    for (const item of puzzles) {
      antes[item.tipo] = (antes[item.tipo] ?? 0) + 1;
      const nuevo = await clasificar(engine, item);
      despues[nuevo] = (despues[nuevo] ?? 0) + 1;
      if (nuevo !== item.tipo) cambios.push(`${item.id}: ${item.tipo} → ${nuevo} (sol ${item.solucion[0]})`);
      item.tipo = nuevo;
      if (!item.temas.includes('reclasificado-motor')) item.temas = [...item.temas, 'reclasificado-motor'];
    }
  } finally {
    engine.quit();
  }

  console.error('\nAntes:', JSON.stringify(antes));
  console.error('Después:', JSON.stringify(despues));
  console.error(`\n${cambios.length} cambios:`);
  for (const c of cambios) console.error('  ' + c);

  if (!apply) {
    console.error('\n(dry-run: no se escribió nada. Volvé a correr con --apply para aplicar.)');
    return;
  }

  // Piso de envenenada en 0 acá a propósito: los puzzles tácticos casi no
  // aportan envenenada real (la solución declina material), así que ese tipo
  // lo completa después el pipeline propio scripts/mine-envenenada.mjs +
  // finalize-envenenada.mjs (igual que las tranquilas se generan aparte). Se
  // mantienen los chequeos estructurales (duplicados, solución, tipo válido) y
  // las cuotas de los demás tipos.
  const check = validateRadarDataset(items, { ...MIN_POR_TIPO, envenenada: 0 });
  if (!check.ok) throw new Error(`Lote inválido tras la reclasificación:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`\nAplicado. Nueva versión: ${version}. Distribución: ${JSON.stringify(check.counts)}. (envenenada la completa mine-envenenada.mjs)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
