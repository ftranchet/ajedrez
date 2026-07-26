// Mide cada cuánto se repite una posición del Radar (RF-5.1, RF-5.6).
//
// "Se repite porque tiene pocos ejercicios" era hasta ahora una impresión. Lo
// que la vuelve medible es que el catálogo no se sirve entero: el selector
// filtra por una banda de dificultad de ±15 percentiles alrededor del centro
// adaptativo, así que el pool **efectivo** de un usuario concreto es una
// fracción del total. Este script simula sesiones reales contra el catálogo
// publicado y reporta, por cada centro de dificultad:
//
//   - cuántas posiciones son alcanzables (pool efectivo),
//   - a los cuántos días vuelve a aparecer una posición ya vista,
//   - qué proporción del catálogo se llegó a ver en 30 días.
//
// No mide "está bien" o "está mal": mide cuántos días de práctica aguanta el
// catálogo antes de empezar a repetirse, que es lo que el usuario percibe.
//
//   node scripts/measure-radar-repeticion.mjs [--dias 30] [--corridas 40]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(scriptDir, '..', 'src', 'services', 'puzzles', 'seedData.ts');
const DIETA_PATH = join(scriptDir, '..', 'src', 'config', 'prescriptor-dieta.json');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const DIAS = Number(arg('dias', '30'));
const CORRIDAS = Number(arg('corridas', '40'));

function cargarCatalogo() {
  const text = readFileSync(SEED_PATH, 'utf8');
  const marker = 'seedRadarItems: RadarItem[] = [';
  const start = text.indexOf(marker) + marker.length - 1;
  return JSON.parse(text.slice(start, text.lastIndexOf(']') + 1));
}

// Réplica exacta de core/radar.ts. Si la selección cambia, esta copia tiene
// que cambiar con ella: el número que imprime este script solo vale si simula
// el selector real.
const ANCHO_BANDA = 15;
const FRACCION_EVITADA = 0.6;
const VENTANA_TIPOS = 3;
const RESCATE_POR_TIPO = 3;
const MEMORIA_IDS = 120;

function dificultadNormalizada(item, pool) {
  const ratings = pool.filter((c) => c.fuente === item.fuente).map((c) => c.rating).sort((a, b) => a - b);
  if (ratings.length <= 1) return 50;
  const first = ratings.indexOf(item.rating);
  if (first < 0) return 50;
  return ((first + ratings.lastIndexOf(item.rating)) / 2 / (ratings.length - 1)) * 100;
}

function pesoPorTipo(tipo, historialTipos) {
  const recientes = historialTipos.slice(-VENTANA_TIPOS);
  const apariciones = recientes.filter((t) => t === tipo).length;
  if (apariciones === 0) return 3;
  if (apariciones === 1) return 1;
  return 0.3;
}

function seleccionar(pool, dificultades, state, rng) {
  if (pool.length === 0) return null;
  const enBanda = pool.filter((item) => Math.abs(dificultades.get(item.id) - state.dificultadCentro) <= ANCHO_BANDA);
  const alcanzables = enBanda.length > 0 ? enBanda : pool;
  const ventana = Math.min(state.historialIds.length, Math.floor(alcanzables.length * FRACCION_EVITADA));
  const recientes = ventana > 0 ? state.historialIds.slice(-ventana) : [];
  const candidatos = alcanzables.filter((item) => !recientes.includes(item.id));

  let universo = alcanzables;
  if (candidatos.length > 0) {
    const tiposEnBanda = new Set(candidatos.map((i) => i.tipo));
    const faltantes = [...new Set(pool.map((i) => i.tipo))].filter((t) => !tiposEnBanda.has(t));
    const rescate = faltantes.flatMap((tipo) =>
      pool
        .filter((item) => item.tipo === tipo && !recientes.includes(item.id))
        .map((item) => ({ item, d: Math.abs(dificultades.get(item.id) - state.dificultadCentro) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, RESCATE_POR_TIPO)
        .map(({ item }) => item),
    );
    universo = [...candidatos, ...rescate];
  }

  let acumulado = 0;
  const pesados = universo.map((item) => {
    acumulado += Math.max(pesoPorTipo(item.tipo, state.historialTipos), 0.001);
    return { item, acumulado };
  });
  const dardo = rng() * acumulado;
  return (pesados.find((p) => dardo <= p.acumulado) ?? pesados.at(-1)).item;
}

function rngSemilla(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

/** Una corrida de DIAS sesiones: devuelve el primer día con repetición y la cobertura. */
function simular(pool, dificultades, centro, porSesion, semilla) {
  const rng = rngSemilla(semilla);
  let state = { historialTipos: [], historialIds: [], dificultadCentro: centro };
  const vistoEnDia = new Map();
  let primeraRepeticion = null;

  for (let dia = 1; dia <= DIAS; dia++) {
    for (let i = 0; i < porSesion; i++) {
      const item = seleccionar(pool, dificultades, state, rng);
      if (!item) continue;
      if (vistoEnDia.has(item.id) && primeraRepeticion === null) {
        primeraRepeticion = dia - vistoEnDia.get(item.id);
      }
      vistoEnDia.set(item.id, dia);
      state = {
        historialTipos: [...state.historialTipos, item.tipo].slice(-20),
        historialIds: [...state.historialIds, item.id].slice(-MEMORIA_IDS),
        dificultadCentro: centro,
      };
    }
  }
  return { primeraRepeticion, vistas: vistoEnDia.size };
}

const pool = cargarCatalogo();
const dieta = JSON.parse(readFileSync(DIETA_PATH, 'utf8'));
const dificultades = new Map(pool.map((item) => [item.id, dificultadNormalizada(item, pool)]));

console.log(`Catálogo: ${pool.length} posiciones.`);
const porTipo = pool.reduce((acc, i) => ({ ...acc, [i.tipo]: (acc[i.tipo] ?? 0) + 1 }), {});
console.log(`Por tipo: ${Object.entries(porTipo).map(([t, n]) => `${t} ${n}`).join(', ')}.`);
console.log(`\nSimulación: ${DIAS} días, ${CORRIDAS} corridas por banda.\n`);
console.log('banda            centro  radar/día  pool efectivo  repite a los  visto en 30 días');
console.log('─'.repeat(84));

let peorRepeticion = Infinity;
for (const [banda, config] of Object.entries(dieta.bandas)) {
  // El centro adaptativo tiende a subir con el nivel del usuario: se simula
  // cada banda de la dieta en el centro que le corresponde grosso modo.
  const centros = { principiante: 20, elemental: 35, intermedio: 50, avanzado: 65, experto: 80 };
  const centro = centros[banda] ?? 50;
  const alcanzables = pool.filter((i) => Math.abs(dificultades.get(i.id) - centro) <= ANCHO_BANDA).length;

  const corridas = Array.from({ length: CORRIDAS }, (_, k) => simular(pool, dificultades, centro, config.radarCount, k + 1));
  const repeticiones = corridas.map((c) => c.primeraRepeticion).filter((d) => d !== null);
  const mediana = repeticiones.length > 0 ? repeticiones.sort((a, b) => a - b)[Math.floor(repeticiones.length / 2)] : null;
  const cobertura = corridas.reduce((s, c) => s + c.vistas, 0) / corridas.length;
  if (mediana !== null) peorRepeticion = Math.min(peorRepeticion, mediana);

  console.log(
    `${banda.padEnd(15)} ${String(centro).padStart(5)}  ${String(config.radarCount).padStart(9)}  ` +
      `${String(alcanzables).padStart(13)}  ${(mediana === null ? 'nunca' : `${mediana} día(s)`).padStart(12)}  ` +
      `${`${cobertura.toFixed(0)}/${pool.length}`.padStart(16)}`,
  );
}

console.log(
  `\nLa repetición más temprana de todas las bandas cae a los ${peorRepeticion} día(s). ` +
    'Una posición táctica que se recuerda ya no entrena nada: cuanto más chico ese número, más\n' +
    'gruesa es la limitación del catálogo. RF-5.9 la compensa en parte reciclando errores propios\n' +
    '(hasta 25% de los lugares), que no están en esta simulación porque dependen de cuánto juegue el usuario.',
);
