// Conversión de ventajas (E8, RF-8.1/8.3): rejugar contra el motor local una
// posición ganadora que se desperdició en una partida propia.
//
// El PRD pide Maia como defensor (RF-8.1) porque un humano pone trampas
// prácticas y el motor no; con Lichess inalcanzable desde este entorno, RF-8.3
// autoriza el motor local siempre que la limitación se declare. Se juega contra
// un nivel intermedio y no a máxima fuerza: el objetivo es practicar la técnica
// de conversión, no descubrir que Stockfish defiende mejor que un campeón.
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { Color, GameRecord } from '../../core/types';
import type { EngineLevel, EnginePort } from '../../core/ports';
import { evaluarConversion, ventajasDesperdiciadas, type ResultadoConversion, type VentajaDesperdiciada } from '../../core/conversion';
import { engine } from '../../services/engine/stockfishEngine';
import { gameRepo } from '../../services/storage/gameRepo';
import { computeDests } from './chessBoardUtils';

/** Profundidad para leer la evaluación de la posición tras cada jugada del usuario. */
const CONVERSION_EVAL_DEPTH = 12;
/**
 * Defensa firme pero no perfecta. RF-8.3 pide señalar que la resistencia del
 * motor no es humana; bajar la fuerza acerca el ejercicio a una defensa
 * realista en vez de convertirlo en un final de estudio.
 */
const CONVERSION_LEVEL: EngineLevel = { id: 'conversion', skill: 8, movetimeMs: 600 };

type Phase = 'lista' | 'cargando' | 'jugando' | 'feedback' | 'error';

export interface ConversionState {
  phase: Phase;
  ventajas: VentajaDesperdiciada[];
  ventaja: VentajaDesperdiciada | null;
  fen: string;
  turn: Color;
  playerColor: Color;
  dests: Map<string, string[]>;
  lastMove: [Square, Square] | null;
  check: boolean;
  thinking: boolean;
  pendingPromotion: { from: Square; to: Square } | null;
  resultado: ResultadoConversion | null;
  engineError: boolean;

  cargar(): Promise<void>;
  empezar(gameId: string): Promise<void>;
  userMove(from: Square, to: Square, promotion?: string): Promise<void>;
  cancelPromotion(): void;
  volver(): void;
}

interface ConversionDeps {
  enginePort: EnginePort;
  games: Pick<typeof gameRepo, 'list'>;
}

export function createConversionStore(deps: ConversionDeps) {
  let chess = new Chess();

  return create<ConversionState>((set, get) => {
    function snapshot(partial: Partial<ConversionState> = {}) {
      set({
        fen: chess.fen(),
        turn: chess.turn() as Color,
        dests: computeDests(chess),
        check: chess.inCheck(),
        ...partial,
      });
    }

    /** Ventaja del usuario en centipeones a partir de una evaluación del motor. */
    function ventajaUsuario(cp: number | null, mateIn: number | null, quienMueve: Color): number {
      const playerColor = get().playerColor;
      // `evaluate` devuelve la evaluación desde la perspectiva de quien mueve.
      const desdeElUsuario = quienMueve === playerColor ? 1 : -1;
      if (mateIn !== null) return mateIn * desdeElUsuario > 0 ? 10_000 : -10_000;
      return (cp ?? 0) * desdeElUsuario;
    }

    async function terminarSiCorresponde(): Promise<boolean> {
      if (!chess.isGameOver()) return false;
      const usuarioGano = chess.isCheckmate() && chess.turn() !== get().playerColor;
      snapshot({ phase: 'feedback', thinking: false, resultado: evaluarConversion(0, true, usuarioGano) });
      return true;
    }

    return {
      phase: 'lista',
      ventajas: [],
      ventaja: null,
      fen: chess.fen(),
      turn: 'w',
      playerColor: 'w',
      dests: new Map(),
      lastMove: null,
      check: false,
      thinking: false,
      pendingPromotion: null,
      resultado: null,
      engineError: false,

      async cargar() {
        const games: GameRecord[] = await deps.games.list();
        set({ phase: 'lista', ventajas: ventajasDesperdiciadas(games), ventaja: null, resultado: null });
      },

      async empezar(gameId) {
        const ventaja = get().ventajas.find((candidata) => candidata.gameId === gameId);
        if (!ventaja) return;
        chess = new Chess(ventaja.fen);
        const playerColor = chess.turn() as Color;
        set({ phase: 'cargando', ventaja, playerColor, resultado: null, engineError: false, pendingPromotion: null, lastMove: null });
        try {
          await deps.enginePort.init();
        } catch {
          snapshot({ phase: 'error', engineError: true });
          return;
        }
        snapshot({ phase: 'jugando', thinking: false });
      },

      async userMove(from, to, promotion) {
        const s = get();
        if (s.phase !== 'jugando' || s.thinking || chess.turn() !== s.playerColor) return;
        const candidate = chess.moves({ verbose: true }).find((move) => move.from === from && move.to === to);
        if (!candidate) {
          snapshot();
          return;
        }
        if (candidate.promotion && !promotion) {
          snapshot({ pendingPromotion: { from, to } });
          return;
        }
        chess.move({ from, to, promotion });
        snapshot({ lastMove: [from, to], pendingPromotion: null, thinking: true });
        if (await terminarSiCorresponde()) return;

        // Se lee la evaluación antes de que responda el motor: lo que se mide
        // es si la ventaja sigue ahí después de la jugada del usuario.
        try {
          const evaluacion = await deps.enginePort.evaluate(chess.fen(), CONVERSION_EVAL_DEPTH);
          const ventajaActual = ventajaUsuario(evaluacion.cp, evaluacion.mateIn, chess.turn() as Color);
          const veredicto = evaluarConversion(ventajaActual, false, false);
          if (veredicto === 'perdida') {
            snapshot({ phase: 'feedback', thinking: false, resultado: 'perdida' });
            return;
          }
          const uci = await deps.enginePort.bestMove(chess.fen(), CONVERSION_LEVEL);
          if (get().phase !== 'jugando') return;
          const engineFrom = uci.slice(0, 2) as Square;
          const engineTo = uci.slice(2, 4) as Square;
          chess.move({ from: engineFrom, to: engineTo, promotion: uci.slice(4, 5) || undefined });
          snapshot({ lastMove: [engineFrom, engineTo], thinking: false });
          await terminarSiCorresponde();
        } catch {
          snapshot({ thinking: false, engineError: true });
        }
      },

      cancelPromotion() {
        snapshot({ pendingPromotion: null });
      },

      volver() {
        chess = new Chess();
        set({ phase: 'lista', ventaja: null, resultado: null, thinking: false, pendingPromotion: null, engineError: false });
      },
    };
  });
}

export const useConversionStore = createConversionStore({ enginePort: engine, games: gameRepo });
