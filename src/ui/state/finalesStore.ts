// Finales elementales (RF-6.2): juega una posición teórica contra Stockfish
// a máxima fuerza y persiste la demostración en el planificador del currículo
// (RF-6.3). Las reglas de aprobación viven en core/finales.ts.
import { Chess, type Square } from 'chess.js';
import { create } from 'zustand';
import type { EngineEvaluation, EnginePort } from '../../core/ports';
import type { Color, CurriculumItem, CurriculumProgress } from '../../core/types';
import { evaluateFinalTechnique } from '../../core/finales';
import type { RevisionDelError } from '../../core/revision';
import { revisionDelError } from '../../core/revision';
import { newCurriculumProgress, reviewCurriculumProgress } from '../../core/curriculum';
import { altaErrorCard } from '../../core/errorCard';
import { engine } from '../../services/engine/stockfishEngine';
import { curriculumItemRepo } from '../../services/storage/curriculumItemRepo';
import { curriculumProgressRepo } from '../../services/storage/curriculumProgressRepo';
import { errorCardRepo } from '../../services/storage/errorCardRepo';
import { registrarTiempoEntrenado } from '../../services/storage/trainingEventRepo';
import { computeDests, sanDeJugada } from './chessBoardUtils';

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
  /**
   * Punto crítico de una técnica perdida: la posición anterior a la última
   * jugada propia, con esa jugada y la que el motor prefería. Alimenta la
   * flecha del tablero y el texto del feedback (RF-5.3) — antes el final se
   * cerraba con "la técnica se perdió" y nada más, que es justo cuando hace
   * falta ver la alternativa.
   */
  revision: RevisionDelError | null;
  /** Jugada correcta en el punto crítico, en SAN, para el panel. */
  jugadaCorrecta: string | null;
  /**
   * La demostración en curso es práctica libre: no toca el progreso espaciado.
   * RF-6.3 pide "3 demostraciones **espaciadas** sin error" y la lista dejaba
   * repetir el mismo final tres veces seguidas, con lo cual se automatizaba
   * —y dejaba de aparecer para siempre— con práctica masiva, exactamente lo
   * contrario del mecanismo en el que se apoya el currículo. Ahora el intento
   * que cuenta es el del final vencido; querer practicar de nuevo antes de
   * tiempo sigue estando permitido, pero no acumula racha (mismo criterio que
   * el enfriamiento de Stoyko, RF-7.2).
   */
  practica: boolean;

  load(): Promise<void>;
  start(itemId: string, practica?: boolean): Promise<void>;
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
  /** Cuándo arrancó la demostración en curso, para medir su tiempo (RF-13.4). */
  let inicioMs: number | null = null;

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
      const progressById = new Map(get().progressById);
      // En práctica libre el resultado no mueve el planificador: ni suma a la
      // racha de automatización ni adelanta la reaparición. La tarjeta de error
      // por perder la técnica sí se crea igual — un error propio es material de
      // repaso venga de donde venga (RF-4.1).
      if (!get().practica) {
        const previous = progressById.get(item.id) ?? newCurriculumProgress(item.id);
        const next = reviewCurriculumProgress(previous, limpia);
        await deps.progress.save(next);
        progressById.set(item.id, next);
      }

      let revision: RevisionDelError | null = null;
      let jugadaCorrecta: string | null = null;
      if (!limpia && lastUserFen && lastUserMove) {
        try {
          const best = await deps.enginePort.evaluate(lastUserFen, FINAL_ENGINE_DEPTH);
          revision = revisionDelError(lastUserFen, lastUserMove, best.move);
          jugadaCorrecta = sanDeJugada(lastUserFen, best.move);
          // Si la última jugada propia era la mejor, el final no se perdió ahí
          // (típico al no llegar al mate en 50 jugadas): guardarla como error a
          // repasar enseñaría a no repetir la jugada correcta.
          if (best.move !== lastUserMove) {
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
          }
        } catch {
          // El progreso del final ya quedó guardado; una falla secundaria del
          // motor no debe impedir mostrar el resultado de la demostración.
        }
      }
      // Un final jugado entero contra el motor es de los tramos más largos que
      // pide el plan y no sumaba ningún minuto: no se medía en ninguna parte.
      if (inicioMs !== null) {
        registrarTiempoEntrenado('final', `${item.id}:${inicioMs}`, Date.now() - inicioMs);
        inicioMs = null;
      }
      snapshot({ phase: 'feedback', limpia, thinking: false, progressById, pendingPromotion: null, revision, jugadaCorrecta });
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
          // `promoted` describe la coronación **del usuario**: pasar acá la del
          // motor daba por demostrada la técnica cuando quien coronaba era el
          // rival.
          const verdict = evaluateFinalTechnique(item, positionState(false), null);
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
      practica: false,
      revision: null,
      jugadaCorrecta: null,

      async load() {
        await deps.items.ensureSeeded();
        const [items, progress] = await Promise.all([deps.items.list(), deps.progress.list()]);
        set({
          phase: 'lista',
          items: items.filter((item) => item.tipo === 'final'),
          progressById: new Map(progress.map((entry) => [entry.id, entry] as const)),
        });
      },

      async start(itemId, practica = false) {
        const item = get().items.find((candidate) => candidate.id === itemId);
        if (!item || !item.ladoUsuario || !item.resultadoEsperado) return;
        chess = new Chess(item.fen);
        lastUserFen = '';
        lastUserMove = '';
        set({
          phase: 'cargando', item, playerColor: item.ladoUsuario, userMoves: 0,
          limpia: null, engineError: false, pendingPromotion: null, lastMove: null, practica,
          revision: null, jugadaCorrecta: null,
        });
        try {
          await deps.enginePort.init();
        } catch {
          snapshot({ phase: 'lista', engineError: true });
          return;
        }
        inicioMs = Date.now();
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
        const corono = Boolean(candidate.promotion);
        chess.move({ from, to, promotion });
        set({ userMoves: s.userMoves + 1, pendingPromotion: null });
        snapshot({ lastMove: [from, to], thinking: true });

        const terminal = evaluateFinalTechnique(s.item, positionState(corono), null);
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
        // La coronación viaja hasta acá: es la evaluación posterior la que dice
        // si coronar convirtió de verdad o si la dama se cae en la próxima.
        const verdict = evaluateFinalTechnique(s.item, positionState(corono), evaluation);
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
        set({
          phase: 'lista', item: null, limpia: null, thinking: false, pendingPromotion: null,
          practica: false, revision: null, jugadaCorrecta: null,
        });
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
