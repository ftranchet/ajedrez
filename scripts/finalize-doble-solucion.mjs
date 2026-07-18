// Agrega al catálogo embebido del Radar las posiciones de doble solución
// (RF-5.7) encontradas por scripts/mine-doble-solucion.mjs. Reemplaza el
// lote anterior de 7 (auditoría 2026-07-18: 3 de esas 7 venían de la misma
// partida de autojuego — el motivo cambia poco de un ply al siguiente,
// así que salían casi idénticas entre sí, mismo problema que ya se había
// corregido para Stoyko semanal). Esta corrida agrega un tope de 1 candidata
// aceptada por partida de autojuego (mismo criterio que
// scripts/mine-stoyko.mjs) y automatiza la reconfirmación a profundidad 17
// dentro del propio script de minado (antes era un paso manual fuera de él).
// Las 8 posiciones de este lote vienen de 8 partidas de autojuego distintas,
// cada una criba a profundidad 14 y reconfirmada a 17 antes de aceptarla.
// Verificación final de legalidad con chess.js, nunca de memoria.
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
  { fen: '2r1k2r/1q2bp1p/2p2np1/p1Pp1N2/8/4BQ2/PPP2PPP/R3K2R w KQk - 0 16', superior: 'f5d6', familiar: 'f5e7' },
  { fen: 'rn1q1rk1/1bp1bppp/8/pB1pB3/1P1P4/P1N1Q1n1/2P2PPP/R4RK1 w - - 0 18', superior: 'e3g3', familiar: 'e5g3' },
  { fen: 'rn1qr1k1/p4p1p/2p2p2/1p2N3/3Pp3/2P5/P1P2PPP/R2QR1K1 w - - 0 15', superior: 'e5g4', familiar: 'd1g4' },
  { fen: 'rnb1r3/4kpp1/p1pb3p/1p1Bp3/4P3/4BN2/PPP2PPP/2KR3R w - - 0 15', superior: 'd5f7', familiar: 'd5b3' },
  { fen: 'rnbr2k1/pp2qppp/2p5/8/2B1N3/8/PPP2PPP/R2QR1K1 w - - 5 15', superior: 'd1h5', familiar: 'c4f7' },
  { fen: 'r1b1k2r/pp2q1pp/2pp1p2/4b3/8/P4Q2/BB1N2PP/R3R1K1 w kq - 0 17', superior: 'd2c4', familiar: 'b2e5' },
  { fen: 'r3kb1r/ppp1nppp/2n5/4Pb2/2B1pB2/2N5/PPP2PPP/2KR2NR w - - 8 9', superior: 'c3b5', familiar: 'g1e2' },
  { fen: 'N5kr/pp3pp1/2n5/2q4p/2Pp1nbP/P2B1P2/2PQ1KP1/R6R w - - 0 19', superior: 'd2f4', familiar: 'f3g4' },
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

  const previos = loadItems();
  // Reemplaza el lote de doble solución entero en vez de agregarlo: la
  // corrida anterior tenía 3 posiciones de una misma partida de autojuego
  // (ver comentario de arriba), así que no alcanza con sumar candidatas
  // nuevas a las viejas — hay que sacar las viejas primero.
  const removidas = previos.filter((i) => i.fuente === 'pipeline-doble-solucion').length;
  const items = previos.filter((i) => i.fuente !== 'pipeline-doble-solucion');

  let agregadas = 0;
  for (const [index, c] of CANDIDATOS.entries()) {
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
  if (!check.ok) throw new Error(`Lote inválido tras el reemplazo:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`Listo: ${removidas} posiciones de doble solución viejas reemplazadas por ${agregadas} nuevas (${items.length} ítems en total). Nueva versión: ${version}.`);
}

main();
