// Agrega al catálogo del Radar las posiciones "envenenada" reales generadas
// por scripts/mine-envenenada.mjs (auditoría 2026-07). Reemplaza cualquier
// envenenada de pipeline previa. Cada posición: una captura que parece ganar
// material pero es trampa, y la solución la DECLINA — el tipo no se puede
// sacar de puzzles tácticos, se genera aparte como las tranquilas.
//
// Uso: node scripts/finalize-envenenada.mjs --checkpoint /ruta/checkpoint.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import { MIN_POR_TIPO, datasetVersion, renderSeedDataModule, validateRadarDataset } from './lib/radarDataset.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');

// Sin fuente de dificultad calibrada para autojuego (igual que doble solución
// y Stoyko): valor fijo medio, documentado como simplificación v1.
const RATING_FIJO = 1500;

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

function loadItems() {
  const text = readFileSync(SEED_PATH, 'utf8');
  const marker = 'seedRadarItems: RadarItem[] = [';
  const start = text.indexOf(marker) + marker.length - 1;
  const end = text.lastIndexOf(']');
  return JSON.parse(text.slice(start, end + 1));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const checkpointPath = options.checkpoint;
  if (!checkpointPath || !existsSync(checkpointPath)) throw new Error('Falta --checkpoint con las candidatas de mine-envenenada.mjs');
  const { found } = JSON.parse(readFileSync(checkpointPath, 'utf8'));
  if (!Array.isArray(found) || found.length === 0) throw new Error('El checkpoint no tiene candidatas.');

  // Verificación de legalidad de cada solución, nunca de memoria.
  for (const c of found) {
    const chess = new Chess(c.fen);
    const legal = chess.moves({ verbose: true }).some((m) => `${m.from}${m.to}${m.promotion ?? ''}` === c.solucion);
    if (!legal) throw new Error(`Solución ilegal en ${c.fen}: ${c.solucion}`);
    // La solución no debe ser una captura (una envenenada declina material).
    const mv = chess.moves({ verbose: true }).find((m) => `${m.from}${m.to}${m.promotion ?? ''}` === c.solucion);
    if (mv.captured) throw new Error(`La solución de ${c.fen} es una captura: no es una envenenada válida.`);
  }

  const previos = loadItems();
  const removidas = previos.filter((i) => i.fuente === 'pipeline-envenenada').length;
  const items = previos.filter((i) => i.fuente !== 'pipeline-envenenada');

  found.forEach((c, index) => {
    items.push({
      id: `enven-${String(index + 1).padStart(2, '0')}`,
      fen: c.fen,
      tipo: 'envenenada',
      temas: ['envenenada', 'autojuego-verificado'],
      rating: RATING_FIJO,
      solucion: [c.solucion],
      fuente: 'pipeline-envenenada',
    });
  });

  const check = validateRadarDataset(items, MIN_POR_TIPO);
  if (!check.ok) throw new Error(`Lote inválido tras el agregado:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`Listo: ${removidas} envenenada viejas reemplazadas por ${found.length} nuevas. Distribución: ${JSON.stringify(check.counts)}. Nueva versión: ${version}.`);
}

main();
