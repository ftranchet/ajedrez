// Diagnóstico inicial (RF-11.4): sin historial, 2 partidas sin reloj contra el
// motor local en niveles escalonados (fallback de Maia, bloqueada por red —
// ver docs/roadmap.md Fase 2/3) más 20 posiciones del Radar. El resultado
// combinado estima la banda de Elo que arranca la dieta del Prescriptor
// (core/prescriptor.ts). Reutiliza `useGameStore` para las partidas (misma
// mecánica probada de la pantalla Jugar) en vez de duplicar el motor de
// turnos.
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { Color, RadarItem } from '../../core/types';
import { RADAR_INITIAL_STATE, categoriaFromTipo, esRespuestaCorrectaRadar, explainFeedback, recordServed, selectNextRadarItem, type RadarSelectionState } from '../../core/radar';
import { estimarBandaElo, type ResultadoPartida } from '../../core/prescriptor';
import { altaErrorCard } from '../../core/errorCard';
import { errorCardRepo } from '../../services/storage/errorCardRepo';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { radarAttemptRepo } from '../../services/storage/radarAttemptRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { useGameStore } from './gameStore';
import { computeDests, sanDeLinea } from './chessBoardUtils';

/** Mismo motivo que sessionStore.ts#sanDeJugada: mostrar SAN, no UCI crudo, en el feedback. */
function sanDeJugada(fen: string, jugadaUci: string): string {
  return sanDeLinea(fen, [jugadaUci])[0] ?? jugadaUci;
}

export const DIAGNOSTICO_JUEGO1_NIVEL = 'nivel-2';
export const DIAGNOSTICO_JUEGO2_NIVEL = 'nivel-4';
export const DIAGNOSTICO_RADAR_TOTAL = 20;

type ActivePhase = 'juego1' | 'juego2' | 'radar';
type Phase = 'inactivo' | ActivePhase | 'pausado' | 'resultado';
type RadarSubPhase = 'jugando' | 'feedback';
type RadarLoadStatus = 'inactivo' | 'cargando' | 'listo' | 'error';
type ResultSaveStatus = 'inactivo' | 'guardando' | 'error';

interface DiagnosticoState {
  phase: Phase;
  /** Etapa conservada al pausar. El diagnóstico se reanuda en memoria sin
   * resetear ni el tablero compartido ni la posición actual del Radar. */
  pausedPhase: ActivePhase | null;
  resultadoJuego1: ResultadoPartida | null;
  resultadoJuego2: ResultadoPartida | null;

  radarPool: RadarItem[];
  radarLoadStatus: RadarLoadStatus;
  /** Persistencia de la banda final: el último paso también debe poder recuperarse. */
  resultSaveStatus: ResultSaveStatus;
  radarSelState: RadarSelectionState;
  radarItem: RadarItem | null;
  radarSubPhase: RadarSubPhase;
  radarServidos: number;
  radarAciertos: number;
  radarUltimoAcierto: boolean | null;
  radarFeedbackTexto: string;
  radarJugadaCorrecta: string | null;

  fen: string;
  turn: Color;
  /** Lado que resuelve, fijado al cargar: el tablero no gira tras la jugada (ver sessionStore). */
  boardOrientation: Color;
  dests: Map<string, string[]>;
  lastMove: [string, string] | null;
  check: boolean;

  bandaEstimada: ReturnType<typeof estimarBandaElo> | null;

  empezarJuego1(): Promise<void>;
  registrarResultadoJuego(): Promise<void>;
  reintentarJuego(): Promise<void>;
  reintentarRadar(): Promise<void>;
  radarUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  radarContinuar(): Promise<void>;
  pausar(): void;
  reanudar(): void;
  volver(): void;
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

function resultadoDeGameStore(): ResultadoPartida {
  const g = useGameStore.getState();
  if (g.resultado === '1/2-1/2') return 'tablas';
  const usuarioGano = (g.resultado === '1-0' && g.playerColor === 'w') || (g.resultado === '0-1' && g.playerColor === 'b');
  return usuarioGano ? 'gano' : 'perdio';
}

export const useDiagnosticoStore = create<DiagnosticoState>((set, get) => {
  function loadRadarItem(item: RadarItem | null) {
    if (!item) {
      // Llegar sin ítem antes de las 20 respuestas es un fallo recuperable
      // del catálogo, no un diagnóstico válido con respuestas inventadas.
      set({ radarItem: null, radarLoadStatus: 'error' });
      return;
    }
    chess = new Chess(item.fen);
    set({ radarItem: item, radarLoadStatus: 'listo', radarSubPhase: 'jugando', radarUltimoAcierto: null, radarFeedbackTexto: '', radarJugadaCorrecta: null, ...boardSnapshot(), boardOrientation: chess.turn() as Color, lastMove: null });
  }

  async function prepararRadar() {
    set({ radarItem: null, radarLoadStatus: 'cargando' });
    try {
      await radarItemRepo.ensureSeeded();
      // Sin ítems de doble solución (RF-5.7) en el diagnóstico: acá la
      // jugada "familiar" contaría como fallo y generaría una tarjeta de
      // error, contradiciendo la regla de que la familiar también es
      // acierto. Esa lógica vive en la sesión (sessionStore), no acá.
      const pool = (await radarItemRepo.list()).filter((item) => !item.dobleSolucion);
      if (pool.length === 0) {
        set({ radarPool: [], radarLoadStatus: 'error' });
        return;
      }
      set({ radarPool: pool });
      const item = selectNextRadarItem(pool, get().radarSelState, Math.random);
      loadRadarItem(item);
    } catch {
      set({ radarItem: null, radarLoadStatus: 'error' });
    }
  }

  async function finalizarConResultado() {
    if (get().resultSaveStatus === 'guardando') return;
    const s = get();
    const banda = estimarBandaElo({
      juego1: s.resultadoJuego1 ?? 'perdio',
      juego2: s.resultadoJuego2 ?? 'perdio',
      radarAciertos: s.radarAciertos,
      radarTotal: DIAGNOSTICO_RADAR_TOTAL,
    });
    set({ resultSaveStatus: 'guardando' });
    try {
      // Se preserva el resto del perfil (p. ej. la fecha del último Stoyko):
      // pisarlo con un objeto nuevo borraría datos ajenos al diagnóstico.
      const actual = await profileRepo.get();
      await profileRepo.save({ ...actual, bandaElo: banda, diagnosticoCompletadoEn: new Date().toISOString() });
      set({
        phase: 'resultado',
        pausedPhase: null,
        bandaEstimada: banda,
        radarItem: null,
        radarLoadStatus: 'inactivo',
        resultSaveStatus: 'inactivo',
      });
    } catch {
      set({ resultSaveStatus: 'error' });
    }
  }

  return {
    phase: 'inactivo',
    pausedPhase: null,
    resultadoJuego1: null,
    resultadoJuego2: null,

    radarPool: [],
    radarLoadStatus: 'inactivo',
    resultSaveStatus: 'inactivo',
    radarSelState: RADAR_INITIAL_STATE,
    radarItem: null,
    radarSubPhase: 'jugando',
    radarServidos: 0,
    radarAciertos: 0,
    radarUltimoAcierto: null,
    radarFeedbackTexto: '',
    radarJugadaCorrecta: null,

    fen: chess.fen(),
    turn: 'w',
    boardOrientation: 'w',
    dests: new Map(),
    lastMove: null,
    check: false,

    bandaEstimada: null,

    async empezarJuego1() {
      // useGameStore es compartido con la pantalla Jugar (RF-1.3): resetearlo
      // acá tira sin aviso cualquier partida en curso que haya quedado
      // abierta en esa pestaña (el store zustand sigue vivo aunque
      // JugarScreen esté desmontada). HoyScreen ya deshabilita este botón
      // mientras `useGameStore().phase === 'playing'`; esta comprobación es
      // el cinturón de seguridad del lado del store, no solo de la UI.
      if (useGameStore.getState().phase === 'playing' || useGameStore.getState().phase === 'loading') return;
      set({
        phase: 'juego1',
        pausedPhase: null,
        resultadoJuego1: null,
        resultadoJuego2: null,
        radarPool: [],
        radarLoadStatus: 'inactivo',
        resultSaveStatus: 'inactivo',
        radarItem: null,
        radarServidos: 0,
        radarAciertos: 0,
        radarSelState: RADAR_INITIAL_STATE,
        bandaEstimada: null,
      });
      useGameStore.getState().reset();
      await useGameStore.getState().start(DIAGNOSTICO_JUEGO1_NIVEL, 'random');
    },

    async registrarResultadoJuego() {
      const s = get();
      if (s.phase !== 'juego1' && s.phase !== 'juego2') return;
      // El efecto que observa `gameStore.phase` puede volver a ejecutarse al
      // remontar la pantalla. Solo una partida realmente terminada debe
      // avanzar la etapa; después del primer registro reset() ya la deja en
      // setup y esta guarda vuelve idempotente esa transición.
      if (useGameStore.getState().phase !== 'ended') return;
      const resultado = resultadoDeGameStore();
      if (s.phase === 'juego1') {
        set({ resultadoJuego1: resultado, phase: 'juego2' });
        useGameStore.getState().reset();
        await useGameStore.getState().start(DIAGNOSTICO_JUEGO2_NIVEL, 'random');
        return;
      }
      set({ resultadoJuego2: resultado, phase: 'radar', radarLoadStatus: 'cargando', radarItem: null });
      useGameStore.getState().reset();
      await prepararRadar();
    },

    async reintentarJuego() {
      const s = get();
      const activePhase = s.phase === 'pausado' ? s.pausedPhase : s.phase;
      if (activePhase !== 'juego1' && activePhase !== 'juego2') return;
      const level = activePhase === 'juego1' ? DIAGNOSTICO_JUEGO1_NIVEL : DIAGNOSTICO_JUEGO2_NIVEL;
      const game = useGameStore.getState();
      // start() reinicia la etapa. Si el motor ya había elegido un color
      // antes de fallar, se conserva para que el reintento no cambie las
      // condiciones del diagnóstico.
      const color = game.levelId === level ? game.playerColor : 'random';
      useGameStore.getState().reset();
      await useGameStore.getState().start(level, color);
    },

    async reintentarRadar() {
      const s = get();
      const activePhase = s.phase === 'pausado' ? s.pausedPhase : s.phase;
      if (activePhase !== 'radar' || s.radarLoadStatus === 'cargando') return;
      await prepararRadar();
    },

    async radarUserMove(from, to, promotion) {
      const s = get();
      if (s.phase !== 'radar' || s.radarSubPhase !== 'jugando' || !s.radarItem) return;
      const candidate = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
      if (!candidate) {
        set(boardSnapshot());
        return;
      }
      // Promoción a dama por defecto (mismo criterio que sessionStore):
      // chess.js tira si la jugada corona y falta la pieza.
      const promo = promotion ?? (candidate.promotion ? 'q' : undefined);
      const jugadaUsuario = from + to + (promo ?? '');
      const item = s.radarItem;
      const acierto = esRespuestaCorrectaRadar(item, jugadaUsuario);
      chess.move({ from, to, promotion: promo });

      set({
        ...boardSnapshot(),
        lastMove: [from, to],
        radarUltimoAcierto: acierto,
        radarJugadaCorrecta: sanDeJugada(item.fen, item.solucion[0]),
        radarFeedbackTexto: explainFeedback(item, acierto),
        radarSubPhase: 'feedback',
        radarServidos: s.radarServidos + 1,
        radarAciertos: s.radarAciertos + (acierto ? 1 : 0),
      });

      await radarAttemptRepo.save({ id: crypto.randomUUID(), itemId: item.id, tipo: item.tipo, rating: item.rating, acierto, fecha: new Date().toISOString() });
      if (!acierto) {
        // Dedup + tope diario (RF-4.1/4.5), igual que en la sesión.
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
    },

    async radarContinuar() {
      const s = get();
      if (s.radarServidos >= DIAGNOSTICO_RADAR_TOTAL) {
        await finalizarConResultado();
        return;
      }
      const nextSelState = s.radarItem ? recordServed(s.radarSelState, s.radarItem) : s.radarSelState;
      set({ radarSelState: nextSelState });
      const item = selectNextRadarItem(s.radarPool, nextSelState, Math.random);
      loadRadarItem(item);
    },

    pausar() {
      const phase = get().phase;
      if (phase !== 'juego1' && phase !== 'juego2' && phase !== 'radar') return;
      if ((phase === 'juego1' || phase === 'juego2') && (useGameStore.getState().phase === 'loading' || useGameStore.getState().thinking)) return;
      if (get().resultSaveStatus === 'guardando') return;
      set({ phase: 'pausado', pausedPhase: phase });
    },

    reanudar() {
      const s = get();
      if (s.phase !== 'pausado' || !s.pausedPhase) return;
      set({ phase: s.pausedPhase, pausedPhase: null });
    },

    volver() {
      chess = new Chess();
      set({ phase: 'inactivo', pausedPhase: null, radarItem: null, radarLoadStatus: 'inactivo', resultSaveStatus: 'inactivo' });
    },
  };
});
