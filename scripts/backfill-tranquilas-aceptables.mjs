// Corrección de auditoría (2026-07): re-deriva `jugadasAceptables` para las
// posiciones tranquilas ya embebidas en seedData.ts, usando el mismo motor y
// profundidad que el pipeline (MultiPV a profundidad 14). No trae datos
// nuevos de Lichess (bloqueado por red) — solo enriquece las tranquilas
// existentes con las jugadas equivalentes que faltaban, ancladas en la jugada
// canónica ya validada (`solucion[0]`), sin cambiarla.
//
// Uso: node scripts/backfill-tranquilas-aceptables.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';
import { DEFAULT_QUIET_CONFIG } from './lib/quietPositions.mjs';
import { MIN_POR_TIPO, datasetVersion, renderSeedDataModule, validateRadarDataset } from './lib/radarDataset.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');
const { verificationDepth, maxAcceptableGapCp } = DEFAULT_QUIET_CONFIG;

function loadItems() {
  const text = readFileSync(SEED_PATH, 'utf8');
  const marker = 'seedRadarItems: RadarItem[] = [';
  const start = text.indexOf(marker) + marker.length - 1;
  const end = text.lastIndexOf(']');
  return JSON.parse(text.slice(start, end + 1));
}

async function main() {
  const items = loadItems();
  const tranquilas = items.filter((it) => it.tipo === 'tranquila');
  console.error(`Re-derivando jugadas aceptables para ${tranquilas.length} posiciones tranquilas (profundidad ${verificationDepth}, tolerancia ${maxAcceptableGapCp}cp)…`);

  const engine = new StockfishEngine();
  await engine.init();

  let conAlternativas = 0;
  try {
    for (const item of tranquilas) {
      const chess = new Chess(item.fen);
      const legales = chess.moves({ verbose: true }).length;
      const ranked = await engine.analyseMultiPv(item.fen, legales, verificationDepth);
      const canonica = ranked.find((m) => m.move === item.solucion[0]);
      if (!canonica) {
        // La jugada guardada ya no aparece entre las variantes del motor a esta
        // profundidad: no toco el item (no puedo re-anclar con confianza).
        console.error(`  ! ${item.id}: solucion[0]=${item.solucion[0]} no está en MultiPV; se deja sin alternativas.`);
        delete item.jugadasAceptables;
        continue;
      }
      const aceptables = ranked
        .filter((m) => m.move !== item.solucion[0] && canonica.score - m.score <= maxAcceptableGapCp)
        .map((m) => m.move);
      if (aceptables.length > 0) {
        item.jugadasAceptables = aceptables;
        conAlternativas++;
        console.error(`  ✓ ${item.id}: +${aceptables.length} aceptables (${aceptables.join(', ')})`);
      } else {
        delete item.jugadasAceptables;
        console.error(`  · ${item.id}: sin equivalentes dentro de ${maxAcceptableGapCp}cp`);
      }
    }
  } finally {
    engine.quit();
  }

  const check = validateRadarDataset(items, MIN_POR_TIPO);
  if (!check.ok) throw new Error(`Lote inválido tras el backfill:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`Listo: ${conAlternativas}/${tranquilas.length} tranquilas ganaron alternativas. Nueva versión: ${version}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
