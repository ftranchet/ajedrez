// Verificación reproducible del catálogo de finales (RF-6.2). Confirma con
// chess.js que cada FEN es legal y con Stockfish 18 a profundidad 22 que el
// resultado declarado pertenece al bando del usuario. No usa red ni confía
// en posiciones recordadas de memoria.
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const items = JSON.parse(await readFile(new URL('../src/config/finales-catalogo.json', import.meta.url), 'utf8'));
const engine = new StockfishEngine();

function assert(condition, message) {
  if (!condition) throw new Error(`FALLÓ: ${message}`);
}

try {
  await engine.init();
  for (const item of items) {
    const chess = new Chess(item.fen);
    const pieces = chess.board().flat().filter(Boolean).length;
    assert(!chess.isGameOver(), `${item.nombre}: la posición ya terminó`);
    assert(pieces <= 7, `${item.nombre}: excede siete piezas y deja de ser un final elemental acotado`);
    assert(item.ladoUsuario === 'w' || item.ladoUsuario === 'b', `${item.nombre}: falta ladoUsuario`);

    // El objetivo declarado es lo que la app exige para dar la técnica por
    // demostrada (core/finales.ts): 'coronar' solo tiene sentido con peón
    // propio, y 'mate' solo si no lo hay — si no, el final se cerraría con un
    // criterio que la posición no puede cumplir.
    const tienePeonPropio = chess
      .board()
      .flat()
      .some((sq) => sq && sq.type === 'p' && sq.color === item.ladoUsuario);
    if (item.resultadoEsperado === 'gana') {
      assert(item.objetivo === 'mate' || item.objetivo === 'coronar', `${item.nombre}: falta objetivo ('mate' o 'coronar')`);
      assert(
        item.objetivo === 'coronar' ? tienePeonPropio : !tienePeonPropio,
        `${item.nombre}: objetivo '${item.objetivo}' incompatible con la posición`,
      );
    } else {
      assert(item.objetivo === undefined, `${item.nombre}: un final de tablas no declara objetivo`);
    }

    // Una sola línea (ver `analyseBest`): acá alcanza con la mejor jugada del
    // bando que mueve, y pedir dos en posiciones de tres piezas hace que la
    // búsqueda a profundidad 22 se vuelva impracticable.
    const best = await engine.analyseBest(item.fen, 22, 120_000);
    assert(best, `${item.nombre}: Stockfish no devolvió evaluación`);
    const sideToMove = item.fen.split(' ')[1];
    const userScore = sideToMove === item.ladoUsuario ? best.score : -best.score;
    if (item.resultadoEsperado === 'gana') {
      assert(userScore >= 400, `${item.nombre}: no sostiene ventaja ganadora (${userScore} cp)`);
    } else {
      assert(Math.abs(userScore) <= 50, `${item.nombre}: no sostiene tablas (${userScore} cp)`);
    }
    console.log(`OK  ${item.nombre}: ${item.resultadoEsperado}${item.objetivo ? ` (${item.objetivo})` : ''}, ${userScore} cp, ${best.move}`);
  }
  console.log(`\n${items.length} finales verificados con Stockfish 18.`);
} finally {
  engine.quit();
}
