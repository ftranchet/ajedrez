// Agrega al catálogo embebido del Radar las posiciones de doble solución
// (RF-5.7) encontradas por scripts/mine-doble-solucion.mjs. Estas 7 son el
// resultado, revisado a mano, de dos búsquedas de autojuego del motor local
// (sin acceso a partidas reales en este entorno — ver docs/roadmap.md):
// cada una fue criba a profundidad 14 y reconfirmada a profundidad 17 antes
// de aceptarla (el cribado a 14 solo, mismo estándar que el pipeline de
// posiciones tranquilas, resultó insuficiente para esta afirmación más fina
// — "esta jugada específica es la segunda mejor" — y descartó 3 de las 10
// candidatas iniciales por no sostenerse a mayor profundidad). Verificación
// final de legalidad con chess.js, nunca de memoria.
//
// Uso: node scripts/finalize-doble-solucion.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import { datasetVersion, renderSeedDataModule, validateRadarDataset } from './lib/radarDataset.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');

const CANDIDATOS = [
  { fen: 'r3k2r/ppp2ppp/2b5/3QP3/4n2q/B1P3P1/P1P2P1P/R3KB1R w KQkq - 1 12', superior: 'd5c6', familiar: 'f1b5' },
  { fen: 'r2q1rk1/2p2pbp/b2p1np1/1B2n1B1/p3P3/P1N2PN1/1PPQ2PP/2KR3R w - - 1 14', superior: 'f3f4', familiar: 'b5a6' },
  { fen: 'r1b2k2/pp6/4p2p/2bn1B2/8/2P2Q2/Pq3PPP/R4RK1 w - - 0 19', superior: 'f5e6', familiar: 'f5e4' },
  { fen: 'r1b1k2r/pp1Nqppp/3b4/2pP4/2P2Pn1/8/PP2B1PP/RNBQK2R w KQkq - 1 12', superior: 'd7e5', familiar: 'e1g1' },
  { fen: 'r1b1Qb1r/pppn2pp/8/3k4/3PpB2/5qP1/PPP2P1P/2KR3R w - - 0 18', superior: 'e8f7', familiar: 'h1e1' },
  { fen: 'r1b2b1r/pppn1Qpp/2k5/8/3PpB2/5qP1/PPP2P1P/2KR3R w - - 2 19', superior: 'f7c4', familiar: 'h1e1' },
  { fen: 'r1b4r/ppp3pp/2k5/2b5/2Q1pB2/5qP1/PPP2P1P/2KR3R w - - 0 21', superior: 'c4d5', familiar: 'a2a4' },
];

// Sin fuente de dificultad calibrada para posiciones de autojuego (a
// diferencia de los puzzles de Lichess, con rating de la comunidad): se usa
// un valor fijo medio, documentado como simplificación v1 — igual que la
// banda categórica del Panel de verdad (RF-12.1) en vez de un rating numérico.
const RATING_FIJO = 1500;

function loadItems() {
  const text = readFileSync(SEED_PATH, 'utf8');
  const marker = 'seedRadarItems: RadarItem[] = [';
  const start = text.indexOf(marker) + marker.length - 1;
  const end = text.lastIndexOf(']');
  return JSON.parse(text.slice(start, end + 1));
}

function main() {
  for (const c of CANDIDATOS) {
    const chess = new Chess(c.fen);
    const legales = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    if (!legales.includes(c.superior)) throw new Error(`Jugada superior ilegal en ${c.fen}: ${c.superior}`);
    if (!legales.includes(c.familiar)) throw new Error(`Jugada familiar ilegal en ${c.fen}: ${c.familiar}`);
    if (c.superior === c.familiar) throw new Error(`Superior y familiar coinciden en ${c.fen}`);
  }

  const items = loadItems();
  const existentes = new Set(items.map((i) => i.fen));
  let agregadas = 0;
  for (const [index, c] of CANDIDATOS.entries()) {
    if (existentes.has(c.fen)) continue; // ya está: el script es reejecutable sin duplicar
    items.push({
      id: `dobsol-${String(index + 1).padStart(2, '0')}`,
      fen: c.fen,
      tipo: 'ofensiva',
      temas: ['doble-solucion', 'autojuego-verificado'],
      rating: RATING_FIJO,
      solucion: [c.superior],
      fuente: 'pipeline-doble-solucion',
      dobleSolucion: { familiar: c.familiar },
    });
    agregadas++;
  }

  const check = validateRadarDataset(items, 20);
  if (!check.ok) throw new Error(`Lote inválido tras el agregado:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`Listo: ${agregadas} posiciones de doble solución agregadas (${items.length} en total). Nueva versión: ${version}.`);
}

main();
