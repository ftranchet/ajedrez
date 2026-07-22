// Prescriptor (E11): compone "Tu sesión de hoy" en el orden de RF-11.2 —
// (1) repasos vencidos de la Cola, ya resueltos por core/errorCard.ts;
// (2) dieta base por banda de Elo, tabla versionada en config/ (RF-11.6),
// no hardcodeada; (3) ajuste por fugas del último mes: refuerza el Radar
// cuando dominan los errores tácticos, y suma un bloque de Triage de reloj
// (E9) cuando el perfil de tiempo muestra apuro o desperdicio — el ejemplo
// literal de RF-11.2 ("si >35% de las derrotas son por reloj, sube Triage").
import type { BandaElo, CategoriaError, ErrorCard, GameRecord, Profile } from './types';
import { DEFAULT_WEEKLY_PLAN } from './adherence';
import { hayFugaDeTiempo, perfilDeTiempo } from './triage';
import dietaConfig from '../config/prescriptor-dieta.json' with { type: 'json' };

export const PRESCRIPTOR_DIETA_VERSION: string = dietaConfig.version;

/** Perfil antes de cualquier diagnóstico: banda por defecto, sin diagnosticar
 * (RF-11.4). El Prescriptor puede componer una sesión igual, con esta banda
 * de arranque, hasta que el usuario pase por el diagnóstico. */
export const DEFAULT_PROFILE: Profile = {
  id: 'principal',
  bandaElo: 'elemental',
  diagnosticoCompletadoEn: null,
  planSemanal: DEFAULT_WEEKLY_PLAN,
};

interface DietaBanda {
  curriculumMax: number;
  radarCount: number;
}

const DIETA_POR_BANDA = dietaConfig.bandas as Record<BandaElo, DietaBanda>;

const VENTANA_FUGA_DIAS = 30;
const UMBRAL_FUGA_TACTICA = 0.35;
const BONUS_RADAR_POR_FUGA = 2;

export interface AjusteFugas {
  /** Categoría dominante detectada, o null si no hay fuga clara todavía. */
  categoria: CategoriaError | null;
  /** Proporción de tarjetas de esa categoría sobre el total reciente. */
  proporcion: number;
}

/**
 * Perfil de fugas simplificado (RF-11.2 punto 3, v1): proporción de
 * tarjetas tácticas creadas en los últimos 30 días, contando solo las que
 * vienen de partidas propias (`origen: 'partida'`).
 *
 * Se excluyen a propósito las tarjetas de origen `'radar'`: `categoriaFromTipo`
 * (core/radar.ts) etiqueta como `tactico` cuatro de los cinco tipos del Radar
 * (todo salvo `tranquila`), así que casi cualquier fallo del Radar entra acá
 * como "táctico" por construcción, no porque refleje una fuga real del
 * usuario. Sin este filtro, el propio Radar generaba el bucle "fallo del
 * Radar → cuenta como táctico → dispara la fuga → el Prescriptor refuerza el
 * Radar → más fallos del Radar" — una señal que se retroalimenta a sí misma
 * en vez de medir algo del mundo. Los errores de partida real, en cambio, sí
 * están categorizados por el usuario en un toque (RF-3.3) y reflejan la
 * fuga que RF-11.2 pide detectar.
 */
export function detectarFugaTactica(cards: ErrorCard[], now: Date = new Date()): AjusteFugas {
  const desde = now.getTime() - VENTANA_FUGA_DIAS * 24 * 60 * 60 * 1000;
  const recientes = cards.filter((c) => c.origen === 'partida' && new Date(c.creadaEn).getTime() >= desde);
  if (recientes.length === 0) return { categoria: null, proporcion: 0 };
  const tacticas = recientes.filter((c) => c.categoria === 'tactico').length;
  const proporcion = tacticas / recientes.length;
  return { categoria: proporcion > UMBRAL_FUGA_TACTICA ? 'tactico' : null, proporcion };
}

export interface DietaSesion {
  curriculumMax: number;
  radarCount: number;
  ajusteFugas: AjusteFugas;
  /** RF-9.3/RF-11.2: se suma un bloque de Triage cuando el perfil de tiempo muestra una fuga. */
  triageActivo: boolean;
}

/** Dieta base por banda de Elo (RF-11.2 punto 2) más el ajuste por fugas
 * (punto 3): refuerza el Radar ante fuga táctica y agrega Triage ante fuga
 * de tiempo. Los repasos vencidos de la Cola (punto 1) no tienen tope: eso
 * ya lo resuelve `dueErrorCards`. */
export function dietaPorBanda(banda: BandaElo, cardsRecientes: ErrorCard[], games: GameRecord[] = [], now: Date = new Date()): DietaSesion {
  const base = DIETA_POR_BANDA[banda];
  const ajusteFugas = detectarFugaTactica(cardsRecientes, now);
  const radarCount = ajusteFugas.categoria === 'tactico' ? base.radarCount + BONUS_RADAR_POR_FUGA : base.radarCount;
  const triageActivo = hayFugaDeTiempo(perfilDeTiempo(games));
  return { curriculumMax: base.curriculumMax, radarCount, ajusteFugas, triageActivo };
}

// --- Diagnóstico inicial (RF-11.4) ---

export type ResultadoPartida = 'gano' | 'perdio' | 'tablas';

export interface DiagnosticoResultado {
  juego1: ResultadoPartida;
  juego2: ResultadoPartida;
  radarAciertos: number;
  radarTotal: number;
}

const PUNTOS_PARTIDA: Record<ResultadoPartida, number> = { gano: 1, tablas: 0.5, perdio: 0 };

/**
 * Estima la banda de Elo a partir del diagnóstico inicial (RF-11.4): dos
 * partidas sin reloj contra el motor local en niveles escalonados (fallback de
 * Maia, bloqueada por red — ver docs/roadmap.md) más la tasa de acierto en
 * 20 posiciones del Radar. Heurística v1 simple y documentada, no una
 * calibración estadística — deliberado hasta tener datos reales de uso.
 */
export function estimarBandaElo(r: DiagnosticoResultado): BandaElo {
  const puntosMotor = (PUNTOS_PARTIDA[r.juego1] + PUNTOS_PARTIDA[r.juego2]) / 2; // 0–1
  const tasaRadar = r.radarTotal > 0 ? r.radarAciertos / r.radarTotal : 0; // 0–1
  const score = puntosMotor * 0.5 + tasaRadar * 0.5;
  if (score < 0.2) return 'principiante';
  if (score < 0.4) return 'elemental';
  if (score < 0.6) return 'intermedio';
  if (score < 0.8) return 'avanzado';
  return 'experto';
}
