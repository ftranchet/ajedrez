// Entidades núcleo del dominio (PRD §9). core/ es dominio puro: sin React,
// sin Dexie, sin fetch (CONTRIBUTING regla 4).
import type { FsrsState } from './scheduler';

export type Fuente = 'local' | 'lichess' | 'chesscom' | 'manual';
export type Ritmo = 'bullet' | 'blitz' | 'rapida' | 'clasica' | 'sin-reloj';
export type Resultado = '1-0' | '0-1' | '1/2-1/2' | '*';
export type Color = 'w' | 'b';

export interface GameRecord {
  id: string;
  pgn: string;
  fuente: Fuente;
  ritmo: Ritmo;
  resultado: Resultado;
  /** Milisegundos consumidos por cada media jugada, en orden (RF-1.5). */
  tiemposPorJugadaMs: number[];
  analizada: boolean;
  /** Fecha de la partida en ISO 8601. */
  fecha: string;
  /** Respuestas de la fase 1 del análisis en dos fases (RF-3.1), si ya se completó. */
  fase1?: PhaseOneData;
  /** Resultado de la fase 2 (RF-3.2), corre después de completar la fase 1. */
  analisis?: GameAnalysis;
}

/**
 * Escala de evaluación rápida de una posición (RF-3.1c, design system §5
 * EvalPicker): "quién está mejor y cuánto", cinco valores fijos.
 */
export type EvalSymbol = '+-' | '±' | '=' | '∓' | '-+';

/** Una de las tres evaluaciones que el usuario declara en la fase 1. */
export interface PhaseOneEvaluacion {
  ply: number;
  valorUsuario: EvalSymbol;
}

/** Respuestas de la fase 1 del análisis en dos fases: el motor sigue bloqueado hasta completarlas (RF-3.1). */
export interface PhaseOneData {
  /** Media jugada (0-based) que el usuario marca como el momento crítico de la partida. */
  momentoCriticoPly: number;
  /** Plan del usuario en ese momento, texto corto (RF-3.1b). */
  plan: string;
  evaluaciones: PhaseOneEvaluacion[];
  completadaEn: string; // ISO 8601
}

/** Clasificación de una jugada por pérdida de centipeones (RF-3.2). */
export type MoveClassification = 'grave' | 'error' | 'imprecision' | 'buena';

/** Análisis de una jugada de la partida, producido por el motor en la fase 2. */
export interface MoveAnalysisEntry {
  ply: number;
  san: string;
  fenAntes: string;
  ladoQueMueve: Color;
  /** Jugada realmente jugada, en UCI. */
  jugadaUsuario: string;
  /** Mejor jugada del motor en esa posición, en UCI. */
  jugadaMotor: string;
  /** Evaluación en centipeones, perspectiva blancas, antes/después de la jugada. */
  cpAntes: number;
  cpDespues: number;
  /** Pérdida de centipeones desde la perspectiva de quien movió, siempre ≥0. */
  cpPerdidos: number;
  clasificacion: MoveClassification;
}

/** Comparación de una evaluación declarada por el usuario contra la del motor. */
export interface ComparacionEvaluacion {
  ply: number;
  valorUsuario: EvalSymbol;
  valorMotor: EvalSymbol;
  coincide: boolean;
}

/** Resultado completo de la fase 2 del análisis en dos fases (RF-3.2). */
export interface GameAnalysis {
  jugadas: MoveAnalysisEntry[];
  comparacionEvaluaciones: ComparacionEvaluacion[];
  analizadaEn: string; // ISO 8601
}

/** Categoría de error elegida por el usuario en un toque (RF-3.3, E4). */
export type CategoriaError = 'tactico' | 'posicional' | 'tiempo' | 'psicologico';

/** Origen de una tarjeta de la Cola Universal (RF-4.1). */
export type OrigenTarjeta = 'radar' | 'partida' | 'final' | 'apertura';

/**
 * Tarjeta de la Cola Universal de errores (E4). Cada fallo —de partida,
 * Radar, final o apertura— entra a esta única cola espaciada; sin silos por
 * módulo (CONTRIBUTING, PRD §5.3).
 */
export interface ErrorCard {
  id: string;
  fen: string;
  ladoAMover: Color;
  /** Jugada del usuario en el evento original, en UCI (p. ej. "e7e5"). */
  jugadaUsuario: string;
  /** Jugada correcta, en UCI. */
  jugadaCorrecta: string;
  categoria: CategoriaError;
  origen: OrigenTarjeta;
  fsrs: FsrsState;
  creadaEn: string; // ISO 8601
}

/** Tipos de posición que sirve el Radar, mezclados sin previo aviso (RF-5.1). */
export type TipoRadar = 'ofensiva' | 'defensa' | 'tranquila' | 'genuina' | 'envenenada';

/**
 * Posición servida por el Radar (E5). `solucion` es la secuencia de jugadas
 * UCI que resuelve el problema (para puzzles multi-jugada de Lichess); en
 * posiciones tranquilas suele tener una sola jugada "segura".
 */
export interface RadarItem {
  id: string;
  fen: string;
  tipo: TipoRadar;
  temas: string[];
  /** Rating de dificultad, mismo rango que el rating de puzzles de Lichess. */
  rating: number;
  solucion: string[];
  fuente: 'lichess-cc0' | 'pipeline-tranquilas' | 'seed-dev';
}

/**
 * Estado persistente del selector del Radar. A diferencia del catálogo de
 * posiciones, esto sí es dato del usuario: conserva la dificultad y la tasa
 * de acierto entre sesiones para que RF-5.5 pueda adaptarse de verdad.
 */
export interface RadarProgress {
  id: 'principal';
  historialTipos: TipoRadar[];
  historialIds: string[];
  ratingCentro: number;
  aciertosRecientes: boolean[];
  updatedAt: string; // ISO 8601
}

/** Resultado de una posición del Radar, para medir la banda 60–80% (RF-5.5). */
export interface RadarAttempt {
  id: string;
  itemId: string;
  tipo: TipoRadar;
  rating: number;
  acierto: boolean;
  fecha: string; // ISO 8601
}

/** Versión del catálogo embebido, separada de los datos personales. */
export interface RadarDatasetMeta {
  id: 'catalogo';
  version: string;
  seededAt: string; // ISO 8601
}

/** Contexto en el que se pidió una confianza declarada (RF-10.1). */
export type ContextoCalibracion = 'radar' | 'analisis' | 'stoyko';

/** Registro de calibración del juicio: confianza declarada vs. acierto real. */
export interface CalibrationRecord {
  id: string;
  contexto: ContextoCalibracion;
  confianzaDeclarada: number; // 0–100
  acierto: boolean;
  fecha: string; // ISO 8601
}
