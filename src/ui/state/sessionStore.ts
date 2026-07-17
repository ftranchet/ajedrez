// Sesión simple de Fase 1 (roadmap): Cola vencida primero, después el
// Radar (RF-4.4, RF-11.2 simplificado — el Prescriptor completo llega en
// Fase 3). Orquesta E4 (Cola Universal + FSRS), E5 (Radar) y E10
// (calibración muestreada).
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { CalibrationRecord, Color, ErrorCard, RadarItem } from '../../core/types';
import { dueErrorCards, reviewErrorCard } from '../../core/errorCard';
import {
  RADAR_INITIAL_STATE,
  adjustDifficulty,
  categoriaFromTipo,
  explainFeedback,
  recordServed,
  selectNextRadarItem,
  type RadarSelectionState,
} from '../../core/radar';
import { shouldSampleConfidence } from '../../core/calibration';
import { buildErrorCard } from '../../core/errorCard';
import { errorCardRepo } from '../../services/storage/errorCardRepo';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { computeDests } from './chessBoardUtils';

/** Cuántas posiciones sirve el bloque del Radar por sesión. Placeholder de
 * Fase 1: sin Prescriptor todavía no hay composición por duración real
 * (Fase 3, RF-11.2); un conteo fijo aproxima la sesión mínima de 15 min. */
export const RADAR_SESSION_SIZE = 8;
/** Ventana para la tasa de acierto reciente que ajusta la dificultad (RF-5.5). */
const VENTANA_TASA_ACIERTO = 8;

export type EvalGuess = 'blancas' | 'igual' | 'negras';
type Phase = 'sinEmpezar' | 'cargando' | 'cola' | 'radar' | 'fin';
type ColaSubPhase = 'jugando' | 'feedback';
type RadarSubPhase = 'evaluando' | 'jugando' | 'confianza' | 'feedback';

interface SessionState {
  phase: Phase;
  /** Repasos vencidos, para mostrar en Hoy antes de arrancar. null = sin cargar todavía. */
  dueCount: number | null;

  // Cola (E4)
  colaCards: ErrorCard[];
  colaIndex: number;
  colaSubPhase: ColaSubPhase;
  colaUltimoAcierto: boolean | null;
  colaJugadaCorrecta: string | null;

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

  // Tablero compartido entre Cola y Radar
  fen: string;
  turn: Color;
  dests: Map<string, string[]>;
  lastMove: [string, string] | null;
  check: boolean;

  loadSummary(): Promise<void>;
  start(): Promise<void>;
  volver(): void;

  colaUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  colaContinuar(): void;

  radarEval(guess: EvalGuess): void;
  radarUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  radarConfirmarConfianza(valor: number): Promise<void>;
  radarContinuar(): Promise<void>;
}

let chess = new Chess();

function boardSnapshot() {
  return {
    fen: chess.fen(),
    turn: chess.turn() as Color,
    dests: computeDests(chess),
    check: chess.inCheck(),
  };
}

function tasaAciertoReciente(historial: boolean[]): number {
  const ventana = historial.slice(-VENTANA_TASA_ACIERTO);
  if (ventana.length === 0) return 0.7; // neutral hasta tener datos
  return ventana.filter(Boolean).length / ventana.length;
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
      ...boardSnapshot(),
      lastMove: null,
    });
  }

  function loadColaCard(card: ErrorCard | null) {
    if (!card) {
      // Cola terminada: pasar al Radar.
      void beginRadar();
      return;
    }
    chess = new Chess(card.fen);
    set({
      colaSubPhase: 'jugando',
      colaUltimoAcierto: null,
      colaJugadaCorrecta: null,
      ...boardSnapshot(),
      lastMove: null,
    });
  }

  async function beginRadar() {
    const pool = get().radarPool;
    const selState = RADAR_INITIAL_STATE;
    const item = selectNextRadarItem(pool, selState, Math.random);
    set({ phase: 'radar', radarSelState: item ? recordServed(selState, item) : selState });
    loadRadarItem(item);
  }

  return {
    phase: 'sinEmpezar',
    dueCount: null,
    colaCards: [],
    colaIndex: 0,
    colaSubPhase: 'jugando',
    colaUltimoAcierto: null,
    colaJugadaCorrecta: null,

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

    fen: chess.fen(),
    turn: 'w',
    dests: new Map(),
    lastMove: null,
    check: false,

    async loadSummary() {
      const allCards = await errorCardRepo.list();
      set({ dueCount: dueErrorCards(allCards).length });
    },

    async start() {
      set({ phase: 'cargando' });
      await radarItemRepo.ensureSeeded();
      const [allCards, pool] = await Promise.all([errorCardRepo.list(), radarItemRepo.list()]);
      const due = dueErrorCards(allCards);
      set({ radarPool: pool, colaCards: due, colaIndex: 0, dueCount: due.length });
      if (due.length > 0) {
        set({ phase: 'cola' });
        loadColaCard(due[0]);
      } else {
        await beginRadar();
      }
    },

    volver() {
      chess = new Chess();
      set({
        phase: 'sinEmpezar',
        colaCards: [],
        colaIndex: 0,
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
      const jugadaUsuario = from + to + (promotion ?? '');
      const card = s.colaCards[s.colaIndex];
      const acierto = jugadaUsuario === card.jugadaCorrecta;
      chess.move({ from, to, promotion });

      const revisada = reviewErrorCard(card, acierto);
      await errorCardRepo.save(revisada);
      const nuevasCards = [...s.colaCards];
      nuevasCards[s.colaIndex] = revisada;

      set({
        colaCards: nuevasCards,
        colaSubPhase: 'feedback',
        colaUltimoAcierto: acierto,
        colaJugadaCorrecta: card.jugadaCorrecta,
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
      const jugadaUsuario = from + to + (promotion ?? '');
      const item = s.radarItem;
      const acierto = jugadaUsuario === item.solucion[0];
      chess.move({ from, to, promotion });

      const pedirConfianza = shouldSampleConfidence();
      set({
        ...boardSnapshot(),
        lastMove: [from, to],
        radarUltimoAcierto: acierto,
        radarJugadaCorrecta: item.solucion[0],
        radarJugadaUsuario: jugadaUsuario,
        radarFeedbackTexto: explainFeedback(item, acierto),
        radarPedirConfianza: pedirConfianza,
        radarSubPhase: pedirConfianza ? 'confianza' : 'feedback',
      });

      if (!pedirConfianza) await finalizeRadarAnswer(item, acierto, jugadaUsuario);
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
      if (servidos >= RADAR_SESSION_SIZE) {
        set({ phase: 'fin', radarItem: null });
        return;
      }
      const item = selectNextRadarItem(s.radarPool, selState, Math.random);
      set({ radarSelState: item ? recordServed(selState, item) : selState });
      loadRadarItem(item);
    },
  };

  async function finalizeRadarAnswer(item: RadarItem, acierto: boolean, jugadaUsuario: string) {
    set((s) => ({
      radarServidos: s.radarServidos + 1,
      radarAciertosRecientes: [...s.radarAciertosRecientes, acierto].slice(-VENTANA_TASA_ACIERTO),
    }));
    if (!acierto) {
      const card = buildErrorCard({
        fen: item.fen,
        ladoAMover: item.fen.split(' ')[1] === 'b' ? 'b' : 'w',
        jugadaUsuario,
        jugadaCorrecta: item.solucion[0],
        categoria: categoriaFromTipo(item.tipo),
        origen: 'radar',
      });
      await errorCardRepo.save(card);
    }
  }
});
