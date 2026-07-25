// Panel de verdad v1 (RF-12.1): media móvil de errores graves por partida
// analizada, a partir de datos que E3 ya produce. La "rating de partidas
// lentas" numérica que pide el PRD necesita un historial real (Lichess/
// Chess.com, bloqueado por red en este entorno — ver docs/roadmap.md) para
// calibrarse con sentido; mientras tanto se muestra la banda de Elo del
// diagnóstico (E11), categórica, en vez de inventar un número sin base.
import type { GameRecord, Profile } from './types';

const VENTANA_PARTIDAS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
export const TRUTH_IMPROVEMENT_MIN_GAMES = 3;
export const TRUTH_IMPROVEMENT_THRESHOLD = 20;

/**
 * Errores graves/error del USUARIO en una partida (RF-12.1). Cuenta solo las
 * jugadas del lado que jugó el usuario (`jugadorColor`): en los niveles bajos
 * el motor comete errores a propósito (RF-1.3), y sumarlos inflaría la métrica
 * con ruido que no es del usuario. Devuelve null si no se puede atribuir el
 * lado (partidas importadas sin `jugadorColor`), para excluirlas de la media
 * en vez de contar las jugadas de ambos.
 */
export function erroresGravesUsuario(game: GameRecord): number | null {
  if (!game.analisis || game.jugadorColor === undefined) return null;
  return game.analisis.jugadas.filter(
    (j) => j.ladoQueMueve === game.jugadorColor && (j.clasificacion === 'grave' || j.clasificacion === 'error'),
  ).length;
}

export interface RatingDeVerdad {
  valor: number;
  /** Cambio contra el primer valor de la serie declarada; null si todavía no hay contra qué comparar. */
  delta: number | null;
  origen: 'declarado' | 'partida';
}

/**
 * El rating de partidas lentas del Panel de verdad (RF-12.1), que es el
 * instrumento de la métrica estrella del PRD (§3.1: ΔElo contra línea base).
 *
 * Hasta ahora esto solo podía salir de una partida importada por PGN con
 * rating: las partidas jugadas dentro de la app se guardan como `sin-reloj` y
 * sin `ratingUsuario`, así que un usuario que solo juega acá adentro no veía
 * nunca un número —y el detector de sobreajuste (RF-12.3), que exige lo mismo,
 * no podía activarse jamás—. Por eso el diagnóstico ahora pide el rating real
 * al usuario y lo guarda como serie: es la única fuente disponible mientras la
 * importación automática de historial siga bloqueada.
 *
 * Las dos fuentes no se mezclan en un mismo delta —son poblaciones distintas—:
 * la serie declarada tiene prioridad porque es la que el usuario mantiene a
 * propósito, y la partida rateada queda como respaldo.
 */
export function ratingDePartidasLentas(
  profile: Pick<Profile, 'ratingsExternos'>,
  games: GameRecord[],
): RatingDeVerdad | null {
  const serie = [...(profile.ratingsExternos ?? [])].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  );
  const ultimo = serie.at(-1);
  if (ultimo) {
    return {
      valor: ultimo.valor,
      delta: serie.length > 1 ? ultimo.valor - serie[0].valor : null,
      origen: 'declarado',
    };
  }
  const partidaRateada = games
    .filter((game) => (game.ritmo === 'rapida' || game.ritmo === 'clasica') && game.ratingUsuario !== undefined)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
  if (!partidaRateada) return null;
  return { valor: partidaRateada.ratingUsuario as number, delta: null, origen: 'partida' };
}

export interface TruthImprovement {
  porcentaje: number;
  mediaAnterior: number;
  mediaActual: number;
  partidasAnteriores: number;
  partidasActuales: number;
}

/**
 * Señal celebrable de RF-13.2: compara errores graves por partida real en
 * los últimos 30 días contra los 30 anteriores. Exige tres partidas
 * atribuibles por tramo y una caída de al menos 20%; volumen o aciertos de
 * ejercicios nunca participan.
 */
export function mejoraErroresGraves(
  games: GameRecord[],
  now: Date = new Date(),
  days = 30,
  minGames = TRUTH_IMPROVEMENT_MIN_GAMES,
): TruthImprovement | null {
  const end = now.getTime();
  const currentStart = end - days * DAY_MS;
  const previousStart = currentStart - days * DAY_MS;
  const attributable = games
    .map((game) => ({ errores: erroresGravesUsuario(game), timestamp: new Date(game.fecha).getTime() }))
    .filter((entry): entry is { errores: number; timestamp: number } =>
      entry.errores !== null && Number.isFinite(entry.timestamp),
    );
  const previous = attributable.filter((entry) => entry.timestamp >= previousStart && entry.timestamp < currentStart);
  const current = attributable.filter((entry) => entry.timestamp >= currentStart && entry.timestamp <= end);
  if (previous.length < minGames || current.length < minGames) return null;

  const mediaAnterior = previous.reduce((sum, entry) => sum + entry.errores, 0) / previous.length;
  const mediaActual = current.reduce((sum, entry) => sum + entry.errores, 0) / current.length;
  if (mediaAnterior <= 0 || mediaActual >= mediaAnterior) return null;
  const porcentaje = ((mediaAnterior - mediaActual) / mediaAnterior) * 100;
  if (porcentaje < TRUTH_IMPROVEMENT_THRESHOLD) return null;
  return {
    porcentaje,
    mediaAnterior,
    mediaActual,
    partidasAnteriores: previous.length,
    partidasActuales: current.length,
  };
}

export interface PuntoSerie {
  /** Fecha ISO del punto (la partida o el registro más reciente del tramo). */
  fecha: string;
  valor: number;
}

/**
 * Serie de errores graves por partida, en orden cronológico, para mostrar
 * **evolución** y no un valor puntual.
 *
 * El Panel de verdad mostraba las tres métricas como números sueltos: la media
 * móvil de errores graves aparecía como "2,4" sin ninguna forma de ver si venía
 * bajando o subiendo, y la única señal de cambio era una celebración binaria
 * que exige tres partidas por ventana y una caída del 20%. Con eso, la pregunta
 * que el producto dice querer responder —"¿esto me está haciendo mejor?"— no
 * tenía respuesta visible el 90% del tiempo.
 *
 * Cada punto es la media móvil hasta esa partida, así que la serie se lee como
 * la tendencia y no como el ruido partida a partida.
 */
export function serieErroresGraves(games: GameRecord[], ventana: number = VENTANA_PARTIDAS): PuntoSerie[] {
  const atribuibles = games
    .filter((game) => game.analisis && game.jugadorColor !== undefined)
    .map((game) => ({ errores: erroresGravesUsuario(game) ?? 0, fecha: game.fecha, t: new Date(game.fecha).getTime() }))
    .filter((entrada) => Number.isFinite(entrada.t))
    .sort((a, b) => a.t - b.t);
  return atribuibles.map((entrada, index) => {
    const desde = Math.max(0, index + 1 - ventana);
    const tramo = atribuibles.slice(desde, index + 1);
    return {
      fecha: entrada.fecha,
      valor: tramo.reduce((sum, item) => sum + item.errores, 0) / tramo.length,
    };
  });
}

/**
 * Tendencia de una serie: compara la media del último tercio contra la del
 * primero. Devuelve null cuando no hay puntos suficientes para afirmar nada —
 * un producto que promete honestidad no puede dibujar una flecha con dos datos.
 */
export function tendenciaSerie(serie: PuntoSerie[], minPuntos = 6): { delta: number; primero: number; ultimo: number } | null {
  if (serie.length < minPuntos) return null;
  const tercio = Math.max(2, Math.floor(serie.length / 3));
  const media = (puntos: PuntoSerie[]) => puntos.reduce((sum, punto) => sum + punto.valor, 0) / puntos.length;
  const primero = media(serie.slice(0, tercio));
  const ultimo = media(serie.slice(-tercio));
  return { delta: ultimo - primero, primero, ultimo };
}

/**
 * Media móvil de errores graves/error del usuario por partida, sobre las
 * últimas `ventana` partidas analizadas y atribuibles (más recientes primero
 * por `fecha`). Null si todavía no hay ninguna que cuente.
 */
export function erroresGravesPorPartidaMediaMovil(games: GameRecord[], ventana: number = VENTANA_PARTIDAS): number | null {
  const atribuibles = games
    .filter((g) => g.analisis && g.jugadorColor !== undefined)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, ventana);
  if (atribuibles.length === 0) return null;
  const total = atribuibles.reduce((sum, g) => sum + (erroresGravesUsuario(g) ?? 0), 0);
  return total / atribuibles.length;
}
