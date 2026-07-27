// Sesión del día (RF-4.4, RF-11.1/11.2): Cola vencida → currículo vencido →
// Radar, con la dieta del Radar y el tope del currículo compuestos por el
// Prescriptor (E11) según la banda de Elo del perfil y el ajuste por fugas.
// Orquesta E4 (Cola Universal + FSRS), E6 (currículo), E5 (Radar) y E10
// (calibración muestreada).
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { CalibrationRecord, Color, CurriculumItem, CurriculumProgress, DailyAssignment, ErrorCard, EvalGuess, Profile, RadarItem, RadarProgress, SessionBlockType, SessionRecord } from '../../core/types';
import { dueErrorCards, reviewErrorCard } from '../../core/errorCard';
import {
  RADAR_INITIAL_STATE,
  adjustDifficulty,
  categoriaFromTipo,
  dificultadNormalizada,
  esRespuestaCorrectaRadar,
  explainFeedback,
  explainOwnErrorFeedback,
  isOwnErrorRadarItem,
  ownErrorRadarItems,
  recordServed,
  scheduleOwnErrorRadarSlots,
  selectNextRadarItem,
  type RadarSelectionState,
} from '../../core/radar';
import { lineaParaMostrar } from '../../core/radarExplicacion';
import { dueCurriculumItems, esDemostracionLimpia, interleaveByPattern, newCurriculumProgress, reviewCurriculumProgress } from '../../core/curriculum';
import { DEFAULT_PROFILE, detectarFugaCalculo, dietaPorBanda, type DietaSesion } from '../../core/prescriptor';
import { prescripcionesExternas, type PrescripcionExterna } from '../../core/prescripcionesExternas';
import { gameRepo } from '../../services/storage/gameRepo';
import { compromisoAttemptRepo } from '../../services/storage/compromisoAttemptRepo';
import { decisionCorrecta, type DecisionTriage } from '../../core/triage';
import { shouldSampleConfidence } from '../../core/calibration';
import { clasificarCambioCandidata, shouldSampleCandidata } from '../../core/candidatas';
import { clasificarRespuestaDobleSolucion, feedbackConformismo } from '../../core/dobleSolucion';
import { abandonSessionRecord, completeSessionRecord, recordSessionItem, startSessionRecord, transitionSessionBlock } from '../../core/session';
import {
  bloqueAsignado,
  buildDailyAssignment,
  cantidadRestante,
  completarBloqueAsignado,
  dailyAssignmentId,
  idsRestantes,
  registrarItemAsignado,
  sincronizarColaConVencidas,
} from '../../core/dailyAssignment';
import { altaErrorCard } from '../../core/errorCard';
import { dailyAssignmentRepo } from '../../services/storage/dailyAssignmentRepo';
import { errorCardRepo } from '../../services/storage/errorCardRepo';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { radarAttemptRepo } from '../../services/storage/radarAttemptRepo';
import { triageAttemptRepo } from '../../services/storage/triageAttemptRepo';
import { candidataAttemptRepo } from '../../services/storage/candidataAttemptRepo';
import { dobleSolucionAttemptRepo } from '../../services/storage/dobleSolucionAttemptRepo';
import { RADAR_PROGRESS_ID, radarProgressRepo } from '../../services/storage/radarProgressRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { curriculumItemRepo } from '../../services/storage/curriculumItemRepo';
import { curriculumProgressRepo } from '../../services/storage/curriculumProgressRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { sessionRepo } from '../../services/storage/sessionRepo';
import { computeDests, sanDeLinea } from './chessBoardUtils';

/** SAN de una jugada UCI para mostrar en el feedback (design system §5,
 * MoveList: "font-mono" pero notación legible, no UCI crudo); `fen` es la
 * posición antes de la jugada. Cae a UCI si la línea resultara ilegal
 * (no debería pasar: `jugadaUci` sale de `item.solucion`/`card.jugadaCorrecta`,
 * ya verificados por el pipeline o por el motor). */
function sanDeJugada(fen: string, jugadaUci: string): string {
  return sanDeLinea(fen, [jugadaUci])[0] ?? jugadaUci;
}

/** Ventana para la tasa de acierto reciente que ajusta la dificultad (RF-5.5). */
const VENTANA_TASA_ACIERTO = 8;
/** Cuántas posiciones sirve el bloque de Triage cuando la dieta lo activa (RF-9.2/9.3). */
export const TRIAGE_SESSION_SIZE = 5;

export type { EvalGuess };
type Phase = 'sinEmpezar' | 'cargando' | 'cola' | 'curriculo' | 'triage' | 'radar' | 'fin';
type SummaryStatus = 'idle' | 'loading' | 'ready' | 'error';
type ColaSubPhase = 'jugando' | 'feedback';
type CurriculumSubPhase = 'jugando' | 'feedback';
type TriageSubPhase = 'decidiendo' | 'feedback';
type RadarSubPhase = 'evaluando' | 'jugando' | 'candidata' | 'confianza' | 'feedback';

interface SessionState {
  phase: Phase;
  /** Estado explícito de la portada: evita usar `dueCount === null` como loading/error indistinguibles. */
  summaryStatus: SummaryStatus;
  /** El arranque de sesión falló y puede reintentarse sin recargar la app. */
  startError: boolean;
  /** Repasos vencidos, para mostrar en Hoy antes de arrancar. null = sin cargar todavía. */
  dueCount: number | null;
  /** Patrones del currículo vencidos hoy, antes de topar por la dieta. Para el resumen de "Tu sesión de hoy" (RF-11.1). */
  curriculumDueCount: number | null;
  /** Finales teóricos pendientes (RF-6.2), para surgirlos desde Hoy. null = sin cargar todavía. */
  finalesPendientes: number | null;
  /**
   * Prescripciones que se hacen fuera de la sesión (partida lenta, finales,
   * Stoyko, cálculo comprometido). Se calculan acá y no en la pantalla para
   * que Hoy no vuelva a leer IndexedDB por su cuenta en cada visita.
   */
  prescripcionesExternas: PrescripcionExterna[] | null;

  // Prescriptor (E11): perfil y dieta de la sesión en curso (RF-11.2).
  profile: Profile;
  dieta: DietaSesion;
  /**
   * Plan canónico del día (RF-11.1): se arma una vez por día local en
   * `loadSummary` y las sesiones lo consumen. Reanudar sirve lo que falta;
   * un bloque completado no vuelve a aparecer (antes, Patrones → Repaso
   * volvía a servir Patrones porque cada arranque recalculaba todo).
   */
  assignment: DailyAssignment | null;
  /**
   * La corrida actual es práctica libre: el bloque elegido ya estaba
   * completado en el plan (acción "Practicar de nuevo"). No descuenta ni
   * infla el plan del día — el registro de sesión sí la cuenta como proceso.
   */
  practicaLibre: boolean;
  /** Cuántas posiciones sirve el Radar en esta corrida (lo que falta del plan,
   * o la dieta completa en práctica libre). */
  radarObjetivo: number;
  /** Ídem para el bloque de criterio. */
  triageObjetivo: number;
  /** Cuando el usuario elige un bloque suelto (RF-11.5): al terminar ese bloque
   * la sesión termina, en vez de encadenar hacia los siguientes. Null = sesión
   * guiada completa. */
  soloBloque: SessionBlockType | null;
  /** Snapshot persistente de la sesión en curso/completada (RF-12.1). */
  sessionRecord: SessionRecord | null;
  /** Historial necesario para mostrar el plan semanal en Hoy. */
  sessions: SessionRecord[] | null;

  // Cola (E4)
  colaCards: ErrorCard[];
  colaIndex: number;
  colaSubPhase: ColaSubPhase;
  colaUltimoAcierto: boolean | null;
  colaJugadaCorrecta: string | null;

  // Currículo (E6): patrones tácticos vencidos, entre la Cola y el Radar (RF-11.2).
  curriculumItemsAll: CurriculumItem[];
  curriculumQueue: CurriculumItem[];
  curriculumIndex: number;
  curriculumProgressById: Map<string, CurriculumProgress>;
  curriculumSubPhase: CurriculumSubPhase;
  curriculumUltimaLimpia: boolean | null;
  curriculumJugadaCorrecta: string | null;

  // "¿Calcular o ya alcanza?" (E9, RF-9.2): bloque de criterio agregado solo
  // si la dieta detecta una fuga táctica, entre el currículo y el Radar.
  // (El identificador interno sigue siendo `triage` para no migrar registros.)
  triageQueue: RadarItem[];
  triageIndex: number;
  triageSubPhase: TriageSubPhase;
  triageUltimaCorrecta: boolean | null;
  triageDecisionCorrecta: DecisionTriage | null;

  // Radar (E5)
  radarPool: RadarItem[];
  /** Ítems efímeros provenientes de errores de partidas propias (RF-5.9). */
  radarOwnErrorItems: RadarItem[];
  /** Posiciones 0-based sorteadas para intercalarlos sin patrón fijo. */
  radarOwnErrorSlots: number[];
  radarSelState: RadarSelectionState;
  radarItem: RadarItem | null;
  radarSubPhase: RadarSubPhase;
  radarServidos: number;
  radarAciertosRecientes: boolean[];
  radarEvalGuess: EvalGuess | null;
  radarPedirConfianza: boolean;
  radarUltimoAcierto: boolean | null;
  radarFeedbackTexto: string;
  radarJugadaCorrecta: string | null;
  /** Solución completa en SAN (RF-5.3): la primera jugada sola no explica un mate en 3. */
  radarLinea: string | null;
  radarJugadaUsuario: string | null;
  /** Regla de candidatas (RF-5.8): si este ítem fue muestreado para preguntar "¿hay algo mejor?" antes de revelar. */
  radarCandidataActiva: boolean;
  /** Primera jugada del usuario en un ítem muestreado, hasta que decide mantenerla o cambiarla. */
  radarCandidataJugadaOriginal: string | null;

  // Tablero compartido entre Cola y Radar
  fen: string;
  turn: Color;
  /**
   * Lado desde el que se ve el tablero, fijado al cargar la posición (el lado
   * que resuelve). No es `turn`: tras la jugada del usuario `turn` pasa al
   * rival y, si el tablero se orientara por `turn`, giraría 180° justo en el
   * feedback —revelando la solución del revés—. La orientación queda quieta
   * toda la posición.
   */
  boardOrientation: Color;
  dests: Map<string, string[]>;
  lastMove: [string, string] | null;
  check: boolean;

  loadSummary(force?: boolean | 'revalidar'): Promise<void>;
  start(soloBloque?: SessionBlockType): Promise<void>;
  volver(): void;

  colaUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  colaContinuar(): void;

  curriculumUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  curriculumContinuar(): void;

  triageDecidir(decision: DecisionTriage): void;
  triageContinuar(): void;

  radarEval(guess: EvalGuess): void;
  radarUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  radarCandidataDecidir(cambiar: boolean): void;
  radarConfirmarConfianza(valor: number): Promise<void>;
  radarContinuar(): Promise<void>;
}

let chess = new Chess();
/** Serializa snapshots de una misma sesión para que un put viejo no pise uno nuevo. */
let sessionWriteQueue: Promise<void> = Promise.resolve();
/** Ídem para el plan del día: sus puts también deben aplicarse en orden. */
let assignmentWriteQueue: Promise<void> = Promise.resolve();
/** Deduplica el doble montaje de React StrictMode y permite invalidar una carga lenta al reintentar. */
let summaryLoad: { generation: number; promise: Promise<void> } | null = null;
let summaryGeneration = 0;

function boardSnapshot() {
  return {
    fen: chess.fen(),
    turn: chess.turn() as Color,
    dests: computeDests(chess),
    check: chess.inCheck(),
  };
}

/** Snapshot al CARGAR una posición: además fija la orientación al lado que
 * resuelve (el que mueve ahora), para que el tablero no gire tras la jugada. */
function loadSnapshot() {
  return { ...boardSnapshot(), boardOrientation: chess.turn() as Color };
}

function tasaAciertoReciente(historial: boolean[]): number {
  const ventana = historial.slice(-VENTANA_TASA_ACIERTO);
  if (ventana.length === 0) return 0.7; // neutral hasta tener datos
  return ventana.filter(Boolean).length / ventana.length;
}

function selectionFromProgress(progress: RadarProgress | undefined): RadarSelectionState {
  if (!progress) return { ...RADAR_INITIAL_STATE };
  return {
    historialTipos: progress.historialTipos,
    historialIds: progress.historialIds,
    dificultadCentro: progress.dificultadCentro ?? RADAR_INITIAL_STATE.dificultadCentro,
  };
}

function progressFromState(selection: RadarSelectionState, aciertosRecientes: boolean[]): RadarProgress {
  return {
    id: RADAR_PROGRESS_ID,
    historialTipos: selection.historialTipos,
    historialIds: selection.historialIds,
    dificultadCentro: selection.dificultadCentro,
    aciertosRecientes,
    updatedAt: new Date().toISOString(),
  };
}

export const useSessionStore = create<SessionState>((set, get) => {
  function persistSession(record: SessionRecord): Promise<void> {
    // El llamador necesita recibir el fallo de SU escritura, pero la cola
    // compartida no puede quedar rechazada para siempre: si no, cualquier
    // reintento posterior falla antes de tocar IndexedDB.
    const write = sessionWriteQueue
      .catch(() => undefined)
      .then(() => sessionRepo.save(record));
    sessionWriteQueue = write.catch(() => undefined);
    return write;
  }

  function updateTrackedSession(update: (record: SessionRecord) => SessionRecord): void {
    const current = get().sessionRecord;
    if (!current) return;
    const next = update(current);
    set({ sessionRecord: next });
    void persistSession(next);
  }

  function completeTrackedBlock(tipo: SessionBlockType): void {
    updateTrackedSession((record) => {
      const index = record.bloques.findIndex((block) => block.tipo === tipo);
      if (index < 0 || record.bloques[index].estado === 'completado') return record;
      const next = record.bloques[index + 1]?.tipo ?? null;
      return transitionSessionBlock(record, tipo, next);
    });
  }

  function persistAssignment(assignment: DailyAssignment): Promise<void> {
    const write = assignmentWriteQueue
      .catch(() => undefined)
      .then(() => dailyAssignmentRepo.save(assignment));
    assignmentWriteQueue = write.catch(() => undefined);
    return write;
  }

  /** Descuenta un ítem resuelto del plan del día (RF-11.1). En práctica libre
   * no hace nada: el plan ya está cumplido y repetir no lo infla. */
  function updateTrackedAssignment(tipo: SessionBlockType, itemId?: string): void {
    if (get().practicaLibre) return;
    const current = get().assignment;
    if (!current) return;
    const next = registrarItemAsignado(current, tipo, itemId);
    set({ assignment: next });
    void persistAssignment(next);
  }

  /** Cierra un bloque del plan cuando su corrida llegó al final, aunque haya
   * servido menos de lo planificado (un ítem asignado que ya no existe). */
  function completeTrackedAssignmentBlock(tipo: SessionBlockType): void {
    if (get().practicaLibre) return;
    const current = get().assignment;
    if (!current) return;
    const next = completarBloqueAsignado(current, tipo);
    set({ assignment: next });
    void persistAssignment(next);
  }

  async function finishTrackedSession(): Promise<void> {
    const current = get().sessionRecord;
    if (!current || current.estado !== 'en_curso') return;
    const completed = completeSessionRecord(current);
    set({
      sessionRecord: completed,
      sessions: [completed, ...(get().sessions ?? []).filter((record) => record.id !== completed.id)],
    });
    await persistSession(completed);
  }

  // Encadena al siguiente bloque en la sesión guiada; en una sesión de bloque
  // suelto (RF-11.5) termina en vez de seguir. El bloque actual ya se marcó
  // completado antes de llamar acá.
  function avanzarOTerminar(next: () => Promise<void> | void): Promise<void> | void {
    if (get().soloBloque) {
      set({ phase: 'fin', radarItem: null });
      return finishTrackedSession();
    }
    return next();
  }

  function loadRadarItem(item: RadarItem | null) {
    if (!item) {
      // El pool se agotó antes del objetivo: el bloque corrió hasta su final.
      completeTrackedAssignmentBlock('radar');
      set({ phase: 'fin', radarItem: null });
      void finishTrackedSession();
      return;
    }
    chess = new Chess(item.fen);
    set({
      radarItem: item,
      radarSubPhase: 'evaluando',
      radarEvalGuess: null,
      radarUltimoAcierto: null,
      radarFeedbackTexto: '',
      radarJugadaCorrecta: null,
      radarLinea: null,
      radarJugadaUsuario: null,
      radarCandidataActiva: shouldSampleCandidata(),
      radarCandidataJugadaOriginal: null,
      ...loadSnapshot(),
      lastMove: null,
    });
  }

  /** Selecciona catálogo o error propio según el lugar sorteado de RF-5.9.
   * Excluye las posiciones ya servidas en el bloque de criterio de esta misma
   * sesión (comparten el pool del Radar): volver a verlas acá las llegaría
   * quemadas —ya sabés si la posición era táctica o tranquila—. Si al excluirlas
   * el pool queda vacío, se prefiere repetir antes que dejar el bloque sin
   * contenido. */
  function selectRadarItemForCurrentPosition(selectionState: RadarSelectionState): RadarItem | null {
    const s = get();
    const vistasEnCriterio = new Set(s.triageQueue.map((item) => item.id));
    const sinRepetir = (items: RadarItem[]) => {
      const frescos = items.filter((item) => !vistasEnCriterio.has(item.id));
      return frescos.length > 0 ? frescos : items;
    };
    const ownErrorTurn = s.radarOwnErrorSlots.includes(s.radarServidos);
    if (ownErrorTurn) {
      const ownItem = selectNextRadarItem(sinRepetir(s.radarOwnErrorItems), selectionState, Math.random);
      if (ownItem) return ownItem;
    }
    return selectNextRadarItem(sinRepetir(s.radarPool), selectionState, Math.random);
  }

  function loadColaCard(card: ErrorCard | null) {
    if (!card) {
      // Cola terminada: pasar al currículo (RF-11.2: repasos vencidos primero).
      completeTrackedBlock('cola');
      completeTrackedAssignmentBlock('cola');
      void avanzarOTerminar(beginCurriculum);
      return;
    }
    chess = new Chess(card.fen);
    set({
      colaSubPhase: 'jugando',
      colaUltimoAcierto: null,
      colaJugadaCorrecta: null,
      ...loadSnapshot(),
      lastMove: null,
    });
  }

  function loadCurriculumItem(item: CurriculumItem | null) {
    if (!item) {
      // Currículo del día terminado (o sin elementos vencidos): pasar al
      // Triage si la dieta lo activó, si no directo al Radar.
      completeTrackedBlock('curriculo');
      completeTrackedAssignmentBlock('curriculo');
      void avanzarOTerminar(beginTriage);
      return;
    }
    chess = new Chess(item.fen);
    set({
      curriculumSubPhase: 'jugando',
      curriculumUltimaLimpia: null,
      curriculumJugadaCorrecta: null,
      ...loadSnapshot(),
      lastMove: null,
    });
  }

  function loadTriageItem(item: RadarItem | null) {
    if (!item) {
      completeTrackedBlock('triage');
      completeTrackedAssignmentBlock('triage');
      void avanzarOTerminar(beginRadar);
      return;
    }
    chess = new Chess(item.fen);
    set({
      triageSubPhase: 'decidiendo',
      triageUltimaCorrecta: null,
      triageDecisionCorrecta: null,
      ...loadSnapshot(),
      lastMove: null,
    });
  }

  // Mismo patrón sincrónico que `beginCurriculum`: si esta corrida no trae
  // criterio (el plan ya lo tiene completado, o la dieta no lo activó),
  // devuelve la promesa de `beginRadar()` en vez de dispararla sin esperar.
  function beginTriage(): Promise<void> | void {
    const s = get();
    const objetivo = Math.min(s.triageObjetivo, s.radarPool.length);
    if (objetivo <= 0) {
      return avanzarOTerminar(beginRadar);
    }
    // Fisher-Yates parcial: sort(() => random - 0.5) no baraja uniforme.
    const pool = [...s.radarPool];
    for (let i = 0; i < objetivo; i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const queue = pool.slice(0, objetivo);
    set({ phase: 'triage', triageQueue: queue, triageIndex: 0 });
    loadTriageItem(queue[0]);
  }

  // El cambio de fase es sincrónico a propósito (como el arranque de
  // `beginRadar`): la cola de patrones ya está en memoria desde `start()`,
  // así que `set({ phase: 'curriculo', ... })` corre antes de cualquier
  // `await`. Cuando no hay nada que servir devuelve la promesa de
  // `beginTriage()` en vez de dispararla sin esperar, para que `start()`
  // pueda esperar la cadena completa.
  //
  // La cola viene armada por `start()` desde el plan del día (lo que falta,
  // no todo lo vencido): recalcular acá era el fallo Patrones → Repaso →
  // Patrones — cada arranque volvía a servir lo ya hecho.
  function beginCurriculum(): Promise<void> | void {
    const queue = get().curriculumQueue;
    if (queue.length === 0) {
      return avanzarOTerminar(beginTriage);
    }
    set({ phase: 'curriculo', curriculumIndex: 0 });
    loadCurriculumItem(queue[0]);
  }

  async function beginRadar() {
    // Sin objetivo (el plan ya tiene el Radar completado y no es práctica):
    // la corrida termina acá en vez de servir posiciones extra.
    if (get().radarObjetivo <= 0) {
      set({ phase: 'fin', radarItem: null });
      return finishTrackedSession();
    }
    const selState = get().radarSelState;
    const item = selectRadarItemForCurrentPosition(selState);
    const nextSelState = item ? recordServed(selState, item) : selState;
    set({ phase: 'radar', radarSelState: nextSelState });
    await radarProgressRepo.save(progressFromState(nextSelState, get().radarAciertosRecientes));
    loadRadarItem(item);
  }

  return {
    phase: 'sinEmpezar',
    summaryStatus: 'idle',
    startError: false,
    dueCount: null,
    curriculumDueCount: null,
    finalesPendientes: null,
    prescripcionesExternas: null,
    profile: DEFAULT_PROFILE,
    dieta: dietaPorBanda(DEFAULT_PROFILE.bandaElo, []),
    assignment: null,
    practicaLibre: false,
    radarObjetivo: 0,
    triageObjetivo: 0,
    soloBloque: null,
    sessionRecord: null,
    sessions: null,
    colaCards: [],
    colaIndex: 0,
    colaSubPhase: 'jugando',
    colaUltimoAcierto: null,
    colaJugadaCorrecta: null,

    curriculumItemsAll: [],
    curriculumQueue: [],
    curriculumIndex: 0,
    curriculumProgressById: new Map(),
    curriculumSubPhase: 'jugando',
    curriculumUltimaLimpia: null,
    curriculumJugadaCorrecta: null,

    triageQueue: [],
    triageIndex: 0,
    triageSubPhase: 'decidiendo',
    triageUltimaCorrecta: null,
    triageDecisionCorrecta: null,

    radarPool: [],
    radarOwnErrorItems: [],
    radarOwnErrorSlots: [],
    radarSelState: RADAR_INITIAL_STATE,
    radarItem: null,
    radarSubPhase: 'evaluando',
    radarServidos: 0,
    radarAciertosRecientes: [],
    radarEvalGuess: null,
    radarPedirConfianza: false,
    radarUltimoAcierto: null,
    radarFeedbackTexto: '',
    radarJugadaCorrecta: null,
    radarLinea: null,
    radarJugadaUsuario: null,
    radarCandidataActiva: false,
    radarCandidataJugadaOriginal: null,

    fen: chess.fen(),
    turn: 'w',
    boardOrientation: 'w',
    dests: new Map(),
    lastMove: null,
    check: false,

    async loadSummary(force = false) {
      if (summaryLoad && !force) return summaryLoad.promise;

      const generation = ++summaryGeneration;
      // 'revalidar' (HoyScreen al volver de otra pantalla): recarga igual que
      // force, pero deja el resumen viejo visible hasta que llega el fresco —
      // pasar por 'loading' haría parpadear la portada entera en cada cambio
      // de pestaña. El force booleano (salir del diagnóstico) sí muestra el
      // skeleton: ahí "lo viejo" es la invitación al diagnóstico, que ya no
      // corresponde y no debe verse ni un frame.
      if (force !== 'revalidar' || get().summaryStatus !== 'ready') set({ summaryStatus: 'loading' });
      const promise = (async () => {
        try {
          // El primer contacto solo necesita el perfil. No bloquear la
          // bienvenida editorial por sembrar catálogos que todavía no va a
          // usar: el resto se cargará al iniciar o después del diagnóstico.
          const profile = await profileRepo.get();
          if (generation !== summaryGeneration) return;
          if (!profile.diagnosticoCompletadoEn) {
            set({
              profile,
              dieta: dietaPorBanda(profile.bandaElo, []),
              assignment: null,
              dueCount: 0,
              curriculumDueCount: 0,
              finalesPendientes: 0,
              prescripcionesExternas: [],
              sessions: [],
              summaryStatus: 'ready',
            });
            return;
          }

          await Promise.all([curriculumItemRepo.ensureSeeded(), radarItemRepo.ensureSeeded()]);
          const [allCards, curriculumItems, curriculumProgressList, sessions, games, radarItems, radarAttempts, compromisoAttempts] =
            await Promise.all([
              errorCardRepo.list(),
              curriculumItemRepo.list(),
              curriculumProgressRepo.list(),
              sessionRepo.list(),
              gameRepo.list(),
              radarItemRepo.list(),
              radarAttemptRepo.list(),
              compromisoAttemptRepo.list(),
            ]);
          if (generation !== summaryGeneration) return;
          const progressById = new Map(curriculumProgressList.map((p) => [p.id, p] as const));
          const due = dueCurriculumItems(curriculumItems, progressById);
          const finalesPendientes = due.filter((item) => item.tipo === 'final').length;
          const dieta = dietaPorBanda(profile.bandaElo, allCards);

          // Plan del día (RF-11.1): se arma UNA vez por día local, acá — el
          // primer vistazo a Hoy fija qué toca. Las sesiones después solo lo
          // consumen. La única parte viva es la Cola: los repasos que venzan
          // durante el día (un análisis de la tarde) se suman mientras el
          // bloque no esté completado; el resto queda congelado.
          const hoyId = dailyAssignmentId();
          const existente = (await dailyAssignmentRepo.get(hoyId)) ?? null;
          const curriculumDia = interleaveByPattern(due.filter((item) => item.tipo === 'patron'))
            .slice(0, dieta.curriculumMax);
          const base =
            existente ??
            buildDailyAssignment(
              {
                colaIds: dueErrorCards(allCards).map((card) => card.id),
                curriculumIds: curriculumDia.map((item) => item.id),
                triageCount: dieta.criterioActivo ? Math.min(TRIAGE_SESSION_SIZE, radarItems.length) : 0,
                radarCount: radarItems.length > 0 ? dieta.radarCount : 0,
              },
              sessions,
            );
          const assignment = sincronizarColaConVencidas(base, dueErrorCards(allCards).map((card) => card.id));
          if (assignment !== existente) await dailyAssignmentRepo.save(assignment);
          if (generation !== summaryGeneration) return;

          set({
            dueCount: dueErrorCards(allCards).length,
            curriculumDueCount: due.filter((item) => item.tipo === 'patron').length,
            finalesPendientes,
            prescripcionesExternas: prescripcionesExternas({
              games,
              finalesPendientes,
              profile,
              compromisoAttempts,
              fugaCalculo: detectarFugaCalculo(radarAttempts, radarItems),
            }),
            profile,
            dieta,
            assignment,
            sessions,
            summaryStatus: 'ready',
          });
        } catch {
          if (generation === summaryGeneration) set({ summaryStatus: 'error' });
        } finally {
          if (summaryLoad?.generation === generation) summaryLoad = null;
        }
      })();
      summaryLoad = { generation, promise };
      return promise;
    },

    async start(soloBloque) {
      set({ phase: 'cargando', startError: false });
      try {
        await sessionWriteQueue;
        await assignmentWriteQueue;
        await sessionRepo.abandonInProgress();
        await Promise.all([radarItemRepo.ensureSeeded(), curriculumItemRepo.ensureSeeded()]);
        const [allCards, pool, progress, curriculumItems, curriculumProgressList, profile] = await Promise.all([
          errorCardRepo.list(),
          radarItemRepo.list(),
          radarProgressRepo.get(),
          curriculumItemRepo.list(),
          curriculumProgressRepo.list(),
          profileRepo.get(),
        ]);
        const due = dueErrorCards(allCards);
        const dieta = dietaPorBanda(profile.bandaElo, allCards);
        const progressById = new Map(curriculumProgressList.map((p) => [p.id, p] as const));
        // Interlevar y recién ahí topar preserva la mezcla de patrones dentro
        // del cupo de la dieta (RF-6.1), en vez de topar antes y arriesgar un
        // cupo monotemático. Los finales (RF-6.2) viven en Jugar → Finales.
        const curriculumDue = interleaveByPattern(
          dueCurriculumItems(curriculumItems, progressById).filter((item) => item.tipo === 'patron'),
        ).slice(0, dieta.curriculumMax);

        // Plan del día (RF-11.1): loadSummary lo crea al abrir Hoy; si falta
        // (falló esa carga, o el día cambió con la app abierta), se arma acá
        // con los mismos datos. Las sesiones se leen del repo, no del estado
        // en memoria, que puede ser viejo.
        const hoyId = dailyAssignmentId();
        let assignment: DailyAssignment =
          (await dailyAssignmentRepo.get(hoyId)) ??
          buildDailyAssignment(
            {
              colaIds: due.map((card) => card.id),
              curriculumIds: curriculumDue.map((item) => item.id),
              triageCount: dieta.criterioActivo ? Math.min(TRIAGE_SESSION_SIZE, pool.length) : 0,
              radarCount: pool.length > 0 ? dieta.radarCount : 0,
            },
            await sessionRepo.list(),
          );
        // Los repasos vencidos después de armar el plan se suman a la Cola
        // (mientras no esté completada): son el bloque sensible al tiempo.
        assignment = sincronizarColaConVencidas(assignment, due.map((card) => card.id));

        // Práctica libre ("Practicar de nuevo"): el bloque elegido ya no está
        // pendiente en el plan. Se sirve contenido fresco y no descuenta nada.
        const bloqueElegido = soloBloque ? bloqueAsignado(assignment, soloBloque) : null;
        const practicaLibre = soloBloque !== undefined && (bloqueElegido === null || bloqueElegido.estado === 'completado');

        // Las corridas del plan sirven lo que FALTA de cada bloque, no todo lo
        // vencido: reanudar no repite lo ya hecho hoy.
        const cardsById = new Map(allCards.map((card) => [card.id, card] as const));
        const itemsById = new Map(curriculumItems.map((item) => [item.id, item] as const));
        const pendiente = (tipo: SessionBlockType) => {
          const bloque = bloqueAsignado(assignment, tipo);
          return bloque && bloque.estado === 'pendiente' ? bloque : null;
        };
        const colaPendiente = pendiente('cola');
        const curriculoPendiente = pendiente('curriculo');
        const colaCards = practicaLibre
          ? due
          : colaPendiente
            ? idsRestantes(colaPendiente)
                .map((id) => cardsById.get(id))
                .filter((card): card is ErrorCard => card !== undefined)
            : [];
        const curriculumQueue = practicaLibre
          ? curriculumDue
          : curriculoPendiente
            ? idsRestantes(curriculoPendiente)
                .map((id) => itemsById.get(id))
                .filter((item): item is CurriculumItem => item !== undefined)
            : [];
        // Un bloque pendiente cuyos ítems ya no existen (datos borrados) se
        // cierra acá; si no, quedaría pendiente para siempre sirviendo vacío.
        if (!practicaLibre) {
          if (colaPendiente && colaCards.length === 0) assignment = completarBloqueAsignado(assignment, 'cola');
          if (curriculoPendiente && curriculumQueue.length === 0) assignment = completarBloqueAsignado(assignment, 'curriculo');
        }
        await persistAssignment(assignment);

        const triageAsignado = bloqueAsignado(assignment, 'triage');
        const triageObjetivo = practicaLibre
          ? (dieta.criterioActivo ? Math.min(TRIAGE_SESSION_SIZE, pool.length) : 0)
          : triageAsignado
            ? Math.min(cantidadRestante(triageAsignado), pool.length)
            : 0;
        const radarAsignado = bloqueAsignado(assignment, 'radar');
        const radarObjetivo = practicaLibre
          ? (pool.length > 0 ? dieta.radarCount : 0)
          : radarAsignado && pool.length > 0
            ? cantidadRestante(radarAsignado)
            : 0;

        // La Cola vencida conserva prioridad absoluta. Solo las tarjetas de
        // partidas propias que no se sirvieron ahí pueden reaparecer en Radar.
        const ownErrorItems = ownErrorRadarItems(allCards, due.map((card) => card.id));
        const ownErrorSlots = scheduleOwnErrorRadarSlots(radarObjetivo, ownErrorItems.length, Math.random);

        // En una sesión de bloque suelto (RF-11.5) el registro cuenta solo ese
        // bloque; en la guiada, los cuatro. Registra lo que esta corrida va a
        // servir de verdad (lo restante del plan, o lo fresco en práctica).
        const bloquesRecord = [
          { tipo: 'cola' as const, planificados: colaCards.length },
          { tipo: 'curriculo' as const, planificados: curriculumQueue.length },
          { tipo: 'triage' as const, planificados: triageObjetivo },
          { tipo: 'radar' as const, planificados: radarObjetivo },
        ];
        const sessionRecord = startSessionRecord(
          soloBloque ? bloquesRecord.filter((b) => b.tipo === soloBloque) : bloquesRecord,
        );
        await persistSession(sessionRecord);
        set({
          profile,
          dieta,
          assignment,
          practicaLibre,
          radarObjetivo,
          triageObjetivo,
          soloBloque: soloBloque ?? null,
          sessionRecord,
          radarPool: pool,
          radarOwnErrorItems: ownErrorItems,
          radarOwnErrorSlots: ownErrorSlots,
          colaCards,
          colaIndex: 0,
          dueCount: due.length,
          curriculumQueue,
          curriculumIndex: 0,
          radarSelState: selectionFromProgress(progress),
          radarAciertosRecientes: progress?.aciertosRecientes ?? [],
          radarServidos: 0,
          curriculumItemsAll: curriculumItems,
          curriculumProgressById: progressById,
        });
        // Arranque: al bloque elegido (o al primero con contenido en la guiada).
        if (soloBloque === 'radar') {
          await beginRadar();
        } else if (soloBloque === 'triage') {
          await beginTriage();
        } else if (soloBloque === 'curriculo') {
          await beginCurriculum();
        } else if (soloBloque === 'cola') {
          if (colaCards.length > 0) {
            set({ phase: 'cola' });
            loadColaCard(colaCards[0]);
          } else {
            set({ phase: 'fin', radarItem: null });
            await finishTrackedSession();
          }
        } else if (colaCards.length > 0) {
          set({ phase: 'cola' });
          loadColaCard(colaCards[0]);
        } else {
          await beginCurriculum();
        }
      } catch {
        set({ phase: 'sinEmpezar', startError: true });
      }
    },

    volver() {
      const current = get().sessionRecord;
      if (current?.estado === 'en_curso') void persistSession(abandonSessionRecord(current));
      chess = new Chess();
      set({
        phase: 'sinEmpezar',
        soloBloque: null,
        practicaLibre: false,
        radarObjetivo: 0,
        triageObjetivo: 0,
        summaryStatus: 'idle',
        startError: false,
        // null para que HoyScreen vuelva a pedirlo: un fallo del Radar o de
        // la Cola durante la sesión puede haber creado tarjetas vencidas de
        // inmediato, y el contador viejo quedaría desactualizado.
        dueCount: null,
        curriculumDueCount: null,
        finalesPendientes: null,
        prescripcionesExternas: null,
        colaCards: [],
        colaIndex: 0,
        curriculumQueue: [],
        curriculumIndex: 0,
        curriculumProgressById: new Map(),
        triageQueue: [],
        triageIndex: 0,
        radarItem: null,
        radarOwnErrorItems: [],
        radarOwnErrorSlots: [],
        radarServidos: 0,
        radarAciertosRecientes: [],
        radarSelState: RADAR_INITIAL_STATE,
        sessionRecord: null,
      });
    },

    async colaUserMove(from, to, promotion) {
      const s = get();
      if (s.phase !== 'cola' || s.colaSubPhase !== 'jugando') return;
      const candidate = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
      if (!candidate) {
        set(boardSnapshot());
        return;
      }
      // Promoción a dama por defecto (simplificación v1): el tablero de la
      // sesión no tiene selector de pieza y chess.js tira si falta la pieza
      // de promoción — sin esto, coronar rompía el flujo del bloque.
      const promo = promotion ?? (candidate.promotion ? 'q' : undefined);
      const jugadaUsuario = from + to + (promo ?? '');
      const card = s.colaCards[s.colaIndex];
      const acierto = jugadaUsuario === card.jugadaCorrecta;
      chess.move({ from, to, promotion: promo });

      const revisada = reviewErrorCard(card, acierto);
      await errorCardRepo.save(revisada);
      updateTrackedSession((record) => recordSessionItem(record, 'cola'));
      updateTrackedAssignment('cola', card.id);
      const nuevasCards = [...s.colaCards];
      nuevasCards[s.colaIndex] = revisada;

      set({
        colaCards: nuevasCards,
        colaSubPhase: 'feedback',
        colaUltimoAcierto: acierto,
        colaJugadaCorrecta: sanDeJugada(card.fen, card.jugadaCorrecta),
        ...boardSnapshot(),
        lastMove: [from, to],
      });
    },

    colaContinuar() {
      const s = get();
      const nextIndex = s.colaIndex + 1;
      set({ colaIndex: nextIndex });
      loadColaCard(s.colaCards[nextIndex] ?? null);
    },

    async curriculumUserMove(from, to, promotion) {
      const s = get();
      if (s.phase !== 'curriculo' || s.curriculumSubPhase !== 'jugando') return;
      const candidate = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
      if (!candidate) {
        set(boardSnapshot());
        return;
      }
      // Promoción a dama por defecto (mismo criterio que colaUserMove).
      const promo = promotion ?? (candidate.promotion ? 'q' : undefined);
      const jugadaUsuario = from + to + (promo ?? '');
      const item = s.curriculumQueue[s.curriculumIndex];
      const limpia = esDemostracionLimpia(item.fen, jugadaUsuario, item.solucion);
      chess.move({ from, to, promotion: promo });

      const progresoPrevio = s.curriculumProgressById.get(item.id) ?? newCurriculumProgress(item.id);
      const progresoNuevo = reviewCurriculumProgress(progresoPrevio, limpia);
      await curriculumProgressRepo.save(progresoNuevo);
      updateTrackedSession((record) => recordSessionItem(record, 'curriculo'));
      updateTrackedAssignment('curriculo', item.id);
      const nuevoMapa = new Map(s.curriculumProgressById);
      nuevoMapa.set(item.id, progresoNuevo);

      set({
        curriculumProgressById: nuevoMapa,
        curriculumSubPhase: 'feedback',
        curriculumUltimaLimpia: limpia,
        curriculumJugadaCorrecta: sanDeJugada(item.fen, item.solucion[0]),
        ...boardSnapshot(),
        lastMove: [from, to],
      });
    },

    curriculumContinuar() {
      const s = get();
      const nextIndex = s.curriculumIndex + 1;
      set({ curriculumIndex: nextIndex });
      loadCurriculumItem(s.curriculumQueue[nextIndex] ?? null);
    },

    triageDecidir(decision) {
      const s = get();
      if (s.phase !== 'triage' || s.triageSubPhase !== 'decidiendo') return;
      const item = s.triageQueue[s.triageIndex];
      const correcta = decisionCorrecta(item.tipo);
      updateTrackedSession((record) => recordSessionItem(record, 'triage'));
      updateTrackedAssignment('triage');
      set({ triageSubPhase: 'feedback', triageUltimaCorrecta: decision === correcta, triageDecisionCorrecta: correcta });
      // Persistir la decisión y si fue correcta (RF-9.2): antes se evaluaba en
      // memoria y no quedaba registro. No se cronometra: el ejercicio mide
      // criterio, no velocidad.
      void triageAttemptRepo.save({
        id: crypto.randomUUID(),
        itemId: item.id,
        tipo: item.tipo,
        decisionUsuario: decision,
        decisionCorrecta: correcta,
        correcta: decision === correcta,
        fecha: new Date().toISOString(),
      });
    },

    triageContinuar() {
      const s = get();
      const nextIndex = s.triageIndex + 1;
      set({ triageIndex: nextIndex });
      loadTriageItem(s.triageQueue[nextIndex] ?? null);
    },

    radarEval(guess) {
      set({ radarEvalGuess: guess, radarSubPhase: 'jugando' });
    },

    async radarUserMove(from, to, promotion) {
      const s = get();
      if (s.phase !== 'radar' || s.radarSubPhase !== 'jugando' || !s.radarItem) return;
      const candidate = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
      if (!candidate) {
        set(boardSnapshot());
        return;
      }
      // Promoción a dama por defecto (mismo criterio que colaUserMove).
      const promo = promotion ?? (candidate.promotion ? 'q' : undefined);
      const jugadaUsuario = from + to + (promo ?? '');
      const item = s.radarItem;
      chess.move({ from, to, promotion: promo });

      // RF-5.8: en un ítem muestreado, la primera jugada no revela todavía —
      // pregunta "¿hay algo mejor?" antes de resolver.
      if (s.radarCandidataActiva && s.radarCandidataJugadaOriginal === null) {
        set({ ...boardSnapshot(), lastMove: [from, to], radarCandidataJugadaOriginal: jugadaUsuario, radarSubPhase: 'candidata' });
        return;
      }

      // Segunda jugada, tras elegir "cambiar": registra si mejoró o empeoró.
      if (s.radarCandidataActiva && s.radarCandidataJugadaOriginal !== null) {
        void registrarCandidataAttempt(item, s.radarCandidataJugadaOriginal, jugadaUsuario, true);
      }

      await resolverJugadaRadar(item, jugadaUsuario, [from, to]);
    },

    radarCandidataDecidir(cambiar) {
      const s = get();
      if (s.phase !== 'radar' || s.radarSubPhase !== 'candidata' || !s.radarItem || s.radarCandidataJugadaOriginal === null) return;
      if (!cambiar) {
        const jugadaFinal = s.radarCandidataJugadaOriginal;
        void registrarCandidataAttempt(s.radarItem, jugadaFinal, jugadaFinal, false);
        void resolverJugadaRadar(s.radarItem, jugadaFinal, s.lastMove ?? ['', '']);
        return;
      }
      // "Sí, cambiar": deshace la jugada tentativa y deja jugar de nuevo.
      chess.undo();
      set({ ...boardSnapshot(), lastMove: null, radarSubPhase: 'jugando' });
    },

    async radarConfirmarConfianza(valor) {
      const s = get();
      if (!s.radarItem || s.radarUltimoAcierto === null || !s.radarJugadaUsuario) return;
      const record: CalibrationRecord = {
        id: crypto.randomUUID(),
        contexto: 'radar',
        confianzaDeclarada: valor,
        acierto: s.radarUltimoAcierto,
        fecha: new Date().toISOString(),
      };
      await calibrationRepo.save(record);
      set({ radarSubPhase: 'feedback' });
      await finalizeRadarAnswer(s.radarItem, s.radarUltimoAcierto, s.radarJugadaUsuario);
    },

    async radarContinuar() {
      const s = get();
      // Un error propio no tiene rating calibrado contra el catálogo: su
      // resultado no mueve el centro adaptativo de RF-5.5.
      const selState = isOwnErrorRadarItem(s.radarItem)
        ? s.radarSelState
        : adjustDifficulty(s.radarSelState, s.radarUltimoAcierto ?? false, tasaAciertoReciente(s.radarAciertosRecientes));
      const servidos = s.radarServidos;
      if (servidos >= s.radarObjetivo) {
        // El ajuste de dificultad de esta última respuesta también se
        // persiste, aunque la sesión termine acá: si no, la banda 60–80%
        // (RF-5.5) pierde el incremento de la última posición de cada sesión.
        completeTrackedAssignmentBlock('radar');
        set({ phase: 'fin', radarItem: null, radarSelState: selState });
        await radarProgressRepo.save(progressFromState(selState, get().radarAciertosRecientes));
        await finishTrackedSession();
        return;
      }
      // El contador ya fue incrementado al finalizar la respuesta, por lo
      // que apunta al lugar 0-based de la próxima posición.
      const item = selectRadarItemForCurrentPosition(selState);
      const nextSelState = item ? recordServed(selState, item) : selState;
      set({ radarSelState: nextSelState });
      await radarProgressRepo.save(progressFromState(nextSelState, get().radarAciertosRecientes));
      loadRadarItem(item);
    },
  };

  async function finalizeRadarAnswer(item: RadarItem, acierto: boolean, jugadaUsuario: string) {
    // Capturado antes del set() de abajo: loadRadarItem (llamado más tarde,
    // al pasar al siguiente ítem) recién ahí resetea radarEvalGuess a null.
    const evalGuess = get().radarEvalGuess ?? undefined;
    const ownError = isOwnErrorRadarItem(item);
    set((s) => ({
      radarServidos: s.radarServidos + 1,
      // La tasa 60–80% mide solo el catálogo cuya dificultad puede ajustar.
      radarAciertosRecientes: ownError
        ? s.radarAciertosRecientes
        : [...s.radarAciertosRecientes, acierto].slice(-VENTANA_TASA_ACIERTO),
    }));
    updateTrackedSession((record) => recordSessionItem(record, 'radar'));
    updateTrackedAssignment('radar');
    const state = get();
    await radarProgressRepo.save(progressFromState(state.radarSelState, state.radarAciertosRecientes));
    await radarAttemptRepo.save({
      id: crypto.randomUUID(),
      itemId: item.id,
      tipo: item.tipo,
      rating: item.rating,
      dificultadNormalizada: ownError ? undefined : dificultadNormalizada(item, state.radarPool),
      origenContenido: ownError ? 'error-propio' : 'catalogo',
      errorCardId: ownError ? item.errorCardId : undefined,
      acierto,
      evalGuess,
      fecha: new Date().toISOString(),
    });
    if (!acierto && !ownError) {
      // Dedup por identidad + tope diario (RF-4.1/4.5): si ya hay una tarjeta
      // de esta posición se refuerza en vez de duplicar; superado el tope
      // diario de tarjetas nuevas, se omite para no avalanchar la Cola.
      const cards = await errorCardRepo.list();
      const alta = altaErrorCard(cards, {
        fen: item.fen,
        ladoAMover: item.fen.split(' ')[1] === 'b' ? 'b' : 'w',
        jugadaUsuario,
        jugadaCorrecta: item.solucion[0],
        categoria: categoriaFromTipo(item.tipo),
        origen: 'radar',
      });
      if (alta.accion !== 'omitir') await errorCardRepo.save(alta.card);
    }
  }

  /** Resuelve la jugada final del usuario en el Radar: única salida, la use
   * `radarUserMove` directo o `radarCandidataDecidir` tras "¿hay algo mejor?" (RF-5.8). */
  async function resolverJugadaRadar(item: RadarItem, jugadaUsuario: string, lastMove: [string, string]) {
    // Doble solución (RF-5.7): conformarse con la familiar también cuenta
    // como acierto (la jugada funciona, no genera tarjeta de error) pero se
    // registra aparte para medir la tasa de conformismo.
    const resultadoDS = item.dobleSolucion ? clasificarRespuestaDobleSolucion(item, jugadaUsuario) : null;
    const acierto = resultadoDS ? resultadoDS !== 'otra' : esRespuestaCorrectaRadar(item, jugadaUsuario);
    if (resultadoDS) {
      void dobleSolucionAttemptRepo.save({ id: crypto.randomUUID(), itemId: item.id, resultado: resultadoDS, fecha: new Date().toISOString() });
    }
    const pedirConfianza = shouldSampleConfidence();
    set({
      ...boardSnapshot(),
      lastMove,
      radarUltimoAcierto: acierto,
      radarJugadaCorrecta: sanDeJugada(item.fen, item.solucion[0]),
      radarLinea: lineaParaMostrar(item),
      radarJugadaUsuario: jugadaUsuario,
      radarFeedbackTexto: isOwnErrorRadarItem(item)
        ? explainOwnErrorFeedback(acierto)
        : resultadoDS === 'familiar'
          ? feedbackConformismo(item)
          : explainFeedback(item, acierto),
      radarPedirConfianza: pedirConfianza,
      radarSubPhase: pedirConfianza ? 'confianza' : 'feedback',
    });
    if (!pedirConfianza) await finalizeRadarAnswer(item, acierto, jugadaUsuario);
  }

  async function registrarCandidataAttempt(item: RadarItem, jugadaOriginal: string, jugadaFinal: string, cambio: boolean) {
    const resultado = clasificarCambioCandidata(item, jugadaOriginal, jugadaFinal);
    await candidataAttemptRepo.save({ id: crypto.randomUUID(), itemId: item.id, cambio, resultado, fecha: new Date().toISOString() });
  }
});
