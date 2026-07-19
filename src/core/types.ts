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
  /**
   * Lado que jugó el usuario, cuando se conoce (partidas locales contra el
   * motor, RF-1.3). Sin esto no se puede separar "sus" tiempos por jugada de
   * los del motor para el perfil de gestión de tiempo (E9, RF-9.1); las
   * partidas importadas o previas a este campo simplemente no entran en ese
   * perfil.
   */
  jugadorColor?: Color;
  /** Elo del usuario al jugar esta partida, si el PGN o el usuario lo aporta. */
  ratingUsuario?: number;
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
  /** Rating crudo de la fuente; no se compara entre fuentes (ADR-0007). */
  rating: number;
  solucion: string[];
  fuente: 'lichess-cc0' | 'pipeline-tranquilas' | 'pipeline-doble-solucion' | 'pipeline-envenenada' | 'seed-dev' | 'error-propio';
  /**
   * Referencia a la tarjeta que originó una posición reciclada por RF-5.9.
   * Estos ítems son efímeros: nunca se guardan en el catálogo del Radar.
   */
  errorCardId?: string;
  /**
   * Jugadas UCI adicionales que también cuentan como acierto (RF-5.3). Solo
   * en posiciones tranquilas: la definición de "tranquila" es que no hay un
   * golpe único (las mejores jugadas están dentro de una tolerancia de
   * centipeones), así que exigir la primera jugada exacta marcaría como fallo
   * una segunda jugada prácticamente equivalente. El motor las verifica en el
   * pipeline (MultiPV). Vacío/ausente en el resto de los tipos, donde sí hay
   * una única jugada correcta.
   */
  jugadasAceptables?: string[];
  /**
   * Subtipo anti-Einstellung (RF-5.7): además de la jugada superior (ya en
   * `solucion[0]`), una jugada "familiar" verificada por el motor (MultiPV)
   * que también gana con claridad pero es objetivamente peor. Ambas cuentan
   * como acierto; el sistema registra por separado si el usuario se
   * conformó con la familiar en vez de encontrar la superior.
   */
  dobleSolucion?: { familiar: string };
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
  /** Centro adaptativo 0–100 sobre percentiles por fuente (ADR-0007). */
  dificultadCentro?: number;
  /** @deprecated Escala heterogénea anterior a ADR-0007; solo compatibilidad de importación. */
  ratingCentro?: number;
  aciertosRecientes: boolean[];
  updatedAt: string; // ISO 8601
}

/**
 * Evaluación rápida que el usuario declara antes de jugar (RF-5.2, design
 * system §4.2 paso 1): "¿cómo está la posición?", el paso previo a producir
 * la jugada. `EvalPicker` en la UI muestra estas tres opciones.
 */
export type EvalGuess = 'blancas' | 'igual' | 'negras';

/** Resultado de una posición del Radar, para medir la banda 60–80% (RF-5.5). */
export interface RadarAttempt {
  id: string;
  itemId: string;
  tipo: TipoRadar;
  rating: number;
  /** Percentil 0–100 usado al servir el ítem (ADR-0007). Ausente en intentos históricos. */
  dificultadNormalizada?: number;
  /** Separa el catálogo calibrado de los errores propios reciclados (RF-5.9). */
  origenContenido?: 'catalogo' | 'error-propio';
  /** Tarjeta fuente cuando `origenContenido` es `error-propio`. */
  errorCardId?: string;
  acierto: boolean;
  /**
   * Evaluación rápida declarada antes de jugar (RF-5.2). Se persiste tal
   * cual, sin juzgarla correcta o incorrecta: el catálogo no guarda un
   * "quién está mejor" verificado por el motor para los cinco tipos del
   * Radar (a diferencia de la jugada solución, que sí lo está), así que
   * inventar ese puntaje sería afirmar algo que no se puede probar (PRD
   * §11, última fila de riesgos). Queda como dato de calibración disponible
   * para cuando ese ground truth exista. Ausente en intentos anteriores a
   * este campo.
   */
  evalGuess?: EvalGuess;
  fecha: string; // ISO 8601
}

/**
 * Resultado de una respuesta sobre un ítem de doble solución (RF-5.7,
 * subtipo anti-Einstellung del Radar): si el usuario encontró la jugada
 * superior, se conformó con la familiar (también gana, pero es peor), o
 * jugó otra cosa (fallo genuino, igual que cualquier otro ítem del Radar).
 */
export type ResultadoDobleSolucion = 'superior' | 'familiar' | 'otra';

/** Registro de una respuesta sobre un ítem de doble solución, para medir la tasa de conformismo (RF-5.7). */
export interface DobleSolucionAttempt {
  id: string;
  itemId: string;
  resultado: ResultadoDobleSolucion;
  fecha: string; // ISO 8601
}

/**
 * Registro de un intento de Cálculo comprometido (E7, RF-7.1): la línea
 * completa se declaró antes de mover en el tablero, y se puntúa entera, no
 * solo la primera jugada.
 */
export interface CompromisoAttempt {
  id: string;
  itemId: string;
  /** Cantidad de plies de la línea pedida (RF-7.1: 3 a 7). */
  profundidad: number;
  correcta: boolean;
  /** Índice (0-based) de la primera jugada que no coincidió; null si toda la línea fue correcta. */
  primerErrorEn: number | null;
  /**
   * Milisegundos desde que se sirvió la posición hasta declarar la línea
   * completa, registrados en silencio (RF-7.3: sin cronómetro visible,
   * el objetivo es profundidad, no velocidad). Ausente en intentos previos
   * a esta métrica.
   */
  tiempoMs?: number;
  fecha: string; // ISO 8601
}

/**
 * Registro de la regla de candidatas (RF-5.8): tras responder, en un
 * subconjunto aleatorio de posiciones se pregunta "¿hay algo mejor?" antes
 * de revelar. `cambio` indica si el usuario reemplazó su jugada original;
 * `resultado` si ese cambio (o la falta de él) mejoró, empeoró o no alteró
 * el acierto.
 */
export interface CandidataAttempt {
  id: string;
  itemId: string;
  cambio: boolean;
  resultado: 'mejoro' | 'empeoro' | 'sin-cambio';
  fecha: string; // ISO 8601
}

/** Versión del catálogo embebido, separada de los datos personales. */
export interface RadarDatasetMeta {
  id: 'catalogo';
  version: string;
  seededAt: string; // ISO 8601
}

/** Tipo de contenido del currículo base (E6). */
export type CurriculumTipo = 'patron' | 'final';

/**
 * Patrón o final concreto dentro de su tipo. Determina cómo se interleava
 * (RF-6.1: "el sistema nunca sirve bloques monotemáticos") y, para finales,
 * qué técnica se está demostrando.
 */
export type PatternKey =
  | 'mate-pasillo'
  | 'mate-escalera'
  | 'mate-dama-rey'
  | 'mate-coz'
  | 'clavada'
  | 'horquilla'
  | 'descubierta'
  | 'rayos-x'
  | 'final-rey-peon'
  | 'final-lucena'
  | 'final-philidor'
  | 'final-cuadrado';

/**
 * Elemento del catálogo del currículo base (E6): un patrón táctico/mate para
 * resolver en el tablero (RF-6.1) o un final elemental para jugar contra el
 * motor hasta demostrar la técnica (RF-6.2). Es catálogo reseedable, no dato
 * personal — el progreso vive aparte en `CurriculumProgress`.
 */
export interface CurriculumItem {
  id: string;
  tipo: CurriculumTipo;
  patternKey: PatternKey;
  nombre: string;
  fen: string;
  /** Jugadas UCI que resuelven el ejercicio, recuperación activa (RF-6.1). Vacío en finales. */
  solucion: string[];
  /** Solo en finales: qué debe forzar el usuario jugando el lado indicado por `fen` (RF-6.2). */
  resultadoEsperado?: 'gana' | 'tablas';
  /** Solo en finales: bando que demuestra la técnica; puede no ser quien mueve primero. */
  ladoUsuario?: Color;
}

/** Versión del catálogo de currículo embebido (mismo patrón que `RadarDatasetMeta`). */
export interface CurriculumDatasetMeta {
  id: 'catalogo';
  version: string;
  seededAt: string; // ISO 8601
}

/**
 * Progreso del usuario en un `CurriculumItem` (RF-6.3): estado FSRS propio
 * más el contador de demostraciones limpias consecutivas que determina la
 * automatización (3 demostraciones espaciadas sin error). Es dato personal,
 * separado del catálogo para que una actualización de contenido no pise el
 * progreso ya hecho.
 */
export interface CurriculumProgress {
  id: string; // = CurriculumItem.id
  fsrs: FsrsState;
  demostracionesLimpias: number;
  updatedAt: string; // ISO 8601
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

/** Bloques que puede prescribir y medir la sesión diaria (RF-11.1/12.1). */
export type SessionBlockType = 'cola' | 'curriculo' | 'triage' | 'radar';
export type SessionBlockStatus = 'pendiente' | 'en_curso' | 'completado' | 'salteado';

export interface SessionBlockRecord {
  tipo: SessionBlockType;
  planificados: number;
  completados: number;
  estado: SessionBlockStatus;
  inicio?: string; // ISO 8601
  fin?: string; // ISO 8601
}

/**
 * Sesión prescrita persistente (RF-11.1, RF-12.1, RF-13.1). Registra proceso,
 * no resultado: bloques e ítems hechos y tiempo real, sin premiar volumen.
 */
export interface SessionRecord {
  id: string;
  fechaInicio: string; // ISO 8601
  fechaFin?: string; // ISO 8601
  estado: 'en_curso' | 'completada' | 'abandonada';
  bloques: SessionBlockRecord[];
  duracionMs?: number;
}

/**
 * Banda de Elo estimada por el diagnóstico inicial (RF-11.4). Coincide con
 * los 5 niveles del motor local (config/engine-levels.json) para poder
 * fundamentar la dieta del Prescriptor (RF-11.2) sin inventar una escala
 * paralela.
 */
export type BandaElo = 'principiante' | 'elemental' | 'intermedio' | 'avanzado' | 'experto';

/**
 * Perfil del usuario (E11): banda de Elo y estado del diagnóstico inicial
 * que la produjo. `diagnosticoCompletadoEn` en null significa que la banda
 * es el valor por defecto, todavía sin diagnóstico real (RF-11.4).
 */
export interface Profile {
  id: 'principal';
  bandaElo: BandaElo;
  diagnosticoCompletadoEn: string | null; // ISO 8601, o null si no se hizo
  /**
   * Fecha de la última vez que se completó el ejercicio de Stoyko (E7,
   * RF-7.2), para el enfriamiento semanal. `undefined`/`null` = nunca hecho,
   * disponible de entrada.
   */
  stoykoUltimaCompletadaEn?: string | null; // ISO 8601
}

/**
 * Posición "rica" para el ejercicio de Stoyko semanal (E7, RF-7.2): varias
 * jugadas genuinamente competitivas, sin ganador claro (a diferencia del
 * Radar, donde siempre hay una jugada objetivamente mejor). No es dato del
 * usuario: catálogo reseedable, igual que `RadarItem`/`CurriculumItem`.
 */
export interface StoykoItem {
  id: string;
  fen: string;
  /**
   * Primeras jugadas (UCI) de la variante principal del motor a profundidad
   * de reconfirmación, para comparar al revelar. No es "la" solución —
   * Stoyko no puntúa una única jugada correcta, sino si el usuario la
   * consideró entre sus candidatas.
   */
  mejorLinea: string[];
  /** Evaluación del motor en la escala +−/±/=/∓/−+, perspectiva blancas. */
  evaluacionMotor: EvalSymbol;
  fuente: 'pipeline-stoyko' | 'seed-dev';
}

/** Versión del catálogo de Stoyko embebido (mismo patrón que `RadarDatasetMeta`). */
export interface StoykoDatasetMeta {
  id: 'catalogo';
  version: string;
  seededAt: string; // ISO 8601
}

/**
 * Registro completo de un ejercicio de Stoyko (E7, RF-7.2/7.3). Antes solo se
 * guardaba el acierto en `calibrationRecords`; acá queda el intento entero —
 * las candidatas que el usuario anotó con su evaluación, el tiempo que le
 * llevó (RF-7.3, cronómetro silencioso) y su confianza declarada— para poder
 * auditarlo y, a futuro, medir la calidad/cobertura de las candidatas.
 */
export interface StoykoAttempt {
  id: string;
  itemId: string;
  /** Jugadas candidatas que el usuario consideró, cada una con su evaluación. */
  candidatas: { jugada: string; evaluacion: EvalSymbol }[];
  acierto: boolean;
  confianzaDeclarada: number; // 0–100
  /** Milisegundos desde que se sirvió la posición hasta declarar (RF-7.3, nunca visible). */
  tiempoMs: number;
  fecha: string; // ISO 8601
}

/**
 * Registro de un ejercicio de Triage de reloj (E9, RF-9.2/9.3): la decisión
 * rápida "¿pide cálculo o alcanza?", si fue correcta, y cuánto tardó en
 * decidir (la latencia es justamente lo que Triage entrena). Antes la decisión
 * se evaluaba en memoria y no se persistía nada.
 */
export interface TriageAttempt {
  id: string;
  itemId: string;
  tipo: TipoRadar;
  decisionUsuario: 'calcular' | 'alcanza';
  decisionCorrecta: 'calcular' | 'alcanza';
  correcta: boolean;
  /** Milisegundos desde que se sirvió la posición hasta decidir. */
  tiempoMs: number;
  fecha: string; // ISO 8601
}

/**
 * Posición del instrumento de transferencia (RF-12.2). Es contenido de
 * evaluación, no de entrenamiento: ningún flujo puede revelar la solución,
 * crear una tarjeta con ella ni incorporarla al Radar/currículo.
 */
export interface TransferItem {
  id: string;
  fen: string;
  acceptedMoves: string[];
  source: 'pipeline-transfer';
  verificationDepth: number;
}

/** Una respuesta de una toma, registrada sin feedback por posición. */
export interface TransferResponse {
  itemId: string;
  move: string;
  correct: boolean;
  tiempoMs: number;
  fecha: string; // ISO 8601
}

/**
 * Una toma completa (o reanudable) de la batería fija de 30 posiciones.
 * `datasetVersion` hace comparables únicamente tomas del mismo instrumento.
 */
export interface TransferMeasurement {
  id: string;
  datasetVersion: string;
  startedAt: string; // ISO 8601
  completedAt: string | null; // ISO 8601; null mientras está en curso
  responses: TransferResponse[];
}
