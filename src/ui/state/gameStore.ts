// Estado de la pantalla Jugar. Orquesta reglas (chess.js), motor (puerto
// EnginePort) y persistencia (puerto GameRepo). RF-1.1, RF-1.3, RF-1.5.
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { Color, Resultado } from '../../core/types';
import type { EngineLevel } from '../../core/ports';
import { buildGameRecord, deriveResult } from '../../core/game';
import { engine } from '../../services/engine/stockfishEngine';
import { gameRepo } from '../../services/storage/gameRepo';
import levelsConfig from '../../config/engine-levels.json';

export const ENGINE_LEVELS: EngineLevel[] = levelsConfig.levels;

export type Phase = 'setup' | 'loading' | 'playing' | 'ended';
export type EndReason = 'mate' | 'ahogado' | 'regla' | 'abandono';

export interface PendingPromotion {
  from: Square;
  to: Square;
}

interface GameState {
  phase: Phase;
  fen: string;
  turn: Color;
  playerColor: Color;
  levelId: string;
  sanMoves: string[];
  lastMove: [Square, Square] | null;
  check: boolean;
  dests: Map<string, string[]>;
  thinking: boolean;
  pendingPromotion: PendingPromotion | null;
  resultado: Resultado | null;
  endReason: EndReason | null;
  saved: boolean;
  engineError: boolean;

  start(levelId: string, color: Color | 'random'): Promise<void>;
  userMove(from: Square, to: Square, promotion?: string): Promise<void>;
  cancelPromotion(): void;
  resign(): Promise<void>;
  reset(): void;
}

const chess = new Chess();
let moveTimesMs: number[] = [];
let turnStartedAt = 0;

function computeDests(c: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}

function levelById(id: string): EngineLevel {
  return ENGINE_LEVELS.find((l) => l.id === id) ?? ENGINE_LEVELS[0];
}

export const useGameStore = create<GameState>((set, get) => {
  function snapshot(partial: Partial<GameState> = {}) {
    set({
      fen: chess.fen(),
      turn: chess.turn(),
      sanMoves: chess.history(),
      check: chess.inCheck(),
      dests: computeDests(chess),
      ...partial,
    });
  }

  function isOver(): boolean {
    return chess.isGameOver();
  }

  async function finish(resignedBy?: Color) {
    const resultado = deriveResult({
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      turn: chess.turn(),
      resignedBy,
    });
    const endReason: EndReason = resignedBy
      ? 'abandono'
      : chess.isCheckmate()
        ? 'mate'
        : chess.isStalemate()
          ? 'ahogado'
          : 'regla';

    const { playerColor, levelId } = get();
    chess.header('Event', 'Partida local ELOmax');
    chess.header('Site', 'ELOmax');
    chess.header('Date', new Date().toISOString().slice(0, 10).replaceAll('-', '.'));
    chess.header('White', playerColor === 'w' ? 'Usuario' : `Motor local (${levelId})`);
    chess.header('Black', playerColor === 'b' ? 'Usuario' : `Motor local (${levelId})`);
    chess.header('Result', resultado);

    const record = buildGameRecord({
      pgn: chess.pgn(),
      resultado,
      tiemposPorJugadaMs: moveTimesMs,
      fuente: 'local',
      ritmo: 'sin-reloj',
    });
    await gameRepo.save(record);
    snapshot({ phase: 'ended', resultado, endReason, saved: true, thinking: false });
  }

  async function engineTurn() {
    snapshot({ thinking: true });
    turnStartedAt = performance.now();
    try {
      const uci = await engine.bestMove(chess.fen(), levelById(get().levelId));
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const promotion = uci.slice(4, 5) || undefined;
      chess.move({ from, to, promotion });
      moveTimesMs.push(Math.round(performance.now() - turnStartedAt));
      turnStartedAt = performance.now();
      if (isOver()) {
        await finish();
      } else {
        snapshot({ thinking: false, lastMove: [from, to] });
      }
    } catch {
      snapshot({ thinking: false, engineError: true });
    }
  }

  return {
    phase: 'setup',
    fen: chess.fen(),
    turn: 'w',
    playerColor: 'w',
    levelId: ENGINE_LEVELS[0].id,
    sanMoves: [],
    lastMove: null,
    check: false,
    dests: new Map(),
    thinking: false,
    pendingPromotion: null,
    resultado: null,
    endReason: null,
    saved: false,
    engineError: false,

    async start(levelId, color) {
      const playerColor: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
      chess.reset();
      moveTimesMs = [];
      set({ phase: 'loading', levelId, playerColor, engineError: false, resultado: null, endReason: null, saved: false, lastMove: null, pendingPromotion: null });
      try {
        await engine.init();
      } catch {
        set({ phase: 'setup', engineError: true });
        return;
      }
      snapshot({ phase: 'playing', thinking: false });
      turnStartedAt = performance.now();
      if (playerColor === 'b') {
        await engineTurn();
      }
    },

    async userMove(from, to, promotion) {
      if (get().phase !== 'playing' || get().thinking) return;
      const candidate = chess
        .moves({ verbose: true })
        .find((m) => m.from === from && m.to === to && (promotion ? m.promotion === promotion : true));
      if (!candidate) {
        snapshot(); // jugada ilegal: re-sincroniza el tablero
        return;
      }
      if (candidate.promotion && !promotion) {
        snapshot({ pendingPromotion: { from, to } });
        return;
      }
      chess.move({ from, to, promotion });
      moveTimesMs.push(Math.round(performance.now() - turnStartedAt));
      turnStartedAt = performance.now();
      snapshot({ lastMove: [from, to], pendingPromotion: null });
      if (isOver()) {
        await finish();
      } else {
        await engineTurn();
      }
    },

    cancelPromotion() {
      snapshot({ pendingPromotion: null });
    },

    async resign() {
      if (get().phase !== 'playing') return;
      await finish(get().playerColor);
    },

    reset() {
      chess.reset();
      moveTimesMs = [];
      set({
        phase: 'setup',
        fen: chess.fen(),
        turn: 'w',
        sanMoves: [],
        lastMove: null,
        check: false,
        dests: new Map(),
        thinking: false,
        pendingPromotion: null,
        resultado: null,
        endReason: null,
        saved: false,
        engineError: false,
      });
    },
  };
});
