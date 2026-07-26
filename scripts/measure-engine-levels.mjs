// Medición reproducible de los niveles del oponente local (RF-1.3b).
//
// Mide dos cosas distintas y complementarias:
//
//   1. **Centipeones perdidos por jugada (ACPL)** contra la mejor jugada a
//      fuerza plena. Es una medida *absoluta* de cuánto se equivoca cada nivel,
//      en la misma unidad que usa el análisis de la app para clasificar errores
//      (100 cp = error, 200 = error grave). Responde "¿el nivel 1 juega como un
//      principiante?", que es lo que un usuario percibe.
//   2. **Partidas entre niveles**, que responde "¿la escalera está ordenada?".
//
// Hicieron falta las dos. La primera versión de este script solo hacía (2), y
// una escalera puede estar perfectamente ordenada y ser toda demasiado fuerte
// —que es exactamente lo que pasaba: los niveles se distinguían entre sí pero
// el más bajo seguía jugando como un club fuerte—.
//
//   node scripts/measure-engine-levels.mjs                  ambas mediciones
//   node scripts/measure-engine-levels.mjs --solo acpl      solo la absoluta
//   node scripts/measure-engine-levels.mjs --solo partidas  solo la ordinal
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

const SOLO = arg('solo', 'todo');
const JUGADAS_ACPL = Number(arg('jugadas', '24'));
const GAMES_PER_PAIR = Number(arg('games', '4'));
// Cortar temprano infla las tablas: a 30 jugadas muchas partidas siguen
// equilibradas y la adjudicación no distingue niveles cercanos.
const MAX_PLIES = Number(arg('plies', '130'));
const PAIRS = arg('pairs', '1-3,3-5')
  .split(',')
  .map((pair) => pair.split('-').map((n) => `nivel-${n.trim()}`));

const UCI_ELO_MIN = 1320;
const UCI_ELO_MAX = 3190;
const CP_MATE = 100_000;
const clampElo = (elo) => Math.min(UCI_ELO_MAX, Math.max(UCI_ELO_MIN, Math.round(elo)));

/** Misma escala que core/engineLevels.ts. */
function puntaje(linea) {
  if (linea.score >= CP_MATE / 2) return CP_MATE;
  if (linea.score <= -CP_MATE / 2) return -CP_MATE;
  return linea.score;
}

/** Mismo muestreo que core/engineLevels.ts#elegirJugadaPorTemperatura. */
function elegirPorTemperatura(lineas, temperaturaCp) {
  if (lineas.length === 0) return null;
  if (!temperaturaCp || lineas.length === 1) return lineas[0].move;
  const mejor = Math.max(...lineas.map(puntaje));
  const pesos = lineas.map((l) => Math.exp(-(mejor - puntaje(l)) / temperaturaCp));
  const total = pesos.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(total) || total <= 0) return lineas[0].move;
  let dardo = Math.random() * total;
  for (let i = 0; i < lineas.length; i++) {
    dardo -= pesos[i];
    if (dardo <= 0) return lineas[i].move;
  }
  return lineas.at(-1).move;
}

async function lineasDelNivel(engine, fen, level) {
  engine.multipv.clear();
  engine.send('setoption name Skill Level value 20');
  engine.send('setoption name UCI_LimitStrength value true');
  engine.send(`setoption name UCI_Elo value ${clampElo(level.uciElo)}`);
  engine.send(`setoption name MultiPV value ${Math.max(1, level.candidatas ?? 1)}`);
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send(`go movetime ${level.movetimeMs}`);
  const line = await engine.waitFor(/^bestmove\s+/);
  const bestmove = /^bestmove\s+(\S+)/.exec(line)?.[1];
  const ordenadas = [...engine.multipv.entries()].sort(([a], [b]) => a - b).map(([, l]) => l);
  return ordenadas.length > 0 ? ordenadas : [{ move: bestmove, score: 0 }];
}

async function jugadaDelNivel(engine, fen, level) {
  const lineas = await lineasDelNivel(engine, fen, level);
  return elegirPorTemperatura(lineas, level.temperaturaCp ?? 0);
}

/** Evaluación a fuerza plena de una posición, en perspectiva de quien mueve. */
async function evaluarFuerzaPlena(engine, fen, depth = 12) {
  engine.multipv.clear();
  engine.send('setoption name UCI_LimitStrength value false');
  engine.send('setoption name MultiPV value 1');
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send(`go depth ${depth}`);
  await engine.waitFor(/^bestmove\s+/);
  const linea = engine.multipv.get(1);
  return linea ? puntaje(linea) : 0;
}

/**
 * Centipeones que pierde un nivel por jugada. Para cada posición: se evalúa a
 * fuerza plena antes, el nivel juega, y se vuelve a evaluar desde la
 * perspectiva del mismo bando. La caída es lo que costó su jugada.
 */
async function medirAcpl(engine, level, jugadas) {
  const chess = new Chess();
  const perdidas = [];
  while (perdidas.length < jugadas && !chess.isGameOver()) {
    const antes = await evaluarFuerzaPlena(engine, chess.fen());
    const uci = await jugadaDelNivel(engine, chess.fen(), level);
    const move = chess.moves({ verbose: true }).find(
      (m) => m.from + m.to + (m.promotion ?? '') === uci || m.from + m.to === uci,
    );
    if (!move) break;
    chess.move(move);
    if (chess.isGameOver()) break;
    // Tras mover, evalúa el rival: se invierte para volver a la perspectiva
    // del que acaba de jugar.
    const despues = -(await evaluarFuerzaPlena(engine, chess.fen()));
    perdidas.push(Math.max(0, Math.min(1000, antes - despues)));
  }
  const total = perdidas.reduce((a, b) => a + b, 0);
  return { acpl: perdidas.length > 0 ? total / perdidas.length : 0, jugadas: perdidas.length };
}

/** Referencias humanas aproximadas, para poder leer el ACPL medido. */
function bandaHumana(acpl) {
  if (acpl >= 110) return 'principiante (~800–1000)';
  if (acpl >= 80) return 'club bajo (~1000–1300)';
  if (acpl >= 55) return 'club medio (~1300–1600)';
  if (acpl >= 40) return 'club fuerte (~1600–1900)';
  return 'muy fuerte (1900+)';
}

const CP_ADJUDICACION = 250;

async function adjudicar(engine, fen) {
  const desdeQuienMueve = await evaluarFuerzaPlena(engine, fen);
  const desdeBlancas = fen.split(' ')[1] === 'w' ? desdeQuienMueve : -desdeQuienMueve;
  if (desdeBlancas >= CP_ADJUDICACION) return 1;
  if (desdeBlancas <= -CP_ADJUDICACION) return 0;
  return 0.5;
}

async function jugarPartida(engine, blancas, negras) {
  const chess = new Chess();
  while (!chess.isGameOver() && chess.history().length < MAX_PLIES) {
    const level = chess.turn() === 'w' ? blancas : negras;
    const uci = await jugadaDelNivel(engine, chess.fen(), level);
    const move = chess.moves({ verbose: true }).find(
      (m) => m.from + m.to + (m.promotion ?? '') === uci || m.from + m.to === uci,
    );
    if (!move) break;
    chess.move(move);
  }
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 0 : 1;
  if (chess.isGameOver()) return 0.5;
  return adjudicar(engine, chess.fen());
}

let ok = true;
const engine = new StockfishEngine();
try {
  await engine.init();
  console.log(`Niveles (${config.version}):`);
  for (const level of config.levels) {
    console.log(
      `  ${level.id}: UCI_Elo ${level.uciElo}, ${level.movetimeMs} ms, ` +
        `${level.candidatas ?? 1} candidatas, temperatura ${level.temperaturaCp ?? 0} cp`,
    );
  }

  if (SOLO !== 'partidas') {
    console.log(`\n— Centipeones perdidos por jugada (${JUGADAS_ACPL} jugadas por nivel) —\n`);
    const acpls = [];
    for (const level of config.levels) {
      const { acpl, jugadas } = await medirAcpl(engine, level, JUGADAS_ACPL);
      acpls.push(acpl);
      const declarado = level.acplMedido;
      // El número que la app le muestra al usuario tiene que seguir siendo
      // cierto: si el motor cambia de versión o alguien toca la temperatura,
      // esto lo delata en vez de dejar una etiqueta vieja en pantalla.
      const desvio = declarado ? Math.abs(acpl - declarado) / declarado : 0;
      const nota = declarado
        ? desvio > 0.35
          ? `  DESVÍO: la config declara ${declarado}`
          : ''
        : '  (sin valor declarado en la config)';
      if (desvio > 0.35) ok = false;
      console.log(`  ${level.id}: ${acpl.toFixed(0)} cp/jugada sobre ${jugadas} — ${bandaHumana(acpl)}${nota}`);
    }
    for (let i = 1; i < acpls.length; i++) {
      if (acpls[i] > acpls[i - 1] + 5) {
        console.log(`  MAL: ${config.levels[i].id} pierde más centipeones que ${config.levels[i - 1].id}`);
        ok = false;
      }
    }
  }

  if (SOLO !== 'acpl') {
    console.log(`\n— Partidas entre niveles (${GAMES_PER_PAIR} por par, corte a ${MAX_PLIES} plies) —\n`);
    for (const [bajoId, altoId] of PAIRS) {
      const bajo = LEVELS.get(bajoId);
      const alto = LEVELS.get(altoId);
      if (!bajo || !alto) throw new Error(`Par inválido: ${bajoId} vs ${altoId}`);
      let puntosAlto = 0;
      for (let i = 0; i < GAMES_PER_PAIR; i++) {
        const altoConBlancas = i % 2 === 0;
        const resultado = altoConBlancas
          ? await jugarPartida(engine, alto, bajo)
          : await jugarPartida(engine, bajo, alto);
        puntosAlto += altoConBlancas ? resultado : 1 - resultado;
      }
      const gana = puntosAlto > GAMES_PER_PAIR / 2;
      if (!gana) ok = false;
      console.log(
        `  ${gana ? 'OK ' : 'MAL'} ${altoId} vs ${bajoId}: ${puntosAlto}/${GAMES_PER_PAIR} para el nivel alto`,
      );
    }
  }

  console.log(ok ? '\nLa escalera está ordenada y el extremo débil es débil.' : '\nATENCIÓN: revisar engine-levels.json antes de publicar.');
  if (!ok) process.exitCode = 1;
} finally {
  engine.quit();
}
