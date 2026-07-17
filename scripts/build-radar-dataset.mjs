// Construye el lote offline del Radar a partir de los exports oficiales de
// Lichess. Requiere los archivos CSV/PGN (planos o .zst) ya descargados;
// nunca accede a red en runtime. Ver docs/radar-dataset.md.
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import {
  PUZZLE_DATASET_TYPES,
  datasetVersion,
  interleaveByType,
  parseCsvLine,
  puzzleRowToRadarItem,
  renderSeedDataModule,
  validateRadarDataset,
} from './lib/radarDataset.mjs';
import { DEFAULT_QUIET_CONFIG, quietCandidatesFromPgn, verifyQuietCandidate } from './lib/quietPositions.mjs';
import { StockfishEngine } from './lib/stockfish.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      options[rawKey] = true;
      continue;
    }
    options[rawKey] = next;
    index++;
  }
  return options;
}

function required(options, name) {
  if (!options[name]) throw new Error(`Falta --${name}. Ver: node scripts/build-radar-dataset.mjs --help`);
  return options[name];
}

function numberOption(options, name, fallback) {
  const value = options[name] === undefined ? fallback : Number(options[name]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} debe ser un entero positivo.`);
  return value;
}

function openTextStream(file) {
  if (!file.endsWith('.zst')) return { stream: createReadStream(file), stop() {} };
  const decoder = spawn('zstd', ['-dc', '--', file]);
  decoder.stderr.pipe(process.stderr);
  return {
    stream: decoder.stdout,
    stop() {
      decoder.kill();
    },
  };
}

async function collectPuzzles(file, perType) {
  const input = openTextStream(file);
  const reader = createInterface({ input: input.stream, crlfDelay: Infinity });
  const buckets = new Map(PUZZLE_DATASET_TYPES.map((type) => [type, []]));
  let firstLine = true;
  let rows = 0;

  try {
    for await (const line of reader) {
      if (firstLine) {
        firstLine = false;
        continue;
      }
      rows++;
      let item = null;
      try {
        item = puzzleRowToRadarItem(parseCsvLine(line));
      } catch {
        continue;
      }
      if (!item) continue;
      const bucket = buckets.get(item.tipo);
      if (!bucket || bucket.length >= perType) continue;
      bucket.push(item);
      if (PUZZLE_DATASET_TYPES.every((type) => buckets.get(type).length >= perType)) break;
    }
  } finally {
    reader.close();
    input.stop();
  }
  console.error(`Puzzles leídos: ${rows}. ${[...buckets].map(([type, items]) => `${type}: ${items.length}`).join(', ')}.`);
  return buckets;
}

async function* pgnGames(stream) {
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  let lines = [];
  for await (const line of reader) {
    if (line.startsWith('[Event ') && lines.length > 0) {
      const game = lines.join('\n').trim();
      if (game) yield game;
      lines = [];
    }
    lines.push(line);
  }
  const game = lines.join('\n').trim();
  if (game) yield game;
}

async function collectQuietPositions(file, perType, existingFens, maxGames, maxCandidates, quietConfig) {
  const input = openTextStream(file);
  const items = [];
  const seenFens = new Set(existingFens);
  const engine = new StockfishEngine();
  let games = 0;
  let candidates = 0;

  try {
    await engine.init();
    for await (const pgn of pgnGames(input.stream)) {
      games++;
      for (const candidate of quietCandidatesFromPgn(pgn, quietConfig)) {
        if (seenFens.has(candidate.fen)) continue;
        candidates++;
        const verified = await verifyQuietCandidate(candidate, engine, quietConfig);
        if (verified.accepted) {
          items.push(verified.item);
          seenFens.add(verified.item.fen);
          console.error(`Tranquila ${items.length}/${perType}: ${verified.item.id} (${verified.item.rating}).`);
          if (items.length >= perType) return items;
        }
        if (candidates >= maxCandidates) return items;
      }
      if (games >= maxGames) return items;
    }
  } finally {
    input.stop();
    engine.quit();
    console.error(`Partidas exploradas: ${games}. Candidatas verificadas: ${candidates}. Tranquilas: ${items.length}.`);
  }
  return items;
}

function usage() {
  return `Uso:
  node scripts/build-radar-dataset.mjs \\
    --puzzles ruta/lichess_db_puzzle.csv.zst \\
    --games ruta/lichess_db_standard_rated_2013-01.pgn.zst \\
    [--output src/services/puzzles/seedData.ts] [--per-type 40] \\
    [--max-games 2000] [--max-candidates 500] [--depth 14]
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const puzzles = required(options, 'puzzles');
  const games = required(options, 'games');
  const output = resolve(options.output ?? 'src/services/puzzles/seedData.ts');
  const perType = numberOption(options, 'per-type', 40);
  const maxGames = numberOption(options, 'max-games', 2000);
  const maxCandidates = numberOption(options, 'max-candidates', 500);
  const quietConfig = {
    ...DEFAULT_QUIET_CONFIG,
    verificationDepth: numberOption(options, 'depth', DEFAULT_QUIET_CONFIG.verificationDepth),
  };

  const puzzleBuckets = await collectPuzzles(puzzles, perType);
  const puzzleItems = PUZZLE_DATASET_TYPES.flatMap((type) => puzzleBuckets.get(type));
  const quietItems = await collectQuietPositions(games, perType, puzzleItems.map((item) => item.fen), maxGames, maxCandidates, quietConfig);
  const items = interleaveByType([...puzzleItems, ...quietItems]);
  const check = validateRadarDataset(items, perType);
  if (!check.ok) throw new Error(`Lote incompleto:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  writeFileSync(output, renderSeedDataModule(items, { version }));
  console.error(`Lote ${version} generado: ${items.length} posiciones → ${output}.`);
  console.error(`Fuentes: ${basename(puzzles)} + ${basename(games)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
