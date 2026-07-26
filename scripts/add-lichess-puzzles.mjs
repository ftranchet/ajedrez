// Suma posiciones del export CC0 de puzzles de Lichess al catálogo del Radar.
//
// **Por qué existe, además de `build-radar-dataset.mjs`.** Ese script genera el
// lote entero desde cero y necesita dos descargas: el CSV de puzzles y un PGN
// de partidas para extraer posiciones tranquilas, más horas de Stockfish para
// verificarlas. Volver a correrlo para agrandar el catálogo tiraría además las
// 48 posiciones de autojuego (envenenadas, doble solución, tranquilas) que
// costaron horas de minado. Este script hace lo único que hace falta para
// destrabar el problema real —el catálogo se repite a los 2–4 días— con una
// sola descarga: **suma** puzzles al lote que ya está, sin tocar nada más.
//
// **Por qué ahora es rápido.** La clasificación autoritativa del tipo (la de la
// auditoría 2026-07) parecía exigir el motor en cada posición. Medido: de 80
// puzzles, **1** lo necesita — las otras tres reglas las decide el tablero.
// `clasificarPorTablero` aplica ese prefiltro, así que ingerir cientos de
// puzzles cuesta segundos y no horas.
//
// **Por qué ensancha el rango de rating.** El lote original filtra 800–2000, y
// como la dificultad del Radar es un percentil dentro de cada fuente, un rango
// angosto deja los extremos de la escala sin contenido propio. Los puzzles CC0
// son la única fuente con dificultad calibrada por miles de personas: son lo
// único que puede estirar los extremos, y por eso el rango por defecto acá es
// más ancho.
//
//   node scripts/add-lichess-puzzles.mjs --puzzles lichess_db_puzzle.csv.zst
//   node scripts/add-lichess-puzzles.mjs --puzzles ... --target 600 --rating-min 500 --rating-max 2600
//   node scripts/add-lichess-puzzles.mjs --puzzles ... --dry-run
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Chess } from 'chess.js';
import {
  MIN_POR_TIPO,
  carnadaDesdeLineas,
  clasificarPorTablero,
  datasetVersion,
  interleaveByType,
  parseCsvLine,
  puzzleRowToRadarItem,
  renderSeedDataModule,
  validateRadarDataset,
} from './lib/radarDataset.mjs';
import { StockfishEngine } from './lib/stockfish.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');

const DEPTH = 14;
const TRAP_MARGIN = 200; // mismo umbral que reclassify-radar-tipos.mjs
/** Tramos de rating en los que se reparte el objetivo, para estirar la escala. */
const TRAMOS = 8;
/** Ningún tipo puede llevarse más que esto dentro de un tramo. */
const TOPE_POR_TIPO_EN_TRAMO = 0.5;

function arg(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : porDefecto;
}
const bandera = (nombre) => process.argv.includes(`--${nombre}`);

function entero(nombre, porDefecto) {
  const valor = Number(arg(nombre, String(porDefecto)));
  if (!Number.isInteger(valor) || valor <= 0) throw new Error(`--${nombre} debe ser un entero positivo.`);
  return valor;
}

function abrirTexto(archivo) {
  if (!archivo.endsWith('.zst')) return { stream: createReadStream(archivo), stop() {} };
  const decoder = spawn('zstd', ['-dc', '--', archivo]);
  decoder.stderr.pipe(process.stderr);
  decoder.on('error', () => {
    console.error('No se pudo ejecutar `zstd`. Instalalo, o descomprimí el archivo a mano y pasá el .csv.');
  });
  return { stream: decoder.stdout, stop: () => decoder.kill() };
}

function cargarCatalogo() {
  const texto = readFileSync(SEED_PATH, 'utf8');
  const marca = 'seedRadarItems: RadarItem[] = [';
  const inicio = texto.indexOf(marca) + marca.length - 1;
  return JSON.parse(texto.slice(inicio, texto.lastIndexOf(']') + 1));
}

/**
 * Posiciones que **no pueden** entrar al Radar por venir del export.
 *
 * La batería de transferencia (RF-12.2) mide si lo aprendido se traslada a
 * contenido nuevo, y toda su validez descansa en que sus 30 posiciones nunca
 * se entrenen. Este script elige entre millones de puzzles de la misma base de
 * Lichess de la que salió parte del resto del contenido: sin este filtro, una
 * coincidencia contaminaría el único instrumento que distingue aprender de
 * memorizar.
 *
 * Hay un test que compara los catálogos y falla si se solapan, pero detectarlo
 * después de escribir el archivo obliga a regenerar; descartarlo acá es gratis.
 * Se excluyen también currículo y Stoyko: una posición duplicada entre
 * catálogos no invalida nada, pero desperdicia un lugar del Radar.
 */
function fensReservadas() {
  const reservadas = new Set();
  const archivos = ['transferSeedData.ts', 'curriculumSeedData.ts', 'stoykoSeedData.ts'];
  for (const archivo of archivos) {
    const texto = readFileSync(join(scriptDir, '..', 'src', 'services', 'puzzles', archivo), 'utf8');
    for (const coincidencia of texto.matchAll(/fen:\s*'([^']+)'|"fen":\s*"([^"]+)"/g)) {
      reservadas.add(coincidencia[1] ?? coincidencia[2]);
    }
  }
  return reservadas;
}

/** En qué tramo de rating cae un puzzle. */
function tramoDe(rating, min, max) {
  const ancho = (max - min) / TRAMOS;
  return Math.min(TRAMOS - 1, Math.max(0, Math.floor((rating - min) / ancho)));
}

async function main() {
  if (bandera('help')) {
    process.stdout.write(
      'Uso: node scripts/add-lichess-puzzles.mjs --puzzles <lichess_db_puzzle.csv[.zst]>\n' +
        '     [--target 400] [--rating-min 600] [--rating-max 2600] [--popularidad 50] [--dry-run]\n',
    );
    return;
  }
  const archivo = arg('puzzles', null);
  if (!archivo) throw new Error('Falta --puzzles con el CSV del export de Lichess. Ver --help.');

  const objetivo = entero('target', 400);
  const ratingMin = entero('rating-min', 600);
  const ratingMax = entero('rating-max', 2600);
  const popularidadMin = Number(arg('popularidad', '50'));
  const dryRun = bandera('dry-run');
  if (ratingMax <= ratingMin) throw new Error('--rating-max debe ser mayor que --rating-min.');

  const existentes = cargarCatalogo();
  const reservadas = fensReservadas();
  const idsUsados = new Set(existentes.map((i) => i.id));
  // Las reservadas entran al mismo conjunto de descarte que las ya presentes:
  // el bucle no necesita saber la diferencia, solo que esas no se tocan.
  const fensUsados = new Set([...existentes.map((i) => i.fen), ...reservadas]);
  console.error(`Catálogo actual: ${existentes.length} posiciones. Objetivo: sumar ${objetivo}.`);
  console.error(`Reservadas y excluidas (transferencia, currículo, Stoyko): ${reservadas.size}.`);
  console.error(`Rating ${ratingMin}–${ratingMax}, popularidad ≥ ${popularidadMin}, ${TRAMOS} tramos.\n`);

  const filtros = { ratingMin, ratingMax, popularityMin: popularidadMin };
  const porTramo = Array.from({ length: TRAMOS }, () => []);
  const cupoTramo = Math.ceil(objetivo / TRAMOS);
  const topeTipo = Math.ceil(cupoTramo * TOPE_POR_TIPO_EN_TRAMO);
  /**
   * Los que necesitan al motor **ocupan lugar desde que se encolan**. Sin esto
   * esquivaban el cupo del tramo: en la prueba de humo, pedir 160 agregaba 349.
   */
  const dudosos = [];
  const pendientesPorTramo = Array.from({ length: TRAMOS }, () => 0);
  const ocupado = (tramo) => porTramo[tramo].length + pendientesPorTramo[tramo];
  const maxMotor = entero('max-motor', 300);

  const entrada = abrirTexto(archivo);
  const lector = createInterface({ input: entrada.stream, crlfDelay: Infinity });
  let filas = 0;
  let primera = true;
  try {
    for await (const linea of lector) {
      if (primera) {
        primera = false;
        continue; // encabezado
      }
      filas++;
      if (filas % 200_000 === 0) {
        const total = porTramo.reduce((s, t) => s + t.length, 0);
        console.error(`  ${filas.toLocaleString('es')} filas leídas, ${total}/${objetivo} elegidas…`);
      }

      let item;
      try {
        item = puzzleRowToRadarItem(parseCsvLine(linea), filtros);
      } catch {
        continue;
      }
      if (!item || idsUsados.has(item.id) || fensUsados.has(item.fen)) continue;

      const tramo = tramoDe(item.rating, ratingMin, ratingMax);
      const cesta = porTramo[tramo];
      if (ocupado(tramo) >= cupoTramo) continue;

      const previa = clasificarPorTablero(item);
      if (previa.tipo === null) {
        if (dudosos.length >= maxMotor) continue; // el motor no es gratis
        dudosos.push({ item, carnadas: previa.carnadas, tramo });
        pendientesPorTramo[tramo]++;
        idsUsados.add(item.id);
        fensUsados.add(item.fen);
        continue;
      }
      // Ningún tipo puede copar un tramo: la mezcla de RF-5.1 se sostiene por
      // catálogo, no solo por el peso del selector.
      if (cesta.filter((c) => c.tipo === previa.tipo).length >= topeTipo) continue;

      cesta.push({ ...item, tipo: previa.tipo });
      idsUsados.add(item.id);
      fensUsados.add(item.fen);

      if (porTramo.every((_, t) => ocupado(t) >= cupoTramo)) break;
    }
  } finally {
    lector.close();
    entrada.stop();
  }

  const elegidos = porTramo.flat();
  console.error(`\nLeídas ${filas.toLocaleString('es')} filas. Elegidas ${elegidos.length} por tablero.`);
  console.error(`Reparto por tramo: ${porTramo.map((t) => t.length).join(' / ')}.`);

  // Las pocas que el tablero no decide: las juzga el motor. Si no se puede, se
  // DESCARTAN en vez de etiquetarlas mal — se está eligiendo entre millones, y
  // meter una posición con el tipo equivocado invierte su feedback (que es
  // exactamente el defecto que corrigió la auditoría 2026-07).
  if (dudosos.length > 0) {
    console.error(`\n${dudosos.length} necesitan al motor (profundidad ${DEPTH})…`);
    const engine = new StockfishEngine();
    try {
      await engine.init();
      let resueltos = 0;
      for (const { item, carnadas, tramo } of dudosos) {
        resueltos++;
        if (resueltos % 25 === 0) console.error(`  ${resueltos}/${dudosos.length}…`);
        const legales = new Chess(item.fen).moves().length;
        const ranked = await engine.analyseMultiPv(item.fen, legales, DEPTH);
        if (ranked.length === 0) continue;
        const mejor = ranked[0].score;
        const puntaje = new Map(ranked.map((m) => [m.move, m.score]));
        const esTrampa = carnadas.some(({ uci }) => {
          const s = puntaje.get(uci);
          return s !== undefined && mejor - s >= TRAP_MARGIN;
        });
        const tipo = esTrampa ? 'envenenada' : 'ofensiva';
        // El mismo tope por tipo que en el camino rápido: si no entra, se cae.
        // Se está eligiendo entre millones; descartar es gratis.
        if (porTramo[tramo].filter((c) => c.tipo === tipo).length >= topeTipo) continue;

        if (tipo !== 'envenenada') {
          porTramo[tramo].push({ ...item, tipo });
          continue;
        }
        // Una envenenada SIN carnada marcada degrada su feedback a "era una
        // trampa" sin decir dónde estaba, que es la queja que originó RF-5.3.
        // Las líneas para calcularla ya están en esta misma búsqueda, así que
        // no cuesta nada; si no se pudiera, la posición se descarta.
        const carnada = carnadaDesdeLineas(item.fen, carnadas, ranked, DEPTH);
        if (!carnada) continue;
        porTramo[tramo].push({ ...item, tipo, carnada });
      }
    } catch (error) {
      console.error(`  El motor no arrancó (${error.message}). Esas ${dudosos.length} se descartan.`);
    } finally {
      engine.quit();
    }
  }

  const nuevos = porTramo.flat();
  if (nuevos.length === 0) throw new Error('No se eligió ninguna posición. ¿El archivo es el CSV de puzzles de Lichess?');

  const items = interleaveByType([...existentes, ...nuevos]);
  const check = validateRadarDataset(items, MIN_POR_TIPO);
  if (!check.ok) throw new Error(`Lote inválido tras el agregado:\n- ${check.errors.join('\n- ')}`);

  const version = datasetVersion(items);
  console.error(`\n${existentes.length} + ${nuevos.length} = ${items.length} posiciones.`);
  console.error(`Distribución: ${JSON.stringify(check.counts)}.`);
  const ratings = nuevos.map((i) => i.rating).sort((a, b) => a - b);
  console.error(`Rating de lo agregado: ${ratings[0]}–${ratings.at(-1)} (mediana ${ratings[Math.floor(ratings.length / 2)]}).`);

  if (dryRun) {
    console.error('\n(--dry-run: no se escribió nada.)');
    return;
  }
  writeFileSync(SEED_PATH, renderSeedDataModule(items, { version }));
  console.error(`\nLote ${version} escrito en ${SEED_PATH}.`);
  console.error('Verificá con:  npm test  &&  npm run measure:radar');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
