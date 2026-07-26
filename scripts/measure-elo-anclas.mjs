// Elo de cada nivel, derivado de resultados contra un rival de fuerza
// conocida (RF-1.3c).
//
// **Por qué así y no de otra forma.** Los niveles estaban rotulados en
// centipeones perdidos por jugada: una unidad honesta y medida, pero que casi
// ningún jugador usa para saber contra qué está jugando. Un Elo sí lo dice.
// El problema es que la versión vieja de la app mostraba un Elo salido de una
// fórmula inventada, y eso es justo lo que este proyecto dice no hacer.
//
// El primer intento fue traducir cp/jugada a Elo comparando contra el ACPL de
// Stockfish limitado a distintos `UCI_Elo`. **No funciona, y está medido:** la
// curva salió no monótona (1700 → 18 cp, 1900 → 21 cp) porque en 24 jugadas
// desde la apertura todos los motores fuertes juegan igual de bien, y además
// Stockfish en su piso (`UCI_Elo` 1320) ya pierde solo ~40 cp/jugada — o sea
// que la mitad de la escalera de la app queda por debajo del piso de la
// referencia y no habría número que asignarle.
//
// Este script usa la definición de Elo: **la diferencia sale del resultado
// esperado**. Cada nivel juega N partidas contra Stockfish puro limitado a
// `UCI_Elo` 1320 —el único rival con una fuerza declarada y calibrada que hay
// a mano— y su Elo es `1320 + 400·log10(S/(1−S))` sobre el puntaje obtenido.
// Eso vale también por debajo de 1320, que es donde viven los niveles fáciles.
//
// **Lo que esto NO es.** No es Elo FIDE ni de Lichess: es la escala de
// Stockfish. Y con pocas partidas el error es grande, así que el número se
// redondea a 25 y se muestra con "≈". El script imprime el intervalo.
//
//   node scripts/measure-elo-anclas.mjs [--partidas 6] [--plies 100] [--escribir]
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { Chess } from 'chess.js';
import { StockfishEngine } from './lib/stockfish.mjs';

const CONFIG_URL = new URL('../src/config/engine-levels.json', import.meta.url);
const config = JSON.parse(await readFile(CONFIG_URL, 'utf8'));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}
const PARTIDAS = Number(arg('partidas', '6'));
const MAX_PLIES = Number(arg('plies', '100'));
const ESCRIBIR = process.argv.includes('--escribir');
/** Nivel que se mide directamente contra la referencia; el resto se encadena. */
const ANCLA_NIVEL = arg('ancla', 'nivel-6');

/** El rival de referencia: Stockfish con su fuerza declarada más baja. */
const ANCLA_ELO = 1320;
const ANCLA_MOVETIME = 200;
const CP_MATE = 100_000;
const CP_ADJUDICACION = 250;

function puntaje(linea) {
  if (linea.score >= CP_MATE / 2) return CP_MATE;
  if (linea.score <= -CP_MATE / 2) return -CP_MATE;
  return linea.score;
}

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

async function jugadaDelNivel(engine, fen, level) {
  engine.multipv.clear();
  engine.send('setoption name Skill Level value 20');
  engine.send('setoption name UCI_LimitStrength value true');
  engine.send(`setoption name UCI_Elo value ${level.uciElo}`);
  engine.send(`setoption name MultiPV value ${Math.max(1, level.candidatas ?? 1)}`);
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send(`go movetime ${level.movetimeMs}`);
  const linea = await engine.waitFor(/^bestmove\s+/);
  const bestmove = /^bestmove\s+(\S+)/.exec(linea)?.[1];
  const ordenadas = [...engine.multipv.entries()].sort(([a], [b]) => a - b).map(([, l]) => l);
  return elegirPorTemperatura(ordenadas.length > 0 ? ordenadas : [{ move: bestmove, score: 0 }], level.temperaturaCp ?? 0);
}

async function jugadaDelAncla(engine, fen) {
  engine.multipv.clear();
  engine.send('setoption name Skill Level value 20');
  engine.send('setoption name UCI_LimitStrength value true');
  engine.send(`setoption name UCI_Elo value ${ANCLA_ELO}`);
  engine.send('setoption name MultiPV value 1');
  engine.send('isready');
  await engine.waitFor(/^readyok$/);
  engine.send(`position fen ${fen}`);
  engine.send(`go movetime ${ANCLA_MOVETIME}`);
  return /^bestmove\s+(\S+)/.exec(await engine.waitFor(/^bestmove\s+/))?.[1];
}

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
  const desdeQuienMueve = linea ? puntaje(linea) : 0;
  const desdeBlancas = fen.split(' ')[1] === 'w' ? desdeQuienMueve : -desdeQuienMueve;
  if (desdeBlancas >= CP_ADJUDICACION) return 1;
  if (desdeBlancas <= -CP_ADJUDICACION) return 0;
  return 0.5;
}

function aplicar(chess, uci) {
  const jugada = chess
    .moves({ verbose: true })
    .find((m) => m.from + m.to + (m.promotion ?? '') === uci || m.from + m.to === uci);
  if (!jugada) return false;
  chess.move(jugada);
  return true;
}

/** Puntaje del NIVEL en una partida contra el ancla. */
async function jugarContraElAncla(engine, level, nivelConBlancas) {
  const chess = new Chess();
  while (!chess.isGameOver() && chess.history().length < MAX_PLIES) {
    const leTocaAlNivel = (chess.turn() === 'w') === nivelConBlancas;
    const uci = leTocaAlNivel ? await jugadaDelNivel(engine, chess.fen(), level) : await jugadaDelAncla(engine, chess.fen());
    if (!uci || !aplicar(chess, uci)) break;
  }
  if (chess.isCheckmate()) {
    const ganaronBlancas = chess.turn() === 'b';
    return ganaronBlancas === nivelConBlancas ? 1 : 0;
  }
  if (chess.isGameOver()) return 0.5;
  const desdeBlancas = await adjudicar(engine, chess.fen());
  return nivelConBlancas ? desdeBlancas : 1 - desdeBlancas;
}

/** Puntaje del nivel A en una partida contra el nivel B. */
async function jugarEntreNiveles(engine, a, b, aConBlancas) {
  const chess = new Chess();
  while (!chess.isGameOver() && chess.history().length < MAX_PLIES) {
    const leTocaA = (chess.turn() === 'w') === aConBlancas;
    const uci = await jugadaDelNivel(engine, chess.fen(), leTocaA ? a : b);
    if (!uci || !aplicar(chess, uci)) break;
  }
  if (chess.isCheckmate()) return (chess.turn() === 'b') === aConBlancas ? 1 : 0;
  if (chess.isGameOver()) return 0.5;
  const desdeBlancas = await adjudicar(engine, chess.fen());
  return aConBlancas ? desdeBlancas : 1 - desdeBlancas;
}

/** Diferencia de Elo que implica un puntaje. Es la definición, no un ajuste. */
function deltaElo(puntos, partidas) {
  const s = puntos / partidas;
  const acotado = Math.min(1 - 0.5 / partidas, Math.max(0.5 / partidas, s));
  return 400 * Math.log10(acotado / (1 - acotado));
}

const engine = new StockfishEngine();
try {
  await engine.init();

  // --- Fase 1: anclar UN nivel a la referencia ---
  //
  // Medido antes de escribir esto: contra Stockfish limitado a 1320, los
  // niveles 1 a 5 pierden 6-0. El piso de Stockfish es demasiado fuerte para
  // medir la parte baja de la escalera, así que anclar cada nivel por separado
  // devolvería la misma cota para casi todos. Se ancla uno solo —el que juega
  // parejo contra la referencia— y el resto se encadena.
  const indiceAncla = config.levels.findIndex((l) => l.id === ANCLA_NIVEL);
  if (indiceAncla < 0) throw new Error(`No existe el nivel de anclaje ${ANCLA_NIVEL}.`);
  const nivelAncla = config.levels[indiceAncla];

  console.log(`Fase 1 — anclaje: ${nivelAncla.id} contra Stockfish UCI_Elo ${ANCLA_ELO}, ${PARTIDAS} partidas.`);
  let puntosAncla = 0;
  for (let i = 0; i < PARTIDAS; i++) puntosAncla += await jugarContraElAncla(engine, nivelAncla, i % 2 === 0);
  const eloAncla = ANCLA_ELO + deltaElo(puntosAncla, PARTIDAS);
  console.log(`  ${puntosAncla}/${PARTIDAS} → ${nivelAncla.id} ≈ ${Math.round(eloAncla)}\n`);

  // --- Fase 2: encadenar por pares contiguos ---
  //
  // Elo es, por definición, una escala de DIFERENCIAS derivadas del resultado
  // esperado. Con un punto anclado, cada partido entre vecinos fija el
  // siguiente escalón, y así la escalera entera queda en la escala de la
  // referencia sin pedirle a Stockfish que juegue por debajo de su piso.
  console.log(`Fase 2 — pares contiguos, ${PARTIDAS} partidas cada uno:\n`);
  const deltas = new Array(config.levels.length - 1).fill(null);
  for (let i = 0; i < config.levels.length - 1; i++) {
    const bajo = config.levels[i];
    const alto = config.levels[i + 1];
    let puntosAlto = 0;
    for (let j = 0; j < PARTIDAS; j++) puntosAlto += await jugarEntreNiveles(engine, alto, bajo, j % 2 === 0);
    deltas[i] = deltaElo(puntosAlto, PARTIDAS);
    console.log(`  ${alto.id} vs ${bajo.id}: ${puntosAlto}/${PARTIDAS} → +${Math.round(deltas[i])}`);
  }

  // --- Fase 3: propagar desde el ancla ---
  const elos = new Array(config.levels.length).fill(0);
  elos[indiceAncla] = eloAncla;
  for (let i = indiceAncla; i < elos.length - 1; i++) elos[i + 1] = elos[i] + deltas[i];
  for (let i = indiceAncla; i > 0; i--) elos[i - 1] = elos[i] - deltas[i - 1];

  console.log('\nEscalera resultante:\n');
  let ok = true;
  const actualizados = config.levels.map((level, i) => {
    const elo = Math.round(elos[i] / 25) * 25;
    if (i > 0 && elo <= Math.round(elos[i - 1] / 25) * 25) {
      console.log(`  MAL: ${level.id} no supera al anterior.`);
      ok = false;
    }
    console.log(`  ${level.id.padEnd(8)} ≈${elo}${i === indiceAncla ? '   (ancla)' : ''}`);
    return { ...level, eloAproximado: elo };
  });

  console.log(ok ? '\nLa escalera de Elo está ordenada.' : '\nATENCIÓN: revisar engine-levels.json antes de publicar.');
  if (!ok) process.exitCode = 1;

  if (!ESCRIBIR) {
    console.log('(sin --escribir no se toca la configuración)');
  } else {
    await writeFile(
      CONFIG_URL,
      `${JSON.stringify(
        {
          ...config,
          medicion: `Elo por resultado: ${ANCLA_NIVEL} anclado contra Stockfish UCI_Elo ${ANCLA_ELO} y el resto encadenado por pares contiguos, ${PARTIDAS} partidas cada uno (scripts/measure-elo-anclas.mjs)`,
          anclaElo: {
            rival: `Stockfish UCI_Elo ${ANCLA_ELO}`,
            nivelAnclado: ANCLA_NIVEL,
            partidas: PARTIDAS,
            medidoEn: new Date().toISOString().slice(0, 10),
          },
          levels: actualizados,
        },
        null,
        2,
      )}\n`,
    );
    console.log('Configuración actualizada con eloAproximado.');
  }
} finally {
  engine.quit();
}
