// Sesión del día (RF-4.4, RF-11.1/11.2): Cola vencida → currículo vencido →
// Radar, con la dieta del Radar y el tope del currículo compuestos por el
// Prescriptor (E11) según la banda de Elo del perfil y el ajuste por fugas.
// Orquesta E4 (Cola Universal + FSRS), E6 (currículo), E5 (Radar) y E10
// (calibración muestreada).
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { CalibrationRecord, Color, CurriculumItem, CurriculumProgress, ErrorCard, EvalGuess, Profile, RadarItem, RadarProgress } from '../../core/types';
import { dueErrorCards, reviewErrorCard } from '../../core/errorCard';
import {
  RADAR_INITIAL_STATE,
  adjustDifficulty,
  categoriaFromTipo,
  esRespuestaCorrectaRadar,
  explainFeedback,
  recordServed,
  selectNextRadarItem,
  type RadarSelectionState,
} from '../../core/radar';
import { dueCurriculumItems, interleaveByPattern, newCurriculumProgress, reviewCurriculumProgress } from '../../core/curriculum';
import { DEFAULT_PROFILE, dietaPorBanda, type DietaSesion } from '../../core/prescriptor';
import { decisionCorrecta, type DecisionTriage } from '../../core/triage';
import { shouldSampleConfidence } from '../../core/calibration';
import { clasificarCambioCandidata, shouldSampleCandidata } from '../../core/candidatas';
import { clasificarRespuestaDobleSolucion, feedbackConformismo } from '../../core/dobleSolucion';
import { altaErrorCard } from '../../core/errorCard';
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
import { gameRepo } from '../../services/storage/gameRepo';
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
type ColaSubPhase = 'jugando' | 'feedback';
type CurriculumSubPhase = 'jugando' | 'feedback';
type TriageSubPhase = 'decidiendo' | 'feedback';
type RadarSubPhase = 'evaluando' | 'jugando' | 'candidata' | 'confianza' | 'feedback';

interface SessionState {
  phase: Phase;
  /** Repasos vencidos, para mostrar en Hoy antes de arrancar. null = sin cargar todavía. */
  dueCount: number | null;
  /** Patrones del currículo vencidos hoy, antes de topar por la dieta. Para el resumen de "Tu sesión de hoy" (RF-11.1). */
  curriculumDueCount: number | null;

  // Prescriptor (E11): perfil y dieta de la sesión en curso (RF-11.2).
  profile: Profile;
  dieta: DietaSesion;

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

  // Triage de reloj (E9): bloque agregado solo si la dieta detecta una fuga
  // de tiempo (RF-9.2/9.3), entre el currículo y el Radar.
  triageQueue: RadarItem[];
  triageIndex: number;
  triageSubPhase: TriageSubPhase;
  triageUltimaCorrecta: boolean | null;
  triageDecisionCorrecta: DecisionTriage | null;

  // Radar (E5)
  radarPool: RadarItem[];
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

  loadSummary(): Promise<void>;
  start(): Promise<void>;
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
/** Marca de tiempo al servir el ítem de Triage, para la latencia de la decisión (RF-9.2). */
let triageInicioMs = 0;

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
    ratingCentro: progress.ratingCentro,
  };
}

function progressFromState(selection: RadarSelectionState, aciertosRecientes: boolean[]): RadarProgress {
  return {
    id: RADAR_PROGRESS_ID,
    historialTipos: selection.historialTipos,
    historialIds: selection.historialIds,
    ratingCentro: selection.ratingCentro,
    aciertosRecientes,
    updatedAt: new Date().toISOString(),
  };
}

export const useSessionStore = create<SessionState>((set, get) => {
  function loadRadarItem(item: RadarItem | null) {
    if (!item) {
      set({ phase: 'fin', radarItem: null });
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
      radarJugadaUsuario: null,
      radarCandidataActiva: shouldSampleCandidata(),
      radarCandidataJugadaOriginal: null,
      ...loadSnapshot(),
      lastMove: null,
    });
  }

  function loadColaCard(card: ErrorCard | null) {
    if (!card) {
      // Cola terminada: pasar al currículo (RF-11.2: repasos vencidos primero).
      void beginCurriculum();
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
      void beginTriage();
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
      void beginRadar();
      return;
    }
    chess = new Chess(item.fen);
    triageInicioMs = Date.now(); // para la latencia de la decisión (RF-9.2)
    set({
      triageSubPhase: 'decidiendo',
      triageUltimaCorrecta: null,
      triageDecisionCorrecta: null,
      ...loadSnapshot(),
      lastMove: null,
    });
  }

  // Mismo patrón sincrónico que `beginCurriculum`: si la dieta no activó
  // Triage (o no hay pool todavía), devuelve la promesa de `beginRadar()`
  // en vez de dispararla sin esperar.
  function beginTriage(): Promise<void> | void {
    const s = get();
    if (!s.dieta.triageActivo || s.radarPool.length === 0) {
      return beginRadar();
    }
    // Fisher-Yates parcial: sort(() => random - 0.5) no baraja uniforme.
    const pool = [...s.radarPool];
    for (let i = 0; i < Math.min(TRIAGE_SESSION_SIZE, pool.length); i++) {
      const j = i + Math.floor(Math.random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const queue = pool.slice(0, TRIAGE_SESSION_SIZE);
    set({ phase: 'triage', triageQueue: queue, triageIndex: 0 });
    loadTriageItem(queue[0]);
  }

  // El cambio de fase es sincrónico a propósito (como el arranque de
  // `beginRadar`): el catálogo y el progreso ya están en memoria desde
  // `start()`, así que `set({ phase: 'curriculo', ... })` corre antes de
  // cualquier `await`. Cuando no hay elementos vencidos devuelve la promesa
  // de `beginRadar()` en vez de dispararla sin esperar, para que `start()`
  // pueda esperar la cadena completa (si no, `start()` resolvía antes de que
  // `loadRadarItem` corriera y `radarItem` quedaba null un instante).
  function beginCurriculum(): Promise<void> | void {
    const s = get();
    const due = interleaveByPattern(dueCurriculumItems(s.curriculumItemsAll, s.curriculumProgressById));
    // Interlevar y recién ahí topar preserva la mezcla de patrones dentro
    // del cupo de la dieta (RF-6.1), en vez de topar antes y arriesgar un
    // cupo monotemático.
    const queue = due.slice(0, s.dieta.curriculumMax);
    if (queue.length === 0) {
      return beginTriage();
    }
    set({ phase: 'curriculo', curriculumQueue: queue, curriculumIndex: 0 });
    loadCurriculumItem(queue[0]);
  }

  async function beginRadar() {
    const pool = get().radarPool;
    const selState = get().radarSelState;
    const item = selectNextRadarItem(pool, selState, Math.random);
    const nextSelState = item ? recordServed(selState, item) : selState;
    set({ phase: 'radar', radarSelState: nextSelState });
    await radarProgressRepo.save(progressFromState(nextSelState, get().radarAciertosRecientes));
    loadRadarItem(item);
  }

  return {
    phase: 'sinEmpezar',
    dueCount: null,
    curriculumDueCount: null,
    profile: DEFAULT_PROFILE,
    dieta: dietaPorBanda(DEFAULT_PROFILE.bandaElo, []),
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
    radarJugadaUsuario: null,
    radarCandidataActiva: false,
    radarCandidataJugadaOriginal: null,

    fen: chess.fen(),
    turn: 'w',
    boardOrientation: 'w',
    dests: new Map(),
    lastMove: null,
    check: false,

    async loadSummary() {
      await curriculumItemRepo.ensureSeeded();
      const [allCards, curriculumItems, curriculumProgressList, profile, games] = await Promise.all([
        errorCardRepo.list(),
        curriculumItemRepo.list(),
        curriculumProgressRepo.list(),
        profileRepo.get(),
        gameRepo.list(),
      ]);
      const progressById = new Map(curriculumProgressList.map((p) => [p.id, p] as const));
      set({
        dueCount: dueErrorCards(allCards).length,
        curriculumDueCount: dueCurriculumItems(curriculumItems, progressById).length,
        profile,
        dieta: dietaPorBanda(profile.bandaElo, allCards, games),
      });
    },

    async start() {
      set({ phase: 'cargando' });
      await Promise.all([radarItemRepo.ensureSeeded(), curriculumItemRepo.ensureSeeded()]);
      const [allCards, pool, progress, curriculumItems, curriculumProgressList, profile, games] = await Promise.all([
        errorCardRepo.list(),
        radarItemRepo.list(),
        radarProgressRepo.get(),
        curriculumItemRepo.list(),
        curriculumProgressRepo.list(),
        profileRepo.get(),
        gameRepo.list(),
      ]);
      const due = dueErrorCards(allCards);
      set({
        profile,
        dieta: dietaPorBanda(profile.bandaElo, allCards, games),
        radarPool: pool,
        colaCards: due,
        colaIndex: 0,
        dueCount: due.length,
        radarSelState: selectionFromProgress(progress),
        radarAciertosRecientes: progress?.aciertosRecientes ?? [],
        radarServidos: 0,
        curriculumItemsAll: curriculumItems,
        curriculumProgressById: new Map(curriculumProgressList.map((p) => [p.id, p] as const)),
      });
      if (due.length > 0) {
        set({ phase: 'cola' });
        loadColaCard(due[0]);
      } else {
        await beginCurriculum();
      }
    },

    volver() {
      chess = new Chess();
      set({
        phase: 'sinEmpezar',
        // null para que HoyScreen vuelva a pedirlo: un fallo del Radar o de
        // la Cola durante la sesión puede haber creado tarjetas vencidas de
        // inmediato, y el contador viejo quedaría desactualizado.
        dueCount: null,
        curriculumDueCount: null,
        colaCards: [],
        colaIndex: 0,
        curriculumQueue: [],
        curriculumIndex: 0,
        curriculumProgressById: new Map(),
        triageQueue: [],
        triageIndex: 0,
        radarItem: null,
        radarServidos: 0,
        radarAciertosRecientes: [],
        radarSelState: RADAR_INITIAL_STATE,
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
      const limpia = jugadaUsuario === item.solucion[0];
      chess.move({ from, to, promotion: promo });

      const progresoPrevio = s.curriculumProgressById.get(item.id) ?? newCurriculumProgress(item.id);
      const progresoNuevo = reviewCurriculumProgress(progresoPrevio, limpia);
      await curriculumProgressRepo.save(progresoNuevo);
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
      set({ triageSubPhase: 'feedback', triageUltimaCorrecta: decision === correcta, triageDecisionCorrecta: correcta });
      // Persistir la decisión, si fue correcta y la latencia (RF-9.2/9.3):
      // antes la decisión se evaluaba en memoria y no quedaba registro.
      void triageAttemptRepo.save({
        id: crypto.randomUUID(),
        itemId: item.id,
        tipo: item.tipo,
        decisionUsuario: decision,
        decisionCorrecta: correcta,
        correcta: decision === correcta,
        tiempoMs: Date.now() - triageInicioMs,
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
      const selState = adjustDifficulty(s.radarSelState, s.radarUltimoAcierto ?? false, tasaAciertoReciente(s.radarAciertosRecientes));
      const servidos = s.radarServidos;
      if (servidos >= s.dieta.radarCount) {
        // El ajuste de dificultad de esta última respuesta también se
        // persiste, aunque la sesión termine acá: si no, la banda 60–80%
        // (RF-5.5) pierde el incremento de la última posición de cada sesión.
        set({ phase: 'fin', radarItem: null, radarSelState: selState });
        await radarProgressRepo.save(progressFromState(selState, get().radarAciertosRecientes));
        return;
      }
      const item = selectNextRadarItem(s.radarPool, selState, Math.random);
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
    set((s) => ({
      radarServidos: s.radarServidos + 1,
      radarAciertosRecientes: [...s.radarAciertosRecientes, acierto].slice(-VENTANA_TASA_ACIERTO),
    }));
    const state = get();
    await radarProgressRepo.save(progressFromState(state.radarSelState, state.radarAciertosRecientes));
    await radarAttemptRepo.save({
      id: crypto.randomUUID(),
      itemId: item.id,
      tipo: item.tipo,
      rating: item.rating,
      acierto,
      evalGuess,
      fecha: new Date().toISOString(),
    });
    if (!acierto) {
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
      radarJugadaUsuario: jugadaUsuario,
      radarFeedbackTexto: resultadoDS === 'familiar' ? feedbackConformismo(item) : explainFeedback(item, acierto),
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
