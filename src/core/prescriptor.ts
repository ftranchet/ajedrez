// Prescriptor (E11): compone "Tu sesión de hoy" en el orden de RF-11.2 —
// (1) repasos vencidos de la Cola, ya resueltos por core/errorCard.ts;
// (2) dieta base por banda de Elo, tabla versionada en config/ (RF-11.6),
// no hardcodeada; (3) ajuste por fugas del último mes: cuando dominan los
// errores tácticos de partidas reales, refuerza el Radar y suma el bloque
// "¿Calcular o ya alcanza?" (E9), que entrena a reconocer cuándo una
// posición pide detenerse a calcular. (Antes ese bloque se disparaba con un
// "perfil de tiempo" medido con un cronómetro invisible; se quitó por
// incoherente con el juego sin reloj.)
import type { BandaElo, CategoriaError, ErrorCard, Profile, RadarAttempt, RadarItem } from './types';
import { DEFAULT_WEEKLY_PLAN } from './adherence';
import { DEFAULT_SENSORY_PREFERENCES } from './sensory';
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
  preferenciasSensoriales: DEFAULT_SENSORY_PREFERENCES,
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

/** Plies mínimos de solución para que una posición exija calcular una línea, no ver una jugada. */
const PLIES_LINEA_FORZADA = 3;
const VENTANA_FUGA_CALCULO_DIAS = 30;
const MIN_INTENTOS_FUGA_CALCULO = 6;
const UMBRAL_FUGA_CALCULO = 0.4;

export interface AjusteFugaCalculo {
  /** Hay señal suficiente para prescribir Cálculo comprometido. */
  activa: boolean;
  fallos: number;
  total: number;
}

/**
 * Fuga de cálculo profundo (E7, RF-7.1): con qué frecuencia se falla en
 * posiciones cuya solución **es una línea forzada** de 3 plies o más, y no una
 * jugada suelta.
 *
 * Existe porque Cálculo comprometido vivía en una pestaña que el Prescriptor
 * nunca mencionaba: el ejercicio de mayor exigencia de la app dependía de que
 * el usuario lo descubriera solo, en un producto cuyo primer principio es
 * "prescripción, no buffet". Ahora se dispara con la misma lógica que el resto
 * de la dieta: una señal observable en los datos del usuario, explicable en una
 * línea.
 *
 * Se miran solo respuestas de catálogo (no errores propios ni diagnóstico, que
 * no tienen dificultad comparable) y solo la ventana reciente: una fuga vieja
 * ya corregida no debe seguir prescribiendo.
 */
export function detectarFugaCalculo(
  attempts: RadarAttempt[],
  pool: RadarItem[],
  now: Date = new Date(),
): AjusteFugaCalculo {
  const lineasForzadas = new Set(
    pool.filter((item) => item.solucion.length >= PLIES_LINEA_FORZADA).map((item) => item.id),
  );
  const desde = now.getTime() - VENTANA_FUGA_CALCULO_DIAS * 24 * 60 * 60 * 1000;
  const relevantes = attempts.filter((attempt) => {
    if (attempt.origenContenido === 'error-propio' || attempt.origenContenido === 'diagnostico') return false;
    if (!lineasForzadas.has(attempt.itemId)) return false;
    const t = new Date(attempt.fecha).getTime();
    return Number.isFinite(t) && t >= desde && t <= now.getTime();
  });
  const fallos = relevantes.filter((attempt) => !attempt.acierto).length;
  const total = relevantes.length;
  return {
    activa: total >= MIN_INTENTOS_FUGA_CALCULO && fallos / total > UMBRAL_FUGA_CALCULO,
    fallos,
    total,
  };
}

export interface DietaSesion {
  curriculumMax: number;
  radarCount: number;
  ajusteFugas: AjusteFugas;
  /** RF-9.2/RF-11.2: se suma el bloque "¿Calcular o ya alcanza?" ante fuga táctica. */
  criterioActivo: boolean;
}

/** Dieta base por banda de Elo (RF-11.2 punto 2) más el ajuste por fugas
 * (punto 3): ante fuga táctica de partidas reales refuerza el Radar y agrega
 * el bloque de criterio "¿Calcular o ya alcanza?" —si tus errores son sobre
 * todo tácticos, conviene entrenar a reconocer cuándo hay que calcular—. Los
 * repasos vencidos de la Cola (punto 1) no tienen tope: eso ya lo resuelve
 * `dueErrorCards`. */
export function dietaPorBanda(banda: BandaElo, cardsRecientes: ErrorCard[], now: Date = new Date()): DietaSesion {
  const base = DIETA_POR_BANDA[banda];
  const ajusteFugas = detectarFugaTactica(cardsRecientes, now);
  const fugaTactica = ajusteFugas.categoria === 'tactico';
  const radarCount = fugaTactica ? base.radarCount + BONUS_RADAR_POR_FUGA : base.radarCount;
  return { curriculumMax: base.curriculumMax, radarCount, ajusteFugas, criterioActivo: fugaTactica };
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
