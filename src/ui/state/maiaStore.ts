// Partida contra un bot Maia vía Lichess (RF-1.4, ADR-0004).
//
// A diferencia de `gameStore`, acá el rival vive en un servidor ajeno: el
// tablero local es un espejo del estado que manda Lichess, nunca la fuente de
// verdad. Cada actualización del stream trae la lista completa de jugadas y el
// tablero se reconstruye desde ahí; así una jugada perdida o un reintento no
// dejan las dos puntas desincronizadas.
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { Color } from '../../core/types';
import type { EstadoPartidaLichess, LichessPort } from '../../core/ports';
import {
  BOTS_MAIA,
  CONTROL_LENTO,
  jugadasDeEstado,
  partidaEnCurso,
  resultadoDesdeLichess,
  type FalloMaia,
} from '../../core/maia';
import { buildGameRecord } from '../../core/game';
import { LichessError, lichessClient } from '../../services/lichess/lichessClient';
import { gameRepo } from '../../services/storage/gameRepo';
import { computeDests } from './chessBoardUtils';

type Phase = 'inactivo' | 'desafiando' | 'jugando' | 'terminada' | 'error';

export interface MaiaState {
  phase: Phase;
  bot: string;
  rival: string;
  gameId: string | null;
  fallo: FalloMaia | null;
  /** La partida terminada ya quedó guardada en el historial local. */
  guardada: boolean;

  fen: string;
  turn: Color;
  playerColor: Color;
  dests: Map<string, string[]>;
  lastMove: [Square, Square] | null;
  check: boolean;
  sanMoves: string[];
  /** Una jugada propia viajando a Lichess: el tablero no acepta otra mientras tanto. */
  enviando: boolean;
  resultadoTexto: string | null;

  empezar(token: string, bot: string): Promise<void>;
  userMove(from: Square, to: Square, promotion?: string): Promise<void>;
  abandonar(token: string): Promise<void>;
  volver(): void;
}

interface MaiaDeps {
  lichess: LichessPort;
  games: Pick<typeof gameRepo, 'save'>;
}

export function createMaiaStore(deps: MaiaDeps) {
  let chess = new Chess();
  let abort: AbortController | null = null;

  return create<MaiaState>((set, get) => {
    /** Último estado confirmado por el servidor, para revertir una jugada rechazada. */
    let ultimoEstadoConfirmado: EstadoPartidaLichess | null = null;

    /** Reconstruye el tablero desde la lista de jugadas que manda Lichess. */
    function aplicarEstado(estado: EstadoPartidaLichess) {
      ultimoEstadoConfirmado = estado;
      const jugadas = jugadasDeEstado(estado.moves);
      const replay = new Chess();
      let ultima: [Square, Square] | null = null;
      for (const uci of jugadas) {
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promotion = uci.slice(4, 5) || undefined;
        try {
          replay.move({ from, to, promotion });
          ultima = [from, to];
        } catch {
          break; // estado inconsistente: se conserva lo reproducible
        }
      }
      chess = replay;
      set({
        fen: chess.fen(),
        turn: chess.turn() as Color,
        dests: computeDests(chess),
        check: chess.inCheck(),
        sanMoves: chess.history(),
        lastMove: ultima,
        enviando: false,
      });

      if (!partidaEnCurso(estado.status)) {
        void finalizar(estado);
      }
    }

    async function finalizar(estado: EstadoPartidaLichess) {
      const s = get();
      if (s.phase === 'terminada') return;
      const resultado = resultadoDesdeLichess(estado.status, estado.winner);
      set({ phase: 'terminada', resultadoTexto: estado.status });
      abort?.abort();

      // La partida se guarda con `fuente: 'lichess'` para que entre al ciclo
      // normal: aparece en el Panel, se analiza en dos fases y sus errores van
      // a la Cola. Es el punto de todo esto — jugar contra un rival realista y
      // después analizarlo es el ejercicio tier-S del proyecto.
      if (!s.gameId || s.guardada) return;
      try {
        const pgn = await deps.lichess.pgn(tokenActual, s.gameId);
        await deps.games.save(
          buildGameRecord({
            pgn,
            resultado,
            tiemposPorJugadaMs: [],
            fuente: 'lichess',
            // Con reloj de Lichess: es una partida lenta de verdad, y así entra
            // al compromiso semanal (RF-11.7) y al detector de sobreajuste.
            ritmo: 'clasica',
            jugadorColor: s.playerColor,
          }),
        );
        set({ guardada: true });
      } catch {
        // No poder traer el PGN no borra la partida de Lichess: se avisa y el
        // usuario puede importarla a mano desde el Panel.
        set({ guardada: false });
      }
    }

    let tokenActual = '';

    return {
      phase: 'inactivo',
      bot: BOTS_MAIA[0].usuario,
      rival: '',
      gameId: null,
      fallo: null,
      guardada: false,
      fen: new Chess().fen(),
      turn: 'w',
      playerColor: 'w',
      dests: new Map(),
      lastMove: null,
      check: false,
      sanMoves: [],
      enviando: false,
      resultadoTexto: null,

      async empezar(token, bot) {
        if (get().phase === 'desafiando' || get().phase === 'jugando') return;
        tokenActual = token;
        abort?.abort();
        abort = new AbortController();
        chess = new Chess();
        ultimoEstadoConfirmado = null;
        set({
          phase: 'desafiando', bot, fallo: null, gameId: null, rival: '', guardada: false,
          resultadoTexto: null, sanMoves: [], lastMove: null, enviando: false,
        });
        try {
          const partida = await deps.lichess.desafiarBot(token, bot, CONTROL_LENTO, abort.signal);
          set({ phase: 'jugando', gameId: partida.gameId, playerColor: partida.color, rival: partida.rival });
          aplicarEstado(partida.estadoInicial);
          // El seguimiento queda corriendo: cada `gameState` reescribe el tablero.
          void deps.lichess
            .seguirPartida(token, partida.gameId, aplicarEstado, abort.signal)
            .catch(() => {
              if (get().phase === 'jugando') set({ phase: 'error', fallo: 'sin-conexion' });
            });
        } catch (error) {
          const motivo = error instanceof LichessError ? error.motivo : 'desconocido';
          set({ phase: 'error', fallo: motivo as FalloMaia });
        }
      },

      async userMove(from, to, promotion) {
        const s = get();
        if (s.phase !== 'jugando' || s.enviando || !s.gameId) return;
        // El tablero se reconstruye desde el stream, así que su turno ES el
        // turno real de la partida en Lichess.
        if (chess.turn() !== s.playerColor) return;
        const candidate = chess.moves({ verbose: true }).find((m) => m.from === from && m.to === to);
        if (!candidate) {
          set({ fen: chess.fen(), dests: computeDests(chess) });
          return;
        }
        const promo = promotion ?? (candidate.promotion ? 'q' : undefined);
        const uci = from + to + (promo ?? '');

        // La jugada se aplica en el acto. La versión anterior esperaba a que el
        // stream la devolviera para pintarla, con la idea de "no mostrar lo que
        // Lichess no confirmó"; el resultado visible era que la pieza soltada
        // volvía de un salto a su casilla y reaparecía en destino un segundo
        // después, a veces junto con la respuesta de Maia. El estado remoto
        // sigue siendo la autoridad —`aplicarEstado` reconstruye desde la lista
        // de jugadas y revierte esto si Lichess no la aceptó—, pero mientras
        // tanto el tablero muestra lo que el usuario hizo.
        chess.move({ from, to, promotion: promo });
        set({
          fen: chess.fen(),
          turn: chess.turn() as Color,
          dests: computeDests(chess),
          check: chess.inCheck(),
          sanMoves: chess.history(),
          lastMove: [from, to],
          enviando: true,
        });

        try {
          await deps.lichess.enviarJugada(tokenActual, s.gameId, uci);
        } catch (error) {
          // Rechazada: se vuelve a la posición confirmada por el servidor.
          if (ultimoEstadoConfirmado) aplicarEstado(ultimoEstadoConfirmado);
          const motivo = error instanceof LichessError ? error.motivo : 'desconocido';
          set({ enviando: false, phase: 'error', fallo: motivo as FalloMaia });
        }
      },

      async abandonar(token) {
        const s = get();
        if (!s.gameId) {
          get().volver();
          return;
        }
        try {
          await deps.lichess.abandonar(token, s.gameId);
        } catch {
          // Si no se pudo avisar a Lichess, la partida queda abierta allá; el
          // usuario puede cerrarla desde su sitio. Localmente se sale igual.
        }
        get().volver();
      },

      volver() {
        abort?.abort();
        abort = null;
        chess = new Chess();
        ultimoEstadoConfirmado = null;
        set({
          phase: 'inactivo', gameId: null, rival: '', fallo: null, guardada: false,
          resultadoTexto: null, sanMoves: [], lastMove: null, enviando: false,
          fen: chess.fen(), turn: 'w', dests: new Map(), check: false,
        });
      },
    };
  });
}

export const useMaiaStore = createMaiaStore({ lichess: lichessClient, games: gameRepo });
