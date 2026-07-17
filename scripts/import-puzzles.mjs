// Pipeline real de importación del dataset de puzzles de Lichess (ADR-0005,
// RF-5.6). Procesa el CSV oficial (licencia CC0) en un lote de RadarItem[]
// listo para sembrar `radarItems`.
//
// Este script NO corrió nunca contra el dataset real: el entorno de
// desarrollo donde se escribió no tiene acceso de red a
// database.lichess.org (solo un allowlist de dominios de paquetería). Por
// eso el Radar arranca con un dataset semilla hecho a mano y verificado con
// el motor (ver scripts/build-seed-puzzles.mjs y su nota de honestidad en
// src/services/puzzles/seedData.ts). Para producción, correr este script en
// un entorno con acceso a internet:
//
//   1. Descargar y descomprimir:
//      https://database.lichess.org/lichess_db_puzzle.csv.zst
//   2. node scripts/import-puzzles.mjs ruta/al/lichess_db_puzzle.csv > src/services/puzzles/seedData.ts
//
// Formato de cada fila del CSV oficial (con cabecera):
//   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
// - FEN: posición ANTES de la primera jugada de la solución (la jugada que
//   arma la táctica, hecha por el bando que "provoca" el puzzle). El
//   RadarItem debe usar la posición DESPUÉS de esa primera jugada (donde el
//   usuario resuelve) — Moves[0] se aplica y se descarta; Moves[1..] queda
//   como `solucion`.
// - Themes: lista separada por espacios (p. ej. "mate mateIn2 middlegame").
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';

const RATING_MIN = 800;
const RATING_MAX = 2000; // banda del usuario objetivo, PRD §4
const POPULARITY_MIN = 50; // filtra puzzles mal etiquetados o de mala calidad
const MAX_ITEMS = 2000; // tope razonable para un primer lote

// Temas de Lichess → tipo del Radar (RF-5.1). Heurística simple: se puede
// refinar con más datos; lo importante es no dejar todo en "ofensiva".
const TEMA_A_TIPO = {
  defensiveMove: 'defensa',
  defense: 'defensa',
  quietMove: 'tranquila',
  equality: 'tranquila',
  advantage: 'tranquila',
};

function inferirTipo(temas) {
  for (const t of temas) if (TEMA_A_TIPO[t]) return TEMA_A_TIPO[t];
  return 'ofensiva'; // default: la mayoría de los puzzles de Lichess son tácticos
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Uso: node scripts/import-puzzles.mjs <ruta al CSV de Lichess>');
    process.exit(1);
  }

  const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
  const items = [];
  let header = null;
  let vistos = 0;

  for await (const line of rl) {
    if (!header) {
      header = line.split(',');
      continue;
    }
    if (items.length >= MAX_ITEMS) break;
    vistos++;

    const cols = line.split(',');
    const [id, fen, moves, rating, , popularity, , themes] = cols;
    const ratingNum = Number(rating);
    const popNum = Number(popularity);
    if (!Number.isFinite(ratingNum) || ratingNum < RATING_MIN || ratingNum > RATING_MAX) continue;
    if (!Number.isFinite(popNum) || popNum < POPULARITY_MIN) continue;

    const moveList = moves.split(' ');
    if (moveList.length < 2) continue; // necesita al menos la jugada que arma + la solución

    // Aplicar la primera jugada (la posición del CSV es previa a ella) para
    // llegar a la posición donde el usuario realmente resuelve.
    const chess = new Chess(fen);
    const setup = moveList[0];
    const move = chess.move({ from: setup.slice(0, 2), to: setup.slice(2, 4), promotion: setup.slice(4, 5) || undefined });
    if (!move) continue; // fila corrupta: se descarta, no se aborta el lote

    const temas = themes ? themes.split(' ').filter(Boolean) : [];
    items.push({
      id: `lichess-${id}`,
      fen: chess.fen(),
      tipo: inferirTipo(temas),
      temas,
      rating: ratingNum,
      solucion: moveList.slice(1),
      fuente: 'lichess-cc0',
    });
  }

  console.error(`Filas leídas: ${vistos}. Items generados: ${items.length}.`);
  if (items.length === 0) {
    console.error('Ningún puzzle pasó los filtros — revisar RATING_MIN/MAX y POPULARITY_MIN.');
    process.exit(1);
  }

  const out = `// GENERADO por scripts/import-puzzles.mjs a partir del dataset oficial de
// Lichess (CC0). Ver ADR-0005 y RF-5.6 para la licencia y el criterio de
// filtrado. No editar a mano — volver a correr el script para regenerar.
import type { RadarItem } from '../../core/types';

export const seedRadarItems: RadarItem[] = ${JSON.stringify(items, null, 2)};
`;
  process.stdout.write(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
