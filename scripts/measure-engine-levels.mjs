// Medición reproducible de los niveles del oponente local (RF-1.3).
//
// Los niveles se implementaban con `Skill Level` de Stockfish y nadie había
// comprobado nunca que el nivel 1 fuera más fácil que el 5. No lo era: Skill
// Level juega casi a fuerza plena con errores aleatorios (piso ~1350 Elo), y
// con presupuestos de 250–1000 ms la diferencia entre extremos quedaba dentro
// del ruido — el nivel 1 se sentía como el 5 y a veces peor.
//
// Este script juega los niveles entre sí y reporta el resultado. La afirmación
// "los niveles altos le ganan a los bajos" pasa a ser algo medido y repetible
// en vez de una promesa del archivo de configuración.
//
//   node scripts/measure-engine-levels.mjs [--games 4] [--pairs 1-5,1-3,3-5]
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const config = JSON.parse(await readFile(new URL('../src/config/engine-levels.json', import.meta.url), 'utf8'));
const LEVELS = new Map(config.levels.map((level) => [level.id, level]));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const GAMES_PER_PAIR = Number(arg('games', '4'));
// Cortar temprano infla las tablas: a 30 jugadas muchas partidas siguen
// equilibradas y la adjudicación no distingue niveles cercanos. Para pares
// contiguos conviene subirlo, aun a costa de tiempo.
const MAX_PLIES = Number(arg('plies', '160'));
const PAIRS = arg('pairs', '1-5,1-3,3-5')
  .split(',')
  .map((pair) => pair.split('-').map((n) => `nivel-${n.trim()}`));

const UCI_ELO_MIN = 1320;
const UCI_ELO_MAX = 3190;
const clampElo = (elo) => Math.min(UCI_ELO_MAX, Math.max(UCI_ELO_MIN, Math.round(elo)));

/** Misma regla que core/engineLevels.ts: a veces se juega una alternativa. */
function elegirConImprecision(moves, imprecision) {
  const alternativas = moves.slice(1);
  if (!imprecision || alternativas.length === 0) return moves[0];
  if (Math.random() >= Math.min(1, imprecision)) return moves[0];
  return alternativas[Math.min(alternativas.length - 1, Math.floor(Math.random() * alternativas.length))];
}

async function jugadaDelNivel(engine, fen, level) {
  const multiPv = level.imprecision > 0 ? 4 : 1;
  engine.multipv.clear();
  engine.send('setoption name Skill Level value 20');
  engine.send('setoption name UCI_LimitStrength value true');
  engine.send(`setoption name UCI_Elo value ${clampElo(level.uciElo)}`);
  engine.send(`setoption name MultiPV value ${multiPv}`);
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send(`go movetime ${level.movetimeMs}`);
  const line = await engine.waitFor(/^bestmove\s+/);
  const bestmove = /^bestmove\s+(\S+)/.exec(line)?.[1];
  const ordenadas = [...engine.multipv.entries()].sort(([a], [b]) => a - b).map(([, l]) => l.move);
  const candidatas = ordenadas.length > 0 ? ordenadas : [bestmove];
  return elegirConImprecision(candidatas, level.imprecision) ?? bestmove;
}

/** Ventaja mínima (cp) para adjudicar una partida cortada por límite de jugadas. */
const CP_ADJUDICACION = 250;

/**
 * Evalúa a fuerza plena la posición final, en perspectiva blancas. Cortar por
 * límite de jugadas y llamar "tablas" a todo diluía la señal: dos niveles
 * distintos empataban en la planilla aunque uno estuviera con torre de más.
 */
async function adjudicar(engine, fen) {
  engine.multipv.clear();
  engine.send('setoption name UCI_LimitStrength value false');
  engine.send('setoption name MultiPV value 1');
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send('go depth 12');
  await engine.waitFor(/^bestmove\s+/);
  const linea = engine.multipv.get(1);
  if (!linea) return 0.5;
  const desdeBlancas = fen.split(' ')[1] === 'w' ? linea.score : -linea.score;
  if (desdeBlancas >= CP_ADJUDICACION) return 1;
  if (desdeBlancas <= -CP_ADJUDICACION) return 0;
  return 0.5;
}

/** Una partida entre dos niveles. Devuelve 1, 0.5 o 0 desde `blancas`. */
async function jugarPartida(engine, blancas, negras) {
  const chess = new Chess();
  while (!chess.isGameOver() && chess.history().length < MAX_PLIES) {
    const level = chess.turn() === 'w' ? blancas : negras;
    const uci = await jugadaDelNivel(engine, chess.fen(), level);
    if (!uci || uci === '(none)') break;
    const move = chess.moves({ verbose: true }).find(
      (m) => m.from + m.to + (m.promotion ?? '') === uci || m.from + m.to === uci,
    );
    if (!move) break;
    chess.move(move);
  }
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 0 : 1;
  if (chess.isGameOver()) return 0.5; // tablas reales por regla
  return adjudicar(engine, chess.fen()); // corte: se adjudica por evaluación
}

const engine = new StockfishEngine();
try {
  await engine.init();
  console.log(`Niveles (${config.version}):`);
  for (const level of config.levels) {
    console.log(`  ${level.id}: UCI_Elo ${level.uciElo}, ${level.movetimeMs} ms, imprecisión ${level.imprecision ?? 0}`);
  }
  console.log(`\n${GAMES_PER_PAIR} partidas por par, colores alternados, corte a ${MAX_PLIES} plies.\n`);

  let monotono = true;
  for (const [bajoId, altoId] of PAIRS) {
    const bajo = LEVELS.get(bajoId);
    const alto = LEVELS.get(altoId);
    if (!bajo || !alto) throw new Error(`Par inválido: ${bajoId} vs ${altoId}`);

    let puntosAlto = 0;
    for (let i = 0; i < GAMES_PER_PAIR; i++) {
      const altoConBlancas = i % 2 === 0;
      const resultadoBlancas = altoConBlancas
        ? await jugarPartida(engine, alto, bajo)
        : await jugarPartida(engine, bajo, alto);
      puntosAlto += altoConBlancas ? resultadoBlancas : 1 - resultadoBlancas;
    }
    const porcentaje = (puntosAlto / GAMES_PER_PAIR) * 100;
    const ok = puntosAlto > GAMES_PER_PAIR / 2;
    if (!ok) monotono = false;
    console.log(
      `${ok ? 'OK  ' : 'MAL '}${altoId} vs ${bajoId}: ${puntosAlto}/${GAMES_PER_PAIR} para el nivel alto (${porcentaje.toFixed(0)}%)`,
    );
  }

  console.log(
    monotono
      ? '\nLos niveles altos superan a los bajos en todos los pares medidos.'
      : '\nATENCIÓN: algún nivel alto NO superó al bajo. Revisar engine-levels.json antes de publicar.',
  );
  if (!monotono) process.exitCode = 1;
} finally {
  engine.quit();
}
