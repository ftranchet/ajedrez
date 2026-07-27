// El Radar (E5): selector de posiciones sin etiquetar. RF-5.1 exige que
// ningún patrón trivial prediga el tipo, y RF-5.5 que la dificultad se
// adapte para mantener la tasa de acierto en la banda 60–80% (zona de
// fallo 20–40%, Bjork). El subtipo doble solución (RF-5.7) se selecciona
// igual que cualquier otro ítem — su lógica de puntuación vive en
// core/dobleSolucion.ts, no acá.
import type { CategoriaError, ErrorCard, RadarItem, TipoRadar } from './types';
import { explicarPosicion } from './radarExplicacion';
import seleccion from '../config/radar-seleccion.json';

export interface RadarSelectionState {
  /** Últimos tipos servidos, más reciente al final. */
  historialTipos: TipoRadar[];
  /** Últimos ids servidos (evita repetir la posición exacta). */
  historialIds: string[];
  /** Centro 0–100 de dificultad normalizada por fuente (ADR-0007). */
  dificultadCentro: number;
}

export const RADAR_INITIAL_STATE: RadarSelectionState = {
  historialTipos: [],
  historialIds: [],
  dificultadCentro: 50,
};

// Las perillas viven en `config/radar-seleccion.json` y no como literales acá:
// `scripts/measure-radar-repeticion.mjs` tiene que simular **este** selector
// para que su medición signifique algo, y mientras las tuvo duplicadas el
// instrumento podía estar midiendo un selector distinto del que corre en la app.
const VENTANA_TIPOS = seleccion.ventanaTipos; // cuántos tipos recientes penalizan la repetición

/**
 * Qué fracción del pool alcanzable se reserva como "ya vista" antes de poder
 * repetir (RF-5.6).
 *
 * **Por qué es una fracción y no un número fijo.** La versión anterior evitaba
 * los últimos 8 ids: exactamente una sesión. Medido con
 * `npm run measure:radar` sobre el lote publicado, eso hacía que una posición
 * volviera **al día siguiente** en las cinco bandas de la dieta, y que a los
 * 30 días el usuario hubiera visto solo 33–48 de las 116 posiciones. Una
 * táctica que uno recuerda no entrena nada: repetirla al otro día es tiempo
 * tirado.
 *
 * Una ventana fija grande tampoco sirve, porque el pool alcanzable depende de
 * la dificultad del usuario (entre 30 y 57 posiciones en este catálogo): si la
 * ventana lo supera, el filtro se vacía y el selector termina repitiendo igual,
 * pero encima perdiendo el control de dificultad. Atada al tamaño del pool,
 * siempre queda al menos un 40% disponible para elegir.
 */
const FRACCION_EVITADA = seleccion.fraccionEvitada;

/**
 * Cuántos ids se recuerdan. Tiene que superar cómodamente la ventana efectiva
 * (0.6 × pool alcanzable) para que la fracción de arriba no quede recortada por
 * falta de memoria. Es dato del usuario y se persiste, pero son cadenas cortas:
 * el costo es despreciable frente a repetir ejercicios.
 */
const MEMORIA_IDS = seleccion.memoriaIds;
const ANCHO_BANDA = seleccion.anchoBanda; // ± percentiles sobre dificultadCentro
const PASO_AJUSTE = seleccion.pasoAjuste; // cuánto se mueve dificultadCentro por respuesta
const DIFICULTAD_MIN = 0;
const DIFICULTAD_MAX = 100;
/** RF-5.9: los errores propios complementan el Radar; no reemplazan su catálogo. */
export const OWN_ERROR_RADAR_MAX_SHARE = seleccion.cuotaErroresPropios;
const OWN_ERROR_RADAR_PREFIX = 'error-propio:';

function tipoFromCategoria(categoria: CategoriaError): TipoRadar {
  if (categoria === 'posicional') return 'tranquila';
  if (categoria === 'tiempo') return 'defensa';
  if (categoria === 'psicologico') return 'envenenada';
  return 'ofensiva';
}

/** Convierte una tarjeta en un ítem efímero, sin incorporarlo al catálogo. */
export function radarItemFromOwnError(card: ErrorCard): RadarItem {
  return {
    id: `${OWN_ERROR_RADAR_PREFIX}${card.id}`,
    fen: card.fen,
    tipo: tipoFromCategoria(card.categoria),
    temas: ['error-propio', card.categoria],
    rating: 0,
    solucion: [card.jugadaCorrecta],
    fuente: 'error-propio',
    errorCardId: card.id,
  };
}

/**
 * Solo recicla errores nacidos en partidas del usuario. Los ids excluidos
 * corresponden a tarjetas vencidas que ya tienen prioridad en la Cola de la
 * misma sesión, para no mostrar dos veces el mismo ejercicio.
 */
export function ownErrorRadarItems(cards: ErrorCard[], excludedCardIds: Iterable<string> = []): RadarItem[] {
  const excluded = new Set(excludedCardIds);
  return cards
    .filter((card) => card.origen === 'partida' && !excluded.has(card.id))
    .map(radarItemFromOwnError);
}

export function isOwnErrorRadarItem(item: RadarItem | null | undefined): boolean {
  return item?.fuente === 'error-propio' && typeof item.errorCardId === 'string';
}

/**
 * Sortea los lugares (0-based) reservados a errores propios. La cuota dura
 * de 25% evita que el reciclaje desplace al catálogo, y el sorteo impide que
 * el usuario aprenda un patrón como "cada cuarta posición es mía".
 */
export function scheduleOwnErrorRadarSlots(
  totalPositions: number,
  availableErrors: number,
  rng: () => number = Math.random,
): number[] {
  const total = Math.max(0, Math.floor(totalPositions));
  const quota = Math.min(Math.max(0, Math.floor(availableErrors)), Math.floor(total * OWN_ERROR_RADAR_MAX_SHARE));
  const positions = Array.from({ length: total }, (_, index) => index);
  for (let i = 0; i < quota; i++) {
    const j = i + Math.floor(rng() * (positions.length - i));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, quota).sort((a, b) => a - b);
}

/**
 * Percentil 0–100 del rating dentro de su fuente (ADR-0007). Las escalas de
 * fuentes distintas no se comparan. Los empates reciben su rango medio; una
 * cohorte sin variación queda en 50, sin inventar precisión.
 */
export function dificultadNormalizada(item: RadarItem, pool: RadarItem[]): number {
  const ratings = pool
    .filter((candidate) => candidate.fuente === item.fuente)
    .map((candidate) => candidate.rating)
    .sort((a, b) => a - b);
  if (ratings.length <= 1) return 50;
  const first = ratings.indexOf(item.rating);
  if (first < 0) return 50;
  const last = ratings.lastIndexOf(item.rating);
  return ((first + last) / 2 / (ratings.length - 1)) * 100;
}

/**
 * Percentil de cada ítem del pool, calculado de una sola pasada.
 *
 * `dificultadNormalizada` filtra y ordena el pool **entero por cada ítem**, y
 * la selección la llamaba una vez por ítem: coste cuadrático sobre un catálogo
 * que el proyecto planea agrandar a propósito con el export CC0 de Lichess.
 * Medido antes de esto: 1 ms por selección con 128 posiciones, 8 ms con 800 y
 * **67 ms con 2000** — un tirón visible en el celular, justo en el momento en
 * que el catálogo deje de ser chico. Acá se ordena una vez por fuente y se
 * resuelve cada ítem por búsqueda en un índice; el resultado es idéntico, y de
 * eso se encarga un test.
 */
function percentilesDelPool(pool: RadarItem[]): Map<string, number> {
  const porFuente = new Map<string, number[]>();
  for (const item of pool) {
    const ratings = porFuente.get(item.fuente);
    if (ratings) ratings.push(item.rating);
    else porFuente.set(item.fuente, [item.rating]);
  }
  // Por cada fuente: rating → percentil, con rango medio para los empates.
  const percentilPorFuente = new Map<string, Map<number, number>>();
  for (const [fuente, ratings] of porFuente) {
    ratings.sort((a, b) => a - b);
    const tabla = new Map<number, number>();
    if (ratings.length <= 1) {
      percentilPorFuente.set(fuente, tabla); // vacía: se resuelve en 50
      continue;
    }
    for (let i = 0; i < ratings.length; ) {
      let j = i;
      while (j + 1 < ratings.length && ratings[j + 1] === ratings[i]) j++;
      tabla.set(ratings[i], ((i + j) / 2 / (ratings.length - 1)) * 100);
      i = j + 1;
    }
    percentilPorFuente.set(fuente, tabla);
  }

  const percentiles = new Map<string, number>();
  for (const item of pool) {
    percentiles.set(item.id, percentilPorFuente.get(item.fuente)?.get(item.rating) ?? 50);
  }
  return percentiles;
}

/**
 * Ajusta el centro de la banda de dificultad tras una respuesta (RF-5.5):
 * sube si el acierto reciente supera 80%, baja si cae debajo de 60%.
 */
export function adjustDifficulty(state: RadarSelectionState, acierto: boolean, tasaAciertoReciente: number): RadarSelectionState {
  const delta =
    tasaAciertoReciente > 0.8
      ? PASO_AJUSTE
      : tasaAciertoReciente < 0.6
        ? -PASO_AJUSTE
        : (acierto ? 1 : -1) * (PASO_AJUSTE / 4); // deriva suave dentro de la banda buena
  const dificultadCentro = Math.min(
    DIFICULTAD_MAX,
    Math.max(DIFICULTAD_MIN, state.dificultadCentro + delta),
  );
  return { ...state, dificultadCentro };
}

/** Tasa de acierto que el selector adaptativo persigue: centro de la banda 60–80% (RF-5.5). */
const TASA_OBJETIVO = 0.7;

/**
 * Centro de dificultad con el que arranca el Radar después del diagnóstico
 * (RF-11.4), a partir de la tasa de acierto observada en sus 20 posiciones.
 *
 * El diagnóstico sirve posiciones **sin** adaptar la dificultad, a propósito:
 * si adaptara, la tasa convergería a ~70% para cualquier nivel y dejaría de
 * discriminar, que es justo lo que ahí se necesita medir. Pero eso hacía que
 * las 20 respuestas no dejaran ninguna huella y la sesión arrancara en el
 * percentil neutral 50, obligando al selector a redescubrir el nivel del
 * usuario desde cero (el criterio de salida de E5 pide converger en ≤50
 * posiciones; 20 recién medidas se estaban tirando).
 *
 * La traducción es una heurística explícita y suave: acertar por encima del
 * objetivo mueve el centro hacia arriba en la misma proporción, y viceversa.
 * Es un punto de partida informado, no una medición de dificultad; el ajuste
 * fino sigue siendo trabajo de `adjustDifficulty` durante las sesiones.
 */
export function centroInicialDesdeDiagnostico(tasaAcierto: number): number {
  const acotada = Math.min(1, Math.max(0, tasaAcierto));
  const centro = RADAR_INITIAL_STATE.dificultadCentro + (acotada - TASA_OBJETIVO) * 100;
  return Math.min(DIFICULTAD_MAX, Math.max(DIFICULTAD_MIN, Math.round(centro)));
}

/**
 * Peso de un tipo al sortear la próxima posición.
 *
 * `sesgoPorTipo` es el perfil de fugas entrando en la selección (RF-11.2): un
 * multiplicador acotado para los tipos donde el usuario falla más, calculado
 * en core/leakProfile.ts. Se aplica **antes** de la penalización por
 * repetición a propósito: un tipo que ya salió dos veces en la ventana cae a
 * 0,3 aunque sea la fuga, así que insistir nunca degenera en un bloque
 * monotemático ni vuelve predecible la mezcla que RF-5.1 protege.
 */
function pesoPorTipo(tipo: TipoRadar, historialTipos: TipoRadar[], sesgoPorTipo?: Map<TipoRadar, number>): number {
  const recientes = historialTipos.slice(-VENTANA_TIPOS);
  const apariciones = recientes.filter((t) => t === tipo).length;
  const sesgo = sesgoPorTipo?.get(tipo) ?? 1;
  // Penalización suave, no exclusión dura: evita bloques monotemáticos sin
  // caer en una rotación fija (que sería, a su vez, un patrón predecible).
  if (apariciones === 0) return 3 * sesgo;
  if (apariciones === 1) return 1 * sesgo;
  return 0.3;
}

function pesosAcumulados<T>(items: T[], peso: (item: T) => number): { item: T; acumulado: number }[] {
  let acumulado = 0;
  return items.map((item) => {
    acumulado += Math.max(peso(item), 0.001);
    return { item, acumulado };
  });
}

/**
 * Cuántos ítems de un tipo ausente de la banda se rescatan por cercanía.
 * Chico a propósito: garantiza que el tipo siga apareciendo sin que un tipo
 * de 8 posiciones inunde la sesión.
 */
const RESCATE_POR_TIPO = seleccion.rescatePorTipo;

/**
 * Tipos que existen en el pool pero que la banda de dificultad dejó afuera,
 * con sus ítems más cercanos al centro (RF-5.1).
 *
 * **Por qué hace falta.** Todo el contenido generado por autojuego lleva un
 * rating fijo de 1500 porque no hay una comunidad que lo calibre (ADR-0007).
 * Una cohorte constante devuelve percentil 50 para *todos* sus ítems, así que
 * las 8 envenenadas y las 8 de doble solución vivían exactamente en 50 y solo
 * eran alcanzables con el centro adaptativo entre 35 y 65. Medido sobre el
 * lote publicado: fuera de esa ventana el Radar servía **cero** ofertas
 * envenenadas. Un usuario que mejora —y cuyo centro sube a 70— dejaba de ver
 * trampas para siempre, con lo cual "capturar siempre está bien" pasaba a ser
 * cierto el 100% de las veces. Eso es justo el patrón trivial que RF-5.1
 * prohíbe, y no lo arregla agrandar el catálogo: es la selección la que dejaba
 * un tipo entero fuera de alcance.
 *
 * La alternativa —inventarle un rating a cada posición generada para
 * repartirla en la escala— sería fabricar precisión que nadie midió, que es
 * exactamente lo que ADR-0007 decidió no hacer.
 */
function rescatarTiposAusentes(
  pool: RadarItem[],
  presentes: RadarItem[],
  state: RadarSelectionState,
  recientes: Set<string>,
  percentiles: Map<string, number>,
): RadarItem[] {
  const tiposEnBanda = new Set(presentes.map((item) => item.tipo));
  const faltantes = [...new Set(pool.map((item) => item.tipo))].filter((tipo) => !tiposEnBanda.has(tipo));
  return faltantes.flatMap((tipo) =>
    pool
      .filter((item) => item.tipo === tipo && !recientes.has(item.id))
      .map((item) => ({ item, distancia: Math.abs((percentiles.get(item.id) ?? 50) - state.dificultadCentro) }))
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, RESCATE_POR_TIPO)
      .map(({ item }) => item),
  );
}

/**
 * Elige la próxima posición del Radar. Devuelve null si el pool está vacío.
 *
 * `sesgoPorTipo` (opcional) inclina la mezcla hacia los tipos donde el usuario
 * falla más, con el tope descrito en `pesoPorTipo`. El diagnóstico no lo pasa:
 * ahí se mide con el instrumento sin adaptar, y sesgarlo contaminaría la
 * medición con lo que la medición todavía no dijo.
 */
export function selectNextRadarItem(
  pool: RadarItem[],
  state: RadarSelectionState,
  rng: () => number = Math.random,
  sesgoPorTipo?: Map<TipoRadar, number>,
): RadarItem | null {
  if (pool.length === 0) return null;

  const percentiles = percentilesDelPool(pool);
  const enBanda = pool.filter(
    (item) => Math.abs((percentiles.get(item.id) ?? 50) - state.dificultadCentro) <= ANCHO_BANDA,
  );
  const alcanzables = enBanda.length > 0 ? enBanda : pool;

  // La ventana se mide contra lo que este usuario puede llegar a ver, no
  // contra el catálogo entero: es su pool efectivo el que determina cuántas
  // sesiones puede aguantar sin repetir.
  const ventana = Math.min(state.historialIds.length, Math.floor(alcanzables.length * FRACCION_EVITADA));
  // Set y no array: `includes` sobre la ventana, dentro de un filter sobre el
  // pool, era el otro término cuadrático de esta función.
  const recientes = new Set(ventana > 0 ? state.historialIds.slice(-ventana) : []);

  const candidatos = alcanzables.filter((item) => !recientes.has(item.id));
  const universo =
    candidatos.length > 0
      ? [...candidatos, ...rescatarTiposAusentes(pool, candidatos, state, recientes, percentiles)]
      : alcanzables;

  const pesados = pesosAcumulados(universo, (item) => pesoPorTipo(item.tipo, state.historialTipos, sesgoPorTipo));
  const total = pesados[pesados.length - 1].acumulado;
  const dardo = rng() * total;
  const elegido = pesados.find((p) => dardo <= p.acumulado) ?? pesados[pesados.length - 1];
  return elegido.item;
}

/** Registra la posición servida en el historial de selección. */
export function recordServed(state: RadarSelectionState, item: RadarItem): RadarSelectionState {
  return {
    ...state,
    // El tipo de un error propio es una adaptación técnica de su categoría,
    // no una etiqueta verificada del catálogo: no debe sesgar la mezcla RF-5.1.
    historialTipos: isOwnErrorRadarItem(item)
      ? state.historialTipos
      : [...state.historialTipos, item.tipo].slice(-20),
    historialIds: [...state.historialIds, item.id].slice(-MEMORIA_IDS),
  };
}

/**
 * Texto de feedback (RF-5.3): explica el porqué también cuando no había
 * táctica.
 *
 * Hasta la ronda C esto era una tabla de cinco frases fijas —una por tipo—
 * que las 116 posiciones del catálogo se repartían. La composición por
 * posición vive en `core/radarExplicacion.ts`, que solo afirma lo que puede
 * comprobar sobre el tablero; acá queda la puerta de entrada que ya usaban
 * las dos pantallas.
 */
export function explainFeedback(item: RadarItem, acierto: boolean): string {
  return explicarPosicion(item, acierto);
}

/** Feedback que revela el origen propio recién después de responder. */
export function explainOwnErrorFeedback(acierto: boolean): string {
  return acierto
    ? 'Esta posición volvió de un error de una partida tuya. Esta vez encontraste la corrección.'
    : 'Esta posición volvió de un error de una partida tuya. La corrección todavía necesita trabajo y seguirá en su calendario de repaso.';
}

/**
 * ¿La jugada del usuario cuenta como acierto en el Radar? La jugada principal
 * (`solucion[0]`) siempre, más cualquiera de las `jugadasAceptables` — en
 * posiciones tranquilas, donde varias jugadas son prácticamente equivalentes
 * y exigir una exacta marcaría un fallo falso (RF-5.3). La lógica del subtipo
 * doble solución (RF-5.7, la jugada "familiar" también acierta) vive aparte
 * en core/dobleSolucion.ts porque además registra la tasa de conformismo.
 */
export function esRespuestaCorrectaRadar(item: RadarItem, jugadaUsuario: string): boolean {
  if (jugadaUsuario === item.solucion[0]) return true;
  return item.jugadasAceptables?.includes(jugadaUsuario) ?? false;
}

/**
 * Categoría por defecto para una tarjeta que nace de un fallo del Radar
 * (RF-5.4). RF-3.3 pide categorización manual en un toque, pero esa regla es
 * específica del análisis de partidas (E3); acá se asigna automáticamente
 * como simplificación de Fase 1 — dejar que el usuario la corrija queda
 * pendiente para una fase posterior.
 */
export function categoriaFromTipo(tipo: TipoRadar): CategoriaError {
  return tipo === 'tranquila' ? 'posicional' : 'tactico';
}
