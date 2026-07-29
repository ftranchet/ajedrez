// Diagnóstico inicial (RF-11.4): sin historial, 2 partidas sin reloj contra el
// motor local en niveles escalonados (fallback de Maia, bloqueada por red —
// ver docs/roadmap.md Fase 2/3) más 20 posiciones del Radar. El resultado
// combinado estima la banda de Elo que arranca la dieta del Prescriptor
// (core/prescriptor.ts). Reutiliza `useGameStore` para las partidas (misma
// mecánica probada de la pantalla Jugar) en vez de duplicar el motor de
// turnos.
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { CalibrationRecord, Color, EvalGuess, PerfilDeFugas, PlanSemanal, RadarAttempt, RadarItem, RatingExterno } from '../../core/types';
import { RADAR_INITIAL_STATE, categoriaFromTipo, centroInicialDesdeDiagnostico, esRespuestaCorrectaRadar, explainFeedback, recordServed, selectNextRadarItem, type RadarSelectionState } from '../../core/radar';
import { lineaParaMostrar } from '../../core/radarExplicacion';
import { revisionDelError, type RevisionDelError } from '../../core/revision';
import { perfilDeFugasDesdeIntentos } from '../../core/leakProfile';
import { brierScore } from '../../core/calibration';
import { isValidWeeklyPlan } from '../../core/adherence';
import { estimarBandaElo, type ResultadoPartida } from '../../core/prescriptor';
import { altaErrorCard } from '../../core/errorCard';
import { errorCardRepo } from '../../services/storage/errorCardRepo';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { radarAttemptRepo } from '../../services/storage/radarAttemptRepo';
import { RADAR_PROGRESS_ID, radarProgressRepo } from '../../services/storage/radarProgressRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { useGameStore } from './gameStore';
import { computeDests, sanDeJugada } from './chessBoardUtils';

export const DIAGNOSTICO_JUEGO1_NIVEL = 'nivel-2';
export const DIAGNOSTICO_JUEGO2_NIVEL = 'nivel-4';
export const DIAGNOSTICO_RADAR_TOTAL = 20;

/**
 * Posiciones (1-based) en las que el diagnóstico pide confianza declarada
 * (RF-10.1). En la sesión el muestreo es aleatorio (~1 de cada 4,5) para no
 * volverlo predecible; acá es fijo a propósito: el diagnóstico tiene que dejar
 * la **misma** cantidad de observaciones para todo el mundo, porque su Brier
 * es la línea base contra la que se va a comparar todo después. Un muestreo
 * aleatorio produciría líneas base de 2 a 8 puntos según la suerte.
 */
export const DIAGNOSTICO_POSICIONES_CONFIANZA = [3, 7, 11, 15, 19];

type ActivePhase = 'juego1' | 'juego2' | 'radar';
type Phase = 'inactivo' | ActivePhase | 'pausado' | 'resultado';
/** Mismo recorrido que el Radar de la sesión (RF-5.2): evaluar, jugar y recién ahí el resultado. */
type RadarSubPhase = 'evaluando' | 'jugando' | 'confianza' | 'feedback';
type RadarLoadStatus = 'inactivo' | 'cargando' | 'listo' | 'error';
type ResultSaveStatus = 'inactivo' | 'guardando' | 'error';

/** Lo que el diagnóstico deja medido, para el informe de cierre (RF-11.4). */
export interface LineaBaseDiagnostico {
  radarAciertos: number;
  radarTotal: number;
  perfilDeFugas: PerfilDeFugas;
  /** Brier de las respuestas de confianza del diagnóstico; null si no hubo ninguna. */
  brier: number | null;
  /** Partidas jugadas durante el diagnóstico, para ofrecer analizarlas. */
  partidaIds: string[];
}

interface DiagnosticoState {
  phase: Phase;
  /** Etapa conservada al pausar. El diagnóstico se reanuda en memoria sin
   * resetear ni el tablero compartido ni la posición actual del Radar. */
  pausedPhase: ActivePhase | null;
  resultadoJuego1: ResultadoPartida | null;
  resultadoJuego2: ResultadoPartida | null;
  /** Ids de las partidas guardadas en las etapas 1 y 2, en orden. */
  partidaIds: string[];

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
  /** Solución completa en SAN (RF-5.3). */
  radarLinea: string | null;
  /** Evaluación rápida declarada antes de jugar (RF-5.2). */
  radarEvalGuess: EvalGuess | null;
  /** Jugada del usuario en la posición actual, retenida hasta cerrar la confianza. */
  radarJugadaUsuario: string | null;
  /** Respuestas del Radar acumuladas en memoria, para el perfil de fugas del informe. */
  radarRespuestas: Array<{ tipo: RadarItem['tipo']; acierto: boolean }>;
  /** Confianzas declaradas del diagnóstico, para el Brier de línea base. */
  radarCalibraciones: Array<{ confianzaDeclarada: number; acierto: boolean }>;

  fen: string;
  turn: Color;
  /** Lado que resuelve, fijado al cargar: el tablero no gira tras la jugada (ver sessionStore). */
  boardOrientation: Color;
  dests: Map<string, string[]>;
  lastMove: [string, string] | null;
  check: boolean;
  /** Revelación del error en el tablero (ver sessionStore): posición, jugada
   * jugada y jugada correcta. */
  revision: RevisionDelError | null;

  bandaEstimada: ReturnType<typeof estimarBandaElo> | null;
  /** Medición de cierre; se llena junto con la banda al terminar. */
  lineaBase: LineaBaseDiagnostico | null;
  /** Rating declarado ya guardado en esta corrida (para no repetir el pedido). */
  ratingExternoGuardado: RatingExterno | null;
  /** Disponibilidad declarada en esta corrida; null hasta que se elija. */
  planSemanalGuardado: PlanSemanal | null;

  empezarJuego1(): Promise<void>;
  registrarResultadoJuego(): Promise<void>;
  reintentarJuego(): Promise<void>;
  reintentarRadar(): Promise<void>;
  radarEval(guess: EvalGuess): void;
  radarUserMove(from: Square, to: Square, promotion?: string): Promise<void>;
  radarConfirmarConfianza(valor: number): Promise<void>;
  radarContinuar(): Promise<void>;
  guardarRatingExterno(valor: number, fuente: RatingExterno['fuente']): Promise<void>;
  guardarPlanSemanal(plan: PlanSemanal): Promise<void>;
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
    set({
      radarItem: item,
      radarLoadStatus: 'listo',
      // Arranca en 'evaluando' como en la sesión (RF-5.2): declarar quién está
      // mejor antes de jugar. Sin este paso el diagnóstico medía con un
      // instrumento distinto del que después mide el progreso, y sus números
      // no eran comparables con los de ninguna sesión.
      radarSubPhase: 'evaluando',
      radarEvalGuess: null,
      radarUltimoAcierto: null,
      radarFeedbackTexto: '',
      radarJugadaCorrecta: null,
      radarLinea: null,
      radarJugadaUsuario: null,
      revision: null,
      ...boardSnapshot(),
      boardOrientation: chess.turn() as Color,
      lastMove: null,
    });
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
    const perfilDeFugas = perfilDeFugasDesdeIntentos(s.radarRespuestas);
    const brier = brierScore(s.radarCalibraciones);
    set({ resultSaveStatus: 'guardando' });
    try {
      // Se preserva el resto del perfil (p. ej. la fecha del último Stoyko):
      // pisarlo con un objeto nuevo borraría datos ajenos al diagnóstico.
      const actual = await profileRepo.get();
      await profileRepo.save({
        ...actual,
        bandaElo: banda,
        perfilDeFugas,
        diagnosticoCompletadoEn: new Date().toISOString(),
      });
      // El Radar de la sesión arranca donde lo dejó el diagnóstico. Antes esto
      // se perdía entero: el selector volvía al percentil neutral y tenía que
      // redescubrir el nivel del usuario con posiciones nuevas, después de
      // haber gastado veinte justamente en medirlo.
      const tasaRadar = s.radarServidos > 0 ? s.radarAciertos / s.radarServidos : 0;
      await radarProgressRepo.save({
        id: RADAR_PROGRESS_ID,
        historialTipos: s.radarSelState.historialTipos,
        historialIds: s.radarSelState.historialIds,
        dificultadCentro: centroInicialDesdeDiagnostico(tasaRadar),
        aciertosRecientes: s.radarRespuestas.slice(-8).map((respuesta) => respuesta.acierto),
        updatedAt: new Date().toISOString(),
      });
      set({
        phase: 'resultado',
        pausedPhase: null,
        bandaEstimada: banda,
        lineaBase: {
          radarAciertos: s.radarAciertos,
          radarTotal: s.radarServidos,
          perfilDeFugas,
          brier,
          partidaIds: s.partidaIds,
        },
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
    partidaIds: [],

    radarPool: [],
    radarLoadStatus: 'inactivo',
    resultSaveStatus: 'inactivo',
    radarSelState: RADAR_INITIAL_STATE,
    radarItem: null,
    radarSubPhase: 'evaluando',
    radarServidos: 0,
    radarAciertos: 0,
    radarUltimoAcierto: null,
    radarFeedbackTexto: '',
    radarJugadaCorrecta: null,
    radarLinea: null,
    radarEvalGuess: null,
    radarJugadaUsuario: null,
    radarRespuestas: [],
    radarCalibraciones: [],

    fen: chess.fen(),
    turn: 'w',
    boardOrientation: 'w',
    dests: new Map(),
    lastMove: null,
    check: false,
    revision: null,

    bandaEstimada: null,
    lineaBase: null,
    ratingExternoGuardado: null,
    planSemanalGuardado: null,

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
        partidaIds: [],
        radarPool: [],
        radarLoadStatus: 'inactivo',
        resultSaveStatus: 'inactivo',
        radarItem: null,
        radarServidos: 0,
        radarAciertos: 0,
        radarRespuestas: [],
        radarCalibraciones: [],
        radarSelState: RADAR_INITIAL_STATE,
        bandaEstimada: null,
        lineaBase: null,
        ratingExternoGuardado: null,
        planSemanalGuardado: null,
      });
      useGameStore.getState().reset();
      await useGameStore.getState().start(DIAGNOSTICO_JUEGO1_NIVEL, 'random', 'diagnostico');
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
      // El id de la partida recién guardada sirve para ofrecer analizarla en el
      // informe de cierre: analizar una partida propia es lo único que produce
      // la línea base de errores graves (RF-12.1) y las primeras tarjetas de
      // origen 'partida', de las que dependen la fuga táctica (RF-11.2) y el
      // reciclaje de errores propios (RF-5.9).
      const guardadaId = useGameStore.getState().savedGameId;
      const partidaIds = guardadaId && !s.partidaIds.includes(guardadaId)
        ? [...s.partidaIds, guardadaId]
        : s.partidaIds;
      if (s.phase === 'juego1') {
        set({ resultadoJuego1: resultado, partidaIds, phase: 'juego2' });
        useGameStore.getState().reset();
        await useGameStore.getState().start(DIAGNOSTICO_JUEGO2_NIVEL, 'random', 'diagnostico');
        return;
      }
      set({ resultadoJuego2: resultado, partidaIds, phase: 'radar', radarLoadStatus: 'cargando', radarItem: null });
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
      await useGameStore.getState().start(level, color, 'diagnostico');
    },

    async reintentarRadar() {
      const s = get();
      const activePhase = s.phase === 'pausado' ? s.pausedPhase : s.phase;
      if (activePhase !== 'radar' || s.radarLoadStatus === 'cargando') return;
      await prepararRadar();
    },

    radarEval(guess) {
      const s = get();
      if (s.phase !== 'radar' || s.radarSubPhase !== 'evaluando') return;
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
      // Promoción a dama por defecto (mismo criterio que sessionStore):
      // chess.js tira si la jugada corona y falta la pieza.
      const promo = promotion ?? (candidate.promotion ? 'q' : undefined);
      const jugadaUsuario = from + to + (promo ?? '');
      const item = s.radarItem;
      const acierto = esRespuestaCorrectaRadar(item, jugadaUsuario);
      chess.move({ from, to, promotion: promo });

      // La posición ya respondida es `radarServidos + 1` (1-based). Cuando toca
      // pedir confianza, el resultado no se muestra todavía: revelarlo antes
      // haría inútil la declaración.
      const posicion = s.radarServidos + 1;
      const pedirConfianza = DIAGNOSTICO_POSICIONES_CONFIANZA.includes(posicion);

      set({
        ...boardSnapshot(),
        lastMove: [from, to],
        radarUltimoAcierto: acierto,
        radarJugadaUsuario: jugadaUsuario,
        radarJugadaCorrecta: sanDeJugada(item.fen, item.solucion[0]),
        revision: acierto ? null : revisionDelError(item.fen, jugadaUsuario, item.solucion[0]),
        radarLinea: lineaParaMostrar(item),
        radarFeedbackTexto: explainFeedback(item, acierto),
        radarSubPhase: pedirConfianza ? 'confianza' : 'feedback',
        radarServidos: posicion,
        radarAciertos: s.radarAciertos + (acierto ? 1 : 0),
        radarRespuestas: [...s.radarRespuestas, { tipo: item.tipo, acierto }],
      });

      await radarAttemptRepo.save({
        id: crypto.randomUUID(),
        itemId: item.id,
        tipo: item.tipo,
        rating: item.rating,
        // Marca el origen para que estas respuestas no entren en la lectura de
        // la banda 60–80% ni en el detector de sobreajuste: el diagnóstico
        // sirve sin adaptar la dificultad, así que su tasa no es comparable
        // con la del Radar adaptativo.
        origenContenido: 'diagnostico',
        acierto,
        ...(s.radarEvalGuess ? { evalGuess: s.radarEvalGuess } : {}),
        fecha: new Date().toISOString(),
      } satisfies RadarAttempt);
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

    async radarConfirmarConfianza(valor) {
      const s = get();
      if (s.phase !== 'radar' || s.radarSubPhase !== 'confianza' || s.radarUltimoAcierto === null) return;
      const record: CalibrationRecord = {
        id: crypto.randomUUID(),
        contexto: 'radar',
        confianzaDeclarada: valor,
        acierto: s.radarUltimoAcierto,
        fecha: new Date().toISOString(),
      };
      set({
        radarSubPhase: 'feedback',
        radarCalibraciones: [...s.radarCalibraciones, { confianzaDeclarada: valor, acierto: s.radarUltimoAcierto }],
      });
      await calibrationRepo.save(record);
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

    /**
     * Rating de partidas lentas declarado por el usuario (PRD §3.1). Sin
     * importación automática de historial no hay otra fuente real, y sin él la
     * métrica estrella —ΔElo contra línea base— no tiene con qué compararse:
     * el Panel mostraba una banda categórica y el detector de sobreajuste no
     * podía activarse nunca. Es opcional; declinar no bloquea nada.
     */
    async guardarRatingExterno(valor, fuente) {
      if (!Number.isInteger(valor) || valor < 100 || valor > 4000) return;
      const registro: RatingExterno = { valor, fuente, fecha: new Date().toISOString() };
      const actual = await profileRepo.get();
      await profileRepo.save({ ...actual, ratingsExternos: [...(actual.ratingsExternos ?? []), registro] });
      set({ ratingExternoGuardado: registro });
    },

    /**
     * Disponibilidad declarada (RF-11.3). El diagnóstico medía habilidad y no
     * preguntaba nunca cuánto tiempo tiene el usuario, así que la carga diaria
     * salía de la nada: una cuenta nueva veía ~83 minutos "para hoy". Acá se
     * captura de un toque y pasa a gobernar el presupuesto (core/duracion.ts).
     */
    async guardarPlanSemanal(plan) {
      if (!isValidWeeklyPlan(plan)) return;
      const actual = await profileRepo.get();
      await profileRepo.save({ ...actual, planSemanal: plan });
      set({ planSemanalGuardado: plan });
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
