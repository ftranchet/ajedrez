// El Radar (E5): selector de posiciones sin etiquetar. RF-5.1 exige que
// ningún patrón trivial prediga el tipo, y RF-5.5 que la dificultad se
// adapte para mantener la tasa de acierto en la banda 60–80% (zona de
// fallo 20–40%, Bjork). El subtipo doble solución (RF-5.7) se selecciona
// igual que cualquier otro ítem — su lógica de puntuación vive en
// core/dobleSolucion.ts, no acá.
import type { CategoriaError, ErrorCard, RadarItem, TipoRadar } from './types';

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

const VENTANA_TIPOS = 3; // cuántos tipos recientes penalizan la repetición
const VENTANA_IDS = 8; // cuántos ids recientes se evitan
const ANCHO_BANDA = 15; // ± percentiles sobre dificultadCentro
const PASO_AJUSTE = 4; // cuánto se mueve dificultadCentro por respuesta
const DIFICULTAD_MIN = 0;
const DIFICULTAD_MAX = 100;
/** RF-5.9: los errores propios complementan el Radar; no reemplazan su catálogo. */
export const OWN_ERROR_RADAR_MAX_SHARE = 0.25;
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

function pesoPorTipo(tipo: TipoRadar, historialTipos: TipoRadar[]): number {
  const recientes = historialTipos.slice(-VENTANA_TIPOS);
  const apariciones = recientes.filter((t) => t === tipo).length;
  // Penalización suave, no exclusión dura: evita bloques monotemáticos sin
  // caer en una rotación fija (que sería, a su vez, un patrón predecible).
  if (apariciones === 0) return 3;
  if (apariciones === 1) return 1;
  return 0.3;
}

function pesosAcumulados<T>(items: T[], peso: (item: T) => number): { item: T; acumulado: number }[] {
  let acumulado = 0;
  return items.map((item) => {
    acumulado += Math.max(peso(item), 0.001);
    return { item, acumulado };
  });
}

/** Elige la próxima posición del Radar. Devuelve null si el pool está vacío. */
export function selectNextRadarItem(
  pool: RadarItem[],
  state: RadarSelectionState,
  rng: () => number = Math.random,
): RadarItem | null {
  if (pool.length === 0) return null;

  const banda = pool.filter(
    (item) =>
      Math.abs(dificultadNormalizada(item, pool) - state.dificultadCentro) <= ANCHO_BANDA &&
      !state.historialIds.slice(-VENTANA_IDS).includes(item.id),
  );
  const candidatos = banda.length > 0 ? banda : pool.filter((item) => !state.historialIds.slice(-VENTANA_IDS).includes(item.id));
  const universo = candidatos.length > 0 ? candidatos : pool;

  const pesados = pesosAcumulados(universo, (item) => pesoPorTipo(item.tipo, state.historialTipos));
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
    historialIds: [...state.historialIds, item.id].slice(-20),
  };
}

const EXPLICACIONES_ACIERTO: Record<TipoRadar, string> = {
  ofensiva: 'Encontraste el golpe táctico: había una combinación ganadora y la viste.',
  defensa: 'Encontraste el único recurso defensivo — el resto de las jugadas perdía material o el juego.',
  tranquila: 'No había ninguna táctica y elegiste una jugada sólida en lugar de forzar algo que no estaba. Eso también es acertar.',
  genuina: 'La oferta era real: capturar ganaba material limpio, sin ninguna trampa detrás.',
  envenenada: 'Detectaste la trampa: esa captura parecía ganar algo pero perdía material a cambio.',
};

const EXPLICACIONES_FALLO: Record<TipoRadar, string> = {
  ofensiva: 'Había una combinación ganadora que no se jugó — se perdió la oportunidad de sacar ventaja decisiva.',
  defensa: 'Esta posición exigía el único recurso defensivo disponible; otra jugada dejaba pasar la amenaza.',
  tranquila: 'No había ninguna táctica acá: la posición pedía una jugada sólida y tranquila, no forzar una combinación que no existía.',
  genuina: 'La oferta era genuina — no había trampa. No capturar dejó pasar material gratis.',
  envenenada: 'Era una trampa: esa captura parecía ganar algo pero en realidad perdía material.',
};

/** Texto de feedback (RF-5.3): explica el porqué también cuando no había táctica. */
export function explainFeedback(item: RadarItem, acierto: boolean): string {
  return (acierto ? EXPLICACIONES_ACIERTO : EXPLICACIONES_FALLO)[item.tipo];
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
