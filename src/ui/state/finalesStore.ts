// Finales elementales (RF-6.2): juega una posición teórica contra Stockfish
// a máxima fuerza y persiste la demostración en el planificador del currículo
// (RF-6.3). Las reglas de aprobación viven en core/finales.ts.
import { Chess, type Square } from 'chess.js';
import { create } from 'zustand';
import type { EngineEvaluation, EnginePort } from '../../core/ports';
import type { Color, CurriculumItem, CurriculumProgress } from '../../core/types';
import { evaluateFinalTechnique } from '../../core/finales';
import { newCurriculumProgress, reviewCurriculumProgress } from '../../core/curriculum';
import { altaErrorCard } from '../../core/errorCard';
import { engine } from '../../services/engine/stockfishEngine';
import { curriculumItemRepo } from '../../services/storage/curriculumItemRepo';
import { curriculumProgressRepo } from '../../services/storage/curriculumProgressRepo';
import { errorCardRepo } from '../../services/storage/errorCardRepo';
import { computeDests } from './chessBoardUtils';

const FINAL_ENGINE_DEPTH = 18;

type Phase = 'lista' | 'cargando' | 'jugando' | 'feedback';

export interface FinalesState {
  phase: Phase;
  items: CurriculumItem[];
  progressById: Map<string, CurriculumProgress>;
  item: CurriculumItem | null;
  fen: string;
  turn: Color;
  playerColor: Color;
  dests: Map<string, string[]>;
  lastMove: [Square, Square] | null;
  check: boolean;
  thinking: boolean;
  pendingPromotion: { from: Square; to: Square } | null;
  userMoves: number;
  limpia: boolean | null;
  engineError: boolean;

  load(): Promise<void>;
  start(itemId: string): Promise<void>;
  userMove(from: Square, to: Square, promotion?: string): Promise<void>;
  cancelPromotion(): void;
  volver(): void;
}

interface FinalesDeps {
  enginePort: EnginePort;
  items: typeof curriculumItemRepo;
  progress: typeof curriculumProgressRepo;
  errors: typeof errorCardRepo;
}

export function createFinalesStore(deps: FinalesDeps) {
  let chess = new Chess();
  let lastUserFen = '';
  let lastUserMove = '';

  return create<FinalesState>((set, get) => {
    function snapshot(partial: Partial<FinalesState> = {}) {
      set({
        fen: chess.fen(),
        turn: chess.turn() as Color,
        dests: computeDests(chess),
        check: chess.inCheck(),
        ...partial,
      });
    }

    function positionState(promoted = false) {
      const winner: Color | null = chess.isCheckmate() ? (chess.turn() === 'w' ? 'b' : 'w') : null;
      return {
        gameOver: chess.isGameOver(),
        draw: chess.isDraw(),
        winner,
        promoted,
        userMoves: get().userMoves,
      };
    }

    async function finish(limpia: boolean) {
      const item = get().item;
      if (!item) return;
      const previous = get().progressById.get(item.id) ?? newCurriculumProgress(item.id);
      const next = reviewCurriculumProgress(previous, limpia);
      await deps.progress.save(next);
      const progressById = new Map(get().progressById);
      progressById.set(item.id, next);

      if (!limpia && lastUserFen && lastUserMove) {
        try {
          const best = await deps.enginePort.evaluate(lastUserFen, FINAL_ENGINE_DEPTH);
          const cards = await deps.errors.list();
          const alta = altaErrorCard(cards, {
            fen: lastUserFen,
            ladoAMover: item.ladoUsuario ?? 'w',
            jugadaUsuario: lastUserMove,
            jugadaCorrecta: best.move,
            categoria: 'posicional',
            origen: 'final',
          });
          if (alta.accion !== 'omitir') await deps.errors.save(alta.card);
        } catch {
          // El progreso del final ya quedó guardado; una falla secundaria del
          // motor no debe impedir mostrar el resultado de la demostración.
        }
      }
      snapshot({ phase: 'feedback', limpia, thinking: false, progressById, pendingPromotion: null });
    }

    async function engineTurn() {
      const item = get().item;
      if (!item || chess.isGameOver()) return;
      snapshot({ thinking: true });
      try {
        const evaluation = await deps.enginePort.evaluate(chess.fen(), FINAL_ENGINE_DEPTH);
        const from = evaluation.move.slice(0, 2) as Square;
        const to = evaluation.move.slice(2, 4) as Square;
        const promotion = evaluation.move.slice(4, 5) || undefined;
        chess.move({ from, to, promotion });
        if (chess.isGameOver()) {
          const verdict = evaluateFinalTechnique(item, positionState(Boolean(promotion)), null);
          await finish(verdict === 'demostrado');
          return;
        }
        snapshot({ thinking: false, lastMove: [from, to] });
      } catch {
        snapshot({ thinking: false, engineError: true });
      }
    }

    return {
      phase: 'lista',
      items: [],
      progressById: new Map(),
      item: null,
      fen: chess.fen(),
      turn: 'w',
      playerColor: 'w',
      dests: new Map(),
      lastMove: null,
      check: false,
      thinking: false,
      pendingPromotion: null,
      userMoves: 0,
      limpia: null,
      engineError: false,

      async load() {
        await deps.items.ensureSeeded();
        const [items, progress] = await Promise.all([deps.items.list(), deps.progress.list()]);
        set({
          phase: 'lista',
          items: items.filter((item) => item.tipo === 'final'),
          progressById: new Map(progress.map((entry) => [entry.id, entry] as const)),
        });
      },

      async start(itemId) {
        const item = get().items.find((candidate) => candidate.id === itemId);
        if (!item || !item.ladoUsuario || !item.resultadoEsperado) return;
        chess = new Chess(item.fen);
        lastUserFen = '';
        lastUserMove = '';
        set({
          phase: 'cargando', item, playerColor: item.ladoUsuario, userMoves: 0,
          limpia: null, engineError: false, pendingPromotion: null, lastMove: null,
        });
        try {
          await deps.enginePort.init();
        } catch {
          snapshot({ phase: 'lista', engineError: true });
          return;
        }
        snapshot({ phase: 'jugando', thinking: false });
        if (chess.turn() !== item.ladoUsuario) await engineTurn();
      },

      async userMove(from, to, promotion) {
        const s = get();
        if (s.phase !== 'jugando' || s.thinking || !s.item || chess.turn() !== s.playerColor) return;
        const candidate = chess.moves({ verbose: true }).find((move) => move.from === from && move.to === to);
        if (!candidate) {
          snapshot();
          return;
        }
        if (candidate.promotion && !promotion) {
          snapshot({ pendingPromotion: { from, to } });
          return;
        }

        lastUserFen = chess.fen();
        lastUserMove = from + to + (promotion ?? '');
        chess.move({ from, to, promotion });
        set({ userMoves: s.userMoves + 1, pendingPromotion: null });
        snapshot({ lastMove: [from, to], thinking: true });

        const terminal = evaluateFinalTechnique(s.item, positionState(Boolean(candidate.promotion)), null);
        if (terminal === 'demostrado' || terminal === 'perdido') {
          await finish(terminal === 'demostrado');
          return;
        }
        let evaluation: EngineEvaluation;
        try {
          evaluation = await deps.enginePort.evaluate(chess.fen(), FINAL_ENGINE_DEPTH);
        } catch {
          snapshot({ thinking: false, engineError: true });
          return;
        }
        const verdict = evaluateFinalTechnique(s.item, positionState(), evaluation);
        if (verdict !== 'continuar') {
          await finish(verdict === 'demostrado');
          return;
        }

        const engineFrom = evaluation.move.slice(0, 2) as Square;
        const engineTo = evaluation.move.slice(2, 4) as Square;
        chess.move({ from: engineFrom, to: engineTo, promotion: evaluation.move.slice(4, 5) || undefined });
        if (chess.isGameOver()) {
          const afterEngine = evaluateFinalTechnique(s.item, positionState(), null);
          await finish(afterEngine === 'demostrado');
          return;
        }
        snapshot({ thinking: false, lastMove: [engineFrom, engineTo] });
      },

      cancelPromotion() {
        snapshot({ pendingPromotion: null });
      },

      volver() {
        chess = new Chess();
        set({ phase: 'lista', item: null, limpia: null, thinking: false, pendingPromotion: null });
      },
    };
  });
}

export const useFinalesStore = createFinalesStore({
  enginePort: engine,
  items: curriculumItemRepo,
  progress: curriculumProgressRepo,
  errors: errorCardRepo,
});
