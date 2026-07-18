// Orquesta el análisis en dos fases (E3, RF-3.1–3.4): el motor está
// bloqueado hasta terminar la fase 1; la fase 2 corre el motor, clasifica
// jugadas y ofrece tarjetas candidatas para la Cola (E4).
import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { CategoriaError, Color, EvalSymbol, GameAnalysis, GameRecord, MoveAnalysisEntry, PhaseOneData } from '../../core/types';
import { buildGameAnalysis, detectedErrorMoves, esMomentoCriticoValido, pickPhaseOnePositions } from '../../core/analysis';
import { buildErrorCard } from '../../core/errorCard';
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
  | 'fase2-resultado'
  | 'confirmar-errores'
  | 'fin';

interface MoveInfo {
  ply: number;
  san: string;
  fenAntes: string;
  ladoQueMueve: Color;
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

  iniciar(gameId: string): Promise<void>;
  marcarMomentoCritico(ply: number): void;
  confirmarPlan(texto: string): void;
  evaluarPosicion(valor: EvalSymbol): Promise<void>;
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
    moves.push({ ply: moves.length, san: m.san, fenAntes: chess.fen(), ladoQueMueve: chess.turn() });
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
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

  marcarMomentoCritico(ply) {
    const s = get();
    if (!esMomentoCriticoValido(ply, s.moves.length)) return;
    set({ momentoCriticoPly: ply, phase: 'fase1-plan' });
  },

  confirmarPlan(texto) {
    const s = get();
    const posiciones = pickPhaseOnePositions(s.moves.length, 3);
    set({ plan: texto, fase1Posiciones: posiciones, fase1EvalIndex: 0, fase1Evaluaciones: [], phase: 'fase1-evaluaciones' });
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
    set({ game: gameConFase1, fase1Evaluaciones: evaluaciones, phase: 'fase2-analizando', progreso: null });

    const evals = await analyzeGameWithEngine(game.pgn, engine, {
      onProgress: (p) => set({ progreso: p }),
    });
    const analysis = buildGameAnalysis(evals, fase1);
    const gameFinal: GameRecord = { ...gameConFase1, analisis: analysis, analizada: true };
    await gameRepo.save(gameFinal);
    set({ game: gameFinal, analysis, phase: 'fase2-resultado' });
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
    const card = buildErrorCard({
      fen: entry.fenAntes,
      ladoAMover: entry.ladoQueMueve,
      jugadaUsuario: entry.jugadaUsuario,
      jugadaCorrecta: entry.jugadaMotor,
      categoria: s.errorActualCategoria,
      origen: 'partida',
    });
    await errorCardRepo.save(card);
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
