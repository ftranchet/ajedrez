// Utilidades puras y reproducibles para el lote del Radar (RF-5.6,
// ADR-0005). Se mantienen fuera de la app para que el catálogo se genere
// offline y la PWA siga funcionando sin red.
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';

export const RADAR_DATASET_TYPES = ['ofensiva', 'defensa', 'tranquila', 'genuina', 'envenenada'];
export const PUZZLE_DATASET_TYPES = ['ofensiva', 'defensa', 'genuina', 'envenenada'];

export const DEFAULT_PUZZLE_FILTERS = {
  ratingMin: 800,
  ratingMax: 2000,
  popularityMin: 50,
};

/** Parseador CSV pequeño que sí soporta campos con comillas y comillas escapadas. */
export function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV inválido: comillas sin cerrar.');
  fields.push(field);
  return fields;
}

// Clasificación GRUESA por etiqueta de tema, solo como arranque de la
// generación. NO es la clasificación autoritativa: la auditoría 2026-07
// mostró que `sacrifice`/`trappedPiece` describen un sacrificio *correcto del
// solucionador*, no una carnada a rechazar, así que este mapeo producía
// "envenenada" con feedback invertido. La clasificación real del lote
// publicado la re-deriva el motor en `scripts/reclassify-radar-tipos.mjs`
// (genuina = material libre verificado; envenenada = una captura que parece
// ganar material pero el motor condena; el resto, ofensiva). Una regeneración
// completa del pipeline debería correr esa reclasificación como paso final.
export function classifyPuzzleThemes(themes) {
  const tags = new Set(themes);
  if (tags.has('defensiveMove')) return 'defensa';
  if (tags.has('hangingPiece')) return 'genuina';
  if (tags.has('sacrifice') || tags.has('trappedPiece')) return 'envenenada';
  return 'ofensiva';
}

function applyUciMove(chess, uci) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4, 5) || undefined,
    });
  } catch {
    return null;
  }
}

/** Convierte una fila oficial del CSV de Lichess en un item del Radar. */
export function puzzleRowToRadarItem(columns, filters = DEFAULT_PUZZLE_FILTERS) {
  const [puzzleId, fen, movesRaw, ratingRaw, , popularityRaw, , themesRaw] = columns;
  const rating = Number(ratingRaw);
  const popularity = Number(popularityRaw);
  if (!puzzleId || !fen || !movesRaw) return null;
  if (!Number.isFinite(rating) || rating < filters.ratingMin || rating > filters.ratingMax) return null;
  if (!Number.isFinite(popularity) || popularity < filters.popularityMin) return null;

  const moves = movesRaw.trim().split(/\s+/).filter(Boolean);
  if (moves.length < 2) return null;

  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  if (!applyUciMove(chess, moves[0])) return null;

  const temas = (themesRaw ?? '').split(/\s+/).filter(Boolean);
  return {
    id: `lichess-${puzzleId}`,
    fen: chess.fen(),
    tipo: classifyPuzzleThemes(temas),
    temas,
    rating,
    solucion: moves.slice(1),
    fuente: 'lichess-cc0',
  };
}

const VALOR_PIEZA = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Material neto de una captura contando una sola recaptura, o null si no captura. */
export function netoDeCaptura(fen, uci) {
  const chess = new Chess(fen);
  const jugada = chess
    .moves({ verbose: true })
    .find((m) => `${m.from}${m.to}${m.promotion ?? ''}` === uci || `${m.from}${m.to}` === uci);
  if (!jugada || !jugada.captured) return null;
  chess.move(jugada);
  const recaptura = chess.moves({ verbose: true }).some((m) => m.to === jugada.to && m.captured);
  return VALOR_PIEZA[jugada.captured] - (recaptura ? VALOR_PIEZA[jugada.piece] : 0);
}

/**
 * Clasifica un puzzle **hasta donde alcanza el tablero**, y dice cuándo hace
 * falta el motor.
 *
 * Las cuatro reglas de la reclasificación (auditoría 2026-07) no cuestan lo
 * mismo. `defensa` sale de una etiqueta de Lichess, `genuina` es aritmética de
 * material y `ofensiva` es el resto: nada de eso necesita buscar. Solo
 * `envenenada` exige una opinión del motor —"esta captura que parece ganar
 * material en realidad la condena"— y **solo puede aplicar** si la solución no
 * es una captura y además existe alguna captura que aparente ganar material.
 *
 * Medido sobre los 80 puzzles del lote publicado: **1 solo** cumple esas dos
 * condiciones. El reclasificador corría un MultiPV a profundidad 14 sobre las
 * ~23 jugadas legales de los 80, o sea 79 búsquedas cuyo resultado el tablero
 * ya determinaba. Ese era el costo que volvía impracticable ingerir el export
 * completo de Lichess.
 *
 * Devuelve `{ tipo }` cuando el tablero decide, o `{ tipo: null, carnadas }`
 * con las capturas que el motor tiene que juzgar.
 */
export function clasificarPorTablero(item) {
  if (item.temas.includes('defensiveMove')) return { tipo: 'defensa', carnadas: [] };

  let chess;
  try {
    chess = new Chess(item.fen);
  } catch {
    return { tipo: 'ofensiva', carnadas: [] };
  }
  const legales = chess.moves({ verbose: true });
  const solucion = item.solucion[0];
  const jugadaSolucion = legales.find(
    (m) => `${m.from}${m.to}${m.promotion ?? ''}` === solucion || `${m.from}${m.to}` === solucion,
  );

  // La solución captura: no puede ser una envenenada (que se define por
  // declinar), así que se decide entre genuina y ofensiva sin buscar.
  if (jugadaSolucion?.captured) {
    const neto = netoDeCaptura(item.fen, solucion);
    return { tipo: neto !== null && neto >= 2 ? 'genuina' : 'ofensiva', carnadas: [] };
  }

  // La solución declina material: solo acá puede haber una envenenada, y solo
  // si existe una captura que a simple vista gane material.
  const carnadas = legales
    .filter((m) => m.captured)
    .map((m) => ({ uci: `${m.from}${m.to}${m.promotion ?? ''}`, neto: netoDeCaptura(item.fen, `${m.from}${m.to}${m.promotion ?? ''}`) }))
    .filter(({ neto }) => neto !== null && neto >= 1);

  if (carnadas.length === 0) return { tipo: 'ofensiva', carnadas: [] };
  return { tipo: null, carnadas };
}

/** Los primeros plies de una línea UCI en SAN, verificados legales acá. */
export function sanVerificado(fen, uciMoves, maxPlies) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const san = [];
  for (const uci of uciMoves.slice(0, maxPlies)) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promocion = uci.slice(4, 5) || undefined;
    const candidatas = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
    const jugada = promocion ? candidatas.find((m) => m.promotion === promocion) : candidatas[0];
    if (!jugada) break;
    san.push(chess.move(jugada).san);
  }
  return san;
}

/** Mismo centinela que core/engineLevels.ts: un mate no se mide en centipeones. */
export const CP_MATE = 100_000;

/**
 * La carnada de una posición envenenada: cuál de las capturas aparentemente
 * ganadoras es la trampa, y qué la refuta (RF-5.3c).
 *
 * Toma las líneas que el motor ya calculó, así que no cuesta una búsqueda
 * extra. Se elige la captura que el motor **más castiga**, que es la definición
 * operativa de "carnada": la que más promete y menos da. La refutación son los
 * primeros plies de su variante principal, re-verificados legales con chess.js
 * — nunca se confía en la notación del motor sin comprobarla.
 */
export function carnadaDesdeLineas(fen, carnadas, lineas, profundidad, pliesRefutacion = 4) {
  if (carnadas.length === 0 || lineas.length === 0) return null;
  const mejor = Math.max(...lineas.map((l) => l.score));
  const porJugada = new Map(lineas.map((l) => [l.move, l]));

  let peor = null;
  for (const { uci, neto } of carnadas) {
    const linea = porJugada.get(uci);
    if (!linea) continue;
    const costo = mejor - linea.score;
    if (!peor || costo > peor.costoCp) peor = { uci, neto, costoCp: costo, pv: linea.pv ?? [] };
  }
  if (!peor) return null;

  const san = sanVerificado(fen, [peor.uci], 1)[0];
  if (!san) return null;

  // La refutación es lo que sigue DESPUÉS de la carnada, así que se parte de la
  // posición resultante y se saltea la carnada misma dentro de la variante.
  const chess = new Chess(fen);
  const candidatas = chess.moves({ verbose: true }).filter((m) => m.from === peor.uci.slice(0, 2) && m.to === peor.uci.slice(2, 4));
  const promo = peor.uci.slice(4, 5) || undefined;
  const jugada = promo ? candidatas.find((m) => m.promotion === promo) : candidatas[0];
  if (!jugada) return null;
  chess.move(jugada);

  return {
    san,
    ganaPeones: peor.neto,
    refutacionSan: sanVerificado(chess.fen(), peor.pv.slice(1), pliesRefutacion),
    costoCp: peor.costoCp >= CP_MATE / 2 ? CP_MATE : Math.round(peor.costoCp),
    profundidad,
  };
}

/** Conserva hasta `perType` items de cada tipo, por orden de aparición. */
export function takeBalancedPuzzleItems(items, perType) {
  const buckets = new Map(PUZZLE_DATASET_TYPES.map((type) => [type, []]));
  for (const item of items) {
    const bucket = buckets.get(item.tipo);
    if (!bucket || bucket.length >= perType) continue;
    bucket.push(item);
  }
  return buckets;
}

/** Intercala los tipos para que el archivo tampoco introduzca bloques visuales. */
export function interleaveByType(items) {
  const buckets = new Map(RADAR_DATASET_TYPES.map((type) => [type, items.filter((item) => item.tipo === type)]));
  const result = [];
  let index = 0;
  let added = true;
  while (added) {
    added = false;
    for (const type of RADAR_DATASET_TYPES) {
      const item = buckets.get(type)[index];
      if (item) {
        result.push(item);
        added = true;
      }
    }
    index++;
  }
  return result;
}

// Cuota mínima por tipo del lote publicado. `ofensiva`/`defensa`/`tranquila`
// mantienen 20; `genuina` y `envenenada` bajan a 10 porque, tras la
// reclasificación con motor (auditoría 2026-07, scripts/reclassify-radar-tipos.mjs),
// no se pueden forzar a 20 desde los puzzles de Lichess sin volver a inventar
// etiquetas —el punto que rompía la validez de contenido—. Ver
// docs/radar-dataset.md §Reclasificación con motor.
export const MIN_POR_TIPO = { ofensiva: 20, defensa: 20, tranquila: 20, genuina: 10, envenenada: 8 };

/** `minPerType` puede ser un número (mismo mínimo para todos los tipos, como
 * en la generación balanceada) o un objeto por-tipo (como el lote publicado
 * tras la reclasificación). */
export function validateRadarDataset(items, minPerType = MIN_POR_TIPO) {
  const errors = [];
  const counts = Object.fromEntries(RADAR_DATASET_TYPES.map((type) => [type, 0]));
  const ids = new Set();
  const fens = new Set();
  const minDe = (type) => (typeof minPerType === 'number' ? minPerType : (minPerType[type] ?? 0));

  for (const item of items) {
    if (!RADAR_DATASET_TYPES.includes(item.tipo)) errors.push(`Tipo de Radar inválido: ${item.tipo}.`);
    else counts[item.tipo]++;
    if (ids.has(item.id)) errors.push(`Id duplicado: ${item.id}.`);
    ids.add(item.id);
    if (fens.has(item.fen)) errors.push(`FEN duplicado: ${item.fen}.`);
    fens.add(item.fen);
    if (!Array.isArray(item.solucion) || item.solucion.length === 0) errors.push(`Item sin solución: ${item.id}.`);
  }
  for (const type of RADAR_DATASET_TYPES) {
    if (counts[type] < minDe(type)) errors.push(`Faltan posiciones ${type}: ${counts[type]}/${minDe(type)}.`);
  }
  return { ok: errors.length === 0, errors, counts };
}

/** La versión depende del contenido: mismo input y configuración, mismo lote. */
export function datasetVersion(items) {
  return `radar-${createHash('sha256').update(JSON.stringify(items)).digest('hex').slice(0, 12)}`;
}

/** Renderiza el módulo que la PWA importa como catálogo local. */
export function renderSeedDataModule(items, metadata) {
  const version = metadata.version ?? datasetVersion(items);
  return `// GENERADO por scripts/build-radar-dataset.mjs — no editar a mano.
// Lote ${version}: puzzles de Lichess (CC0) y posiciones tranquilas de
// partidas reales verificadas por Stockfish. Ver docs/radar-dataset.md,
// ADR-0005 y RF-5.6 para reproducirlo.
import type { RadarItem } from '../../core/types';

export const RADAR_DATASET_VERSION = ${JSON.stringify(version)};

export const seedRadarItems: RadarItem[] = ${JSON.stringify(items, null, 2)};
`;
}
