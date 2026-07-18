// El Radar (E5): selector de posiciones sin etiquetar. RF-5.1 exige que
// ningún patrón trivial prediga el tipo, y RF-5.5 que la dificultad se
// adapte para mantener la tasa de acierto en la banda 60–80% (zona de
// fallo 20–40%, Bjork). El subtipo doble solución (RF-5.7) se selecciona
// igual que cualquier otro ítem — su lógica de puntuación vive en
// core/dobleSolucion.ts, no acá.
import type { CategoriaError, RadarItem, TipoRadar } from './types';

export interface RadarSelectionState {
  /** Últimos tipos servidos, más reciente al final. */
  historialTipos: TipoRadar[];
  /** Últimos ids servidos (evita repetir la posición exacta). */
  historialIds: string[];
  /** Centro de la banda de rating servida; se desplaza según el desempeño. */
  ratingCentro: number;
}

export const RADAR_INITIAL_STATE: RadarSelectionState = {
  historialTipos: [],
  historialIds: [],
  ratingCentro: 1200,
};

const VENTANA_TIPOS = 3; // cuántos tipos recientes penalizan la repetición
const VENTANA_IDS = 8; // cuántos ids recientes se evitan
const ANCHO_BANDA = 150; // ± sobre ratingCentro
const PASO_AJUSTE = 40; // cuánto se mueve ratingCentro por respuesta

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
  return { ...state, ratingCentro: state.ratingCentro + delta };
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
      Math.abs(item.rating - state.ratingCentro) <= ANCHO_BANDA && !state.historialIds.slice(-VENTANA_IDS).includes(item.id),
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
    historialTipos: [...state.historialTipos, item.tipo].slice(-20),
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
