// Análisis en dos fases (E3): lógica pura de clasificación de jugadas,
// escala de evaluación y selección de posiciones para la fase 1. La
// orquestación con el motor real vive en services/analysis (CONTRIBUTING
// regla 4: core/ no llama al motor ni a Dexie).
import type {
  Color,
  ComparacionEvaluacion,
  EvalSymbol,
  GameAnalysis,
  MoveAnalysisEntry,
  MoveClassification,
  PhaseOneData,
} from './types';

// Umbrales de clasificación por pérdida de centipeones (RF-3.2), en línea
// con las convenciones habituales de análisis post-partida.
const UMBRAL_GRAVE = 200;
const UMBRAL_ERROR = 100;
const UMBRAL_IMPRECISION = 50;

export function classifyMoveLoss(cpPerdidos: number): MoveClassification {
  if (cpPerdidos >= UMBRAL_GRAVE) return 'grave';
  if (cpPerdidos >= UMBRAL_ERROR) return 'error';
  if (cpPerdidos >= UMBRAL_IMPRECISION) return 'imprecision';
  return 'buena';
}

// Umbrales de la escala de 5 valores (RF-3.1c), en centipeones y perspectiva blancas.
const UMBRAL_CLARO = 150;
const UMBRAL_LEVE = 50;

/** Convierte una evaluación en centipeones (perspectiva blancas) a la escala +−/±/=/∓/−+. */
export function evalToSymbol(cpBlancas: number): EvalSymbol {
  if (cpBlancas >= UMBRAL_CLARO) return '+-';
  if (cpBlancas >= UMBRAL_LEVE) return '±';
  if (cpBlancas > -UMBRAL_LEVE) return '=';
  if (cpBlancas > -UMBRAL_CLARO) return '∓';
  return '-+';
}

/**
 * Pérdida de centipeones desde la perspectiva de quien movió. `cpAntes` y
 * `cpDespues` están siempre en perspectiva blancas; para negras, empeorar
 * significa que el valor sube (mejor para blancas), por eso se invierte.
 */
export function computeCpLoss(cpAntes: number, cpDespues: number, ladoQueMueve: Color): number {
  const antes = ladoQueMueve === 'w' ? cpAntes : -cpAntes;
  const despues = ladoQueMueve === 'w' ? cpDespues : -cpDespues;
  return Math.max(0, antes - despues);
}

/**
 * Reparte `count` posiciones a lo largo de la partida para la fase 1 (RF-3.1c),
 * sin consultar al motor (el motor sigue bloqueado hasta terminar la fase 1):
 * evita apertura y desenlace cuando la partida es lo bastante larga.
 */
export function pickPhaseOnePositions(totalPlies: number, count = 3): number[] {
  if (totalPlies <= 0) return [];
  if (totalPlies <= count) return Array.from({ length: totalPlies }, (_, i) => i);

  const start = Math.min(Math.floor(totalPlies * 0.15), totalPlies - count);
  const end = Math.max(Math.ceil(totalPlies * 0.85), start + count - 1);
  const span = Math.max(1, Math.min(end, totalPlies - 1) - start);
  const positions = Array.from({ length: count }, (_, i) => start + Math.round((span * i) / (count - 1)));
  // Únicas y ordenadas (el redondeo puede repetir en partidas cortas).
  return [...new Set(positions)].sort((a, b) => a - b);
}

export function esMomentoCriticoValido(ply: number, totalPlies: number): boolean {
  return Number.isInteger(ply) && ply >= 0 && ply < totalPlies;
}

export interface EngineEvalAtPly {
  ply: number;
  fen: string;
  san: string;
  ladoQueMueve: Color;
  /** Jugada realmente jugada en la partida, en UCI. */
  jugadaUsuario: string;
  /** Evaluación de esta posición (antes de jugar), perspectiva blancas. */
  cpAntes: number;
  /** Mejor jugada del motor en esta posición, en UCI. */
  jugadaMotor: string;
}

/**
 * Arma el resultado completo de la fase 2 a partir de las evaluaciones del
 * motor por jugada (una por posición, incluida la posición final) y las
 * respuestas de la fase 1. `evals` debe tener longitud `jugadas.length + 1`
 * (una evaluación "antes" por jugada, más la posición final).
 */
export function buildGameAnalysis(evals: EngineEvalAtPly[], fase1: PhaseOneData, now: Date = new Date()): GameAnalysis {
  const jugadas: MoveAnalysisEntry[] = [];
  for (let i = 0; i < evals.length - 1; i++) {
    const actual = evals[i];
    const siguiente = evals[i + 1];
    const cpPerdidos = computeCpLoss(actual.cpAntes, siguiente.cpAntes, actual.ladoQueMueve);
    jugadas.push({
      ply: actual.ply,
      san: actual.san,
      fenAntes: actual.fen,
      ladoQueMueve: actual.ladoQueMueve,
      jugadaUsuario: actual.jugadaUsuario,
      jugadaMotor: actual.jugadaMotor,
      cpAntes: actual.cpAntes,
      cpDespues: siguiente.cpAntes,
      cpPerdidos,
      clasificacion: classifyMoveLoss(cpPerdidos),
    });
  }

  const cpPorPly = new Map(evals.map((e) => [e.ply, e.cpAntes]));
  const comparacionEvaluaciones: ComparacionEvaluacion[] = fase1.evaluaciones.map((ev) => {
    const cp = cpPorPly.get(ev.ply) ?? 0;
    const valorMotor = evalToSymbol(cp);
    return { ply: ev.ply, valorUsuario: ev.valorUsuario, valorMotor, coincide: ev.valorUsuario === valorMotor };
  });

  return { jugadas, comparacionEvaluaciones, analizadaEn: now.toISOString() };
}

/**
 * Jugadas que ameritan una tarjeta candidata para la Cola (RF-3.3). Con
 * `jugadorColor` conocido, solo las del usuario: una tarjeta de error es
 * "tu error para repasar" (E4), y las jugadas malas del motor (que en niveles
 * bajos las comete a propósito, RF-1.3) no son errores del usuario. Sin color
 * (partidas importadas que todavía no registran el lado), se devuelven todas
 * y el usuario confirma o descarta cada una a mano (RF-3.3).
 */
export function detectedErrorMoves(analysis: GameAnalysis, jugadorColor?: Color): MoveAnalysisEntry[] {
  return analysis.jugadas.filter(
    (m) => (m.clasificacion === 'grave' || m.clasificacion === 'error') && (jugadorColor === undefined || m.ladoQueMueve === jugadorColor),
  );
}
