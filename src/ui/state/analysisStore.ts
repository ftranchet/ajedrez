// Orquesta el análisis en dos fases (E3, RF-3.1–3.4): el motor está
// bloqueado hasta terminar la fase 1; la fase 2 corre el motor, clasifica
// jugadas y ofrece tarjetas candidatas para la Cola (E4).
import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { CategoriaError, Color, EvalSymbol, GameAnalysis, GameRecord, MoveAnalysisEntry, PhaseOneData } from '../../core/types';
import { buildGameAnalysis, detectedErrorMoves, esMomentoCriticoValido, pickPhaseOnePositions } from '../../core/analysis';
import { altaErrorCard } from '../../core/errorCard';
import { analyzeGameWithEngine } from '../../services/analysis/gameAnalyzer';
import { engine } from '../../services/engine/stockfishEngine';
import { gameRepo } from '../../services/storage/gameRepo';
import { errorCardRepo } from '../../services/storage/errorCardRepo';

type Phase =
  | 'inactivo'
  | 'cargando'
  | 'fase1-momento'
  | 'fase1-plan'
  | 'fase1-evaluaciones'
  | 'fase2-analizando'
  | 'fase2-error'
  | 'fase2-resultado'
  | 'confirmar-errores'
  // Análisis exprés (RF-3.5): solo fase 2, para el lote de rápidas importadas.
  | 'expres-analizando'
  | 'expres-error'
  | 'fin';

interface MoveInfo {
  ply: number;
  san: string;
  fenAntes: string;
  ladoQueMueve: Color;
  /** Posición ya con la jugada hecha: es lo que se muestra al recorrer la partida. */
  fenDespues: string;
  /** Casillas de origen y destino, para resaltar la jugada en el tablero. */
  lastMove: [string, string];
}

interface AnalysisState {
  phase: Phase;
  game: GameRecord | null;
  moves: MoveInfo[];

  // Fase 1
  momentoCriticoPly: number | null;
  plan: string;
  fase1Posiciones: number[];
  fase1EvalIndex: number;
  fase1Evaluaciones: Array<{ ply: number; valorUsuario: EvalSymbol }>;

  // Fase 2
  progreso: { ply: number; totalPlies: number } | null;
  analysis: GameAnalysis | null;
  erroresPendientes: MoveAnalysisEntry[];
  erroresConfirmados: number;
  errorActualCategoria: CategoriaError;

  /** Progreso del lote exprés: qué partida se está analizando y cuántas van. */
  loteProgreso: { actual: number; total: number } | null;
  /** El usuario pidió cortar el lote; termina la partida en curso y para. */
  loteCancelado: boolean;
  /** Partidas del lote que el motor no pudo analizar; se informan al final. */
  loteFallidas: number;

  iniciar(gameId: string): Promise<void>;
  iniciarExpres(gameIds: string[]): Promise<void>;
  cancelarLote(): void;
  marcarMomentoCritico(ply: number): void;
  confirmarPlan(texto: string): void;
  evaluarPosicion(valor: EvalSymbol): Promise<void>;
  correrFase2(): Promise<void>;
  reintentarAnalisis(): void;
  continuarAErrores(): void;
  elegirCategoria(categoria: CategoriaError): void;
  confirmarErrorActual(): Promise<void>;
  descartarErrorActual(): void;
  terminar(): void;
  volver(): void;
}

function movesFromPgn(pgn: string): MoveInfo[] {
  const replay = new Chess();
  replay.loadPgn(pgn, { strict: false });
  const history = replay.history({ verbose: true });
  const chess = new Chess();
  const moves: MoveInfo[] = [];
  for (const m of history) {
    const fenAntes = chess.fen();
    const ladoQueMueve = chess.turn();
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    moves.push({
      ply: moves.length,
      san: m.san,
      fenAntes,
      ladoQueMueve,
      fenDespues: chess.fen(),
      lastMove: [m.from, m.to],
    });
  }
  return moves;
}

const initialState = {
  phase: 'inactivo' as Phase,
  game: null as GameRecord | null,
  moves: [] as MoveInfo[],
  momentoCriticoPly: null as number | null,
  plan: '',
  fase1Posiciones: [] as number[],
  fase1EvalIndex: 0,
  fase1Evaluaciones: [] as Array<{ ply: number; valorUsuario: EvalSymbol }>,
  progreso: null as { ply: number; totalPlies: number } | null,
  analysis: null as GameAnalysis | null,
  erroresPendientes: [] as MoveAnalysisEntry[],
  erroresConfirmados: 0,
  errorActualCategoria: 'tactico' as CategoriaError,
  loteProgreso: null as { actual: number; total: number } | null,
  loteCancelado: false,
  loteFallidas: 0,
};

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  ...initialState,

  async iniciar(gameId) {
    set({ ...initialState, phase: 'cargando' });
    const games = await gameRepo.list();
    const game = games.find((g) => g.id === gameId) ?? null;
    if (!game) {
      set({ phase: 'inactivo' });
      return;
    }
    const moves = movesFromPgn(game.pgn);
    set({ game, moves, phase: 'fase1-momento' });
  },

  /**
   * Análisis exprés en lote (RF-3.5): corre solo la fase 2 sobre las partidas
   * indicadas y junta todas las tarjetas candidatas para revisarlas de una.
   *
   * El análisis en dos fases sigue siendo obligatorio para las partidas lentas
   * —el orden "primero tu juicio" es todo su valor—, pero pedirlo para cada
   * rápida importada volvía impracticable traer historial. Y de ahí depende
   * media app: sin tarjetas de origen `partida` no hay fuga táctica (RF-11.2),
   * ni reciclaje de errores propios (RF-5.9), ni métrica de errores graves
   * (RF-12.1). El exprés es el camino corto a ese material, no un atajo para
   * saltearse la fase 1 donde sí importa.
   *
   * Una partida que el motor no puede analizar no corta el lote: se cuenta y
   * se sigue con la siguiente.
   */
  async iniciarExpres(gameIds) {
    if (gameIds.length === 0) return;
    set({ ...initialState, phase: 'expres-analizando', loteProgreso: { actual: 0, total: gameIds.length } });
    const games = await gameRepo.list();
    const porId = new Map(games.map((game) => [game.id, game] as const));
    const acumulados: MoveAnalysisEntry[] = [];
    let fallidas = 0;

    for (const [index, gameId] of gameIds.entries()) {
      if (get().loteCancelado) break;
      const game = porId.get(gameId);
      if (!game) continue;
      set({ loteProgreso: { actual: index + 1, total: gameIds.length }, game, progreso: null });
      try {
        const evals = await analyzeGameWithEngine(game.pgn, engine, {
          onProgress: (p) => set({ progreso: p }),
        });
        // Sin fase 1: el exprés no la simula ni la deja a medias. La partida
        // queda con `analisis` pero sin `fase1`, que es la verdad.
        const analysis = buildGameAnalysis(evals, null);
        await gameRepo.save({ ...game, analisis: analysis, analizada: true });
        acumulados.push(...detectedErrorMoves(analysis, game.jugadorColor));
      } catch {
        fallidas += 1;
      }
    }

    if (acumulados.length === 0) {
      set({ phase: fallidas === gameIds.length ? 'expres-error' : 'fin', loteFallidas: fallidas, progreso: null });
      return;
    }
    set({
      erroresPendientes: acumulados,
      erroresConfirmados: 0,
      errorActualCategoria: 'tactico',
      loteFallidas: fallidas,
      progreso: null,
      phase: 'confirmar-errores',
    });
  },

  cancelarLote() {
    if (get().phase !== 'expres-analizando') return;
    set({ loteCancelado: true });
  },

  marcarMomentoCritico(ply) {
    const s = get();
    if (!esMomentoCriticoValido(ply, s.moves.length)) return;
    set({ momentoCriticoPly: ply, phase: 'fase1-plan' });
  },

  confirmarPlan(texto) {
    // El plan es la parte cognitivamente central de la fase 1 (RF-3.1b:
    // "escribir su plan"): no se avanza con el campo vacío, para no saltearla.
    // Guarda del lado del store, además del botón deshabilitado en la UI.
    if (texto.trim() === '') return;
    const s = get();
    const posiciones = pickPhaseOnePositions(s.moves.length, 3);
    set({ plan: texto.trim(), fase1Posiciones: posiciones, fase1EvalIndex: 0, fase1Evaluaciones: [], phase: 'fase1-evaluaciones' });
  },

  async evaluarPosicion(valor) {
    const s = get();
    const ply = s.fase1Posiciones[s.fase1EvalIndex];
    const evaluaciones = [...s.fase1Evaluaciones, { ply, valorUsuario: valor }];
    const siguienteIndex = s.fase1EvalIndex + 1;

    if (siguienteIndex < s.fase1Posiciones.length) {
      set({ fase1Evaluaciones: evaluaciones, fase1EvalIndex: siguienteIndex });
      return;
    }

    // Fase 1 completa: recién ahora se desbloquea el motor (RF-3.1).
    const fase1: PhaseOneData = {
      momentoCriticoPly: s.momentoCriticoPly ?? 0,
      plan: s.plan,
      evaluaciones,
      completadaEn: new Date().toISOString(),
    };
    const game = s.game!;
    const gameConFase1: GameRecord = { ...game, fase1 };
    await gameRepo.save(gameConFase1);
    set({ game: gameConFase1, fase1Evaluaciones: evaluaciones });
    await get().correrFase2();
  },

  /** Corre la fase 2 (el motor) sobre la partida ya con fase 1 guardada. Si el
   * motor falla (Worker no arranca, timeout), pasa a `fase2-error` en vez de
   * quedar colgado para siempre en "analizando"; reintentar no repite la fase 1. */
  async correrFase2() {
    const game = get().game;
    if (!game?.fase1) return;
    set({ phase: 'fase2-analizando', progreso: null });
    try {
      const evals = await analyzeGameWithEngine(game.pgn, engine, {
        onProgress: (p) => set({ progreso: p }),
      });
      const analysis = buildGameAnalysis(evals, game.fase1);
      const gameFinal: GameRecord = { ...game, analisis: analysis, analizada: true };
      await gameRepo.save(gameFinal);
      set({ game: gameFinal, analysis, phase: 'fase2-resultado' });
    } catch {
      set({ phase: 'fase2-error', progreso: null });
    }
  },

  reintentarAnalisis() {
    if (get().phase !== 'fase2-error') return;
    void get().correrFase2();
  },

  continuarAErrores() {
    const s = get();
    if (!s.analysis) return;
    // Solo los errores del usuario se ofrecen como tarjetas (RF-3.3): las
    // jugadas malas del motor no son "sus" errores para repasar.
    const errores = detectedErrorMoves(s.analysis, s.game?.jugadorColor);
    if (errores.length === 0) {
      set({ phase: 'fin' });
      return;
    }
    set({ erroresPendientes: errores, erroresConfirmados: 0, errorActualCategoria: 'tactico', phase: 'confirmar-errores' });
  },

  elegirCategoria(categoria) {
    set({ errorActualCategoria: categoria });
  },

  async confirmarErrorActual() {
    const s = get();
    const entry = s.erroresPendientes[0];
    if (!entry) return;
    // Dedup por identidad + tope diario (RF-4.1/4.5): el mismo error en dos
    // análisis no duplica la tarjeta, y no se avalancha la Cola.
    const cards = await errorCardRepo.list();
    const alta = altaErrorCard(cards, {
      fen: entry.fenAntes,
      ladoAMover: entry.ladoQueMueve,
      jugadaUsuario: entry.jugadaUsuario,
      jugadaCorrecta: entry.jugadaMotor,
      categoria: s.errorActualCategoria,
      origen: 'partida',
    });
    if (alta.accion !== 'omitir') await errorCardRepo.save(alta.card);
    const restantes = s.erroresPendientes.slice(1);
    set({
      erroresPendientes: restantes,
      erroresConfirmados: s.erroresConfirmados + 1,
      errorActualCategoria: 'tactico',
      phase: restantes.length === 0 ? 'fin' : 'confirmar-errores',
    });
  },

  descartarErrorActual() {
    const s = get();
    const restantes = s.erroresPendientes.slice(1);
    set({ erroresPendientes: restantes, errorActualCategoria: 'tactico', phase: restantes.length === 0 ? 'fin' : 'confirmar-errores' });
  },

  terminar() {
    set({ phase: 'fin' });
  },

  volver() {
    set({ ...initialState });
  },
}));
