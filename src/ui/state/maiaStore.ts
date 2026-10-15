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
  esFalloDefinitivo,
  esperaParaReintentar,
  jugadasDeEstado,
  partidaEnCurso,
  resultadoDesdeLichess,
  type FalloMaia,
} from '../../core/maia';
import { buildGameRecord } from '../../core/game';
import { LichessError, lichessClient } from '../../services/lichess/lichessClient';
import { gameRepo } from '../../services/storage/gameRepo';
import { registrarTiempoEntrenado } from '../../services/storage/trainingEventRepo';
import { computeDests } from './chessBoardUtils';

type Phase = 'inactivo' | 'desafiando' | 'jugando' | 'terminada' | 'error';

/**
 * Una jugada propia que no llegó a Lichess por un fallo pasajero (B12). La
 * partida sigue: o se está volviendo a mandar sola, o se agotaron los
 * reintentos y volvió al tablero para que el usuario la haga de nuevo.
 */
export interface AvisoEnvio {
  estado: 'reintentando' | 'sin-enviar';
  fallo: FalloMaia;
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  avisoEnvio: AvisoEnvio | null;
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
  /**
   * Cuándo arrancó la partida en curso, para medir su tiempo (RF-13.4). Vive
   * dentro de la fábrica: como variable de módulo, dos instancias la
   * compartían y una partida podía registrar el tiempo de otra, o ninguno.
   */
  let inicioMs: number | null = null;

  return create<MaiaState>((set, get) => {
    /** Último estado confirmado por el servidor, para revertir una jugada rechazada. */
    let ultimoEstadoConfirmado: EstadoPartidaLichess | null = null;
    /**
     * La jugada propia que todavía no confirmó nadie, con el ply en el que se
     * jugó. Mientras exista el tablero no acepta otra, aunque el stream lo
     * reconstruya en el medio: así un reintento nunca viaja junto con una
     * jugada nueva.
     */
    let jugadaEnViaje: { ply: number } | null = null;

    /** Reconstruye el tablero desde la lista de jugadas que manda Lichess. */
    function aplicarEstado(estado: EstadoPartidaLichess) {
      ultimoEstadoConfirmado = estado;
      const jugadas = jugadasDeEstado(estado.moves);
      // Si Lichess ya tiene una jugada en ese ply, la propia llegó (aunque se
      // haya perdido la respuesta del envío): no queda nada por reintentar.
      const llego = jugadaEnViaje !== null && jugadas.length > jugadaEnViaje.ply;
      if (llego) jugadaEnViaje = null;
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
        enviando: jugadaEnViaje !== null,
        ...(llego ? { avisoEnvio: null } : {}),
      });

      if (!partidaEnCurso(estado.status)) {
        void finalizar(estado);
      }
    }

    async function finalizar(estado: EstadoPartidaLichess) {
      const s = get();
      if (s.phase === 'terminada') return;
      const resultado = resultadoDesdeLichess(estado.status, estado.winner);
      jugadaEnViaje = null;
      set({ phase: 'terminada', resultadoTexto: estado.status, enviando: false, avisoEnvio: null });
      abort?.abort();

      // La partida se guarda con `fuente: 'lichess'` para que entre al ciclo
      // normal: aparece en el Panel, se analiza en dos fases y sus errores van
      // a la Cola. Es el punto de todo esto — jugar contra un rival realista y
      // después analizarlo es el ejercicio tier-S del proyecto.
      if (!s.gameId || s.guardada) return;
      try {
        const pgn = await deps.lichess.pgn(tokenActual, s.gameId);
        const record = buildGameRecord({
            pgn,
            resultado,
            tiemposPorJugadaMs: [],
            fuente: 'lichess',
            // Con reloj de Lichess: es una partida lenta de verdad, y así entra
            // al compromiso semanal (RF-11.7) y al detector de sobreajuste.
            ritmo: 'clasica',
            jugadorColor: s.playerColor,
        });
        await deps.games.save(record);
        // Igual que la partida local: el tiempo jugado suma al plan (RF-13.4).
        if (inicioMs !== null) {
          registrarTiempoEntrenado('partida', record.id, Date.now() - inicioMs);
          inicioMs = null;
        }
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
      avisoEnvio: null,
      resultadoTexto: null,

      async empezar(token, bot) {
        if (get().phase === 'desafiando' || get().phase === 'jugando') return;
        tokenActual = token;
        abort?.abort();
        const intento = new AbortController();
        abort = intento;
        chess = new Chess();
        ultimoEstadoConfirmado = null;
        jugadaEnViaje = null;
        set({
          phase: 'desafiando', bot, fallo: null, gameId: null, rival: '', guardada: false,
          resultadoTexto: null, sanMoves: [], lastMove: null, enviando: false, avisoEnvio: null,
        });
        try {
          const partida = await deps.lichess.desafiarBot(token, bot, CONTROL_LENTO, intento.signal);
          if (intento.signal.aborted) return;
          inicioMs = Date.now();
          set({ phase: 'jugando', gameId: partida.gameId, playerColor: partida.color, rival: partida.rival });
          aplicarEstado(partida.estadoInicial);
          // El seguimiento queda corriendo: cada `gameState` reescribe el tablero.
          void deps.lichess
            .seguirPartida(token, partida.gameId, aplicarEstado, intento.signal)
            .catch(() => {
              if (get().phase === 'jugando') set({ phase: 'error', fallo: 'sin-conexion' });
            });
        } catch (error) {
          // Cancelar la búsqueda corta la espera y la hace fallar: eso no es un
          // error de Lichess, y el usuario ya está en otra pantalla.
          if (intento.signal.aborted) return;
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
        const enViaje = { ply: chess.history().length };

        // La jugada se aplica en el acto. La versión anterior esperaba a que el
        // stream la devolviera para pintarla, con la idea de "no mostrar lo que
        // Lichess no confirmó"; el resultado visible era que la pieza soltada
        // volvía de un salto a su casilla y reaparecía en destino un segundo
        // después, a veces junto con la respuesta de Maia. El estado remoto
        // sigue siendo la autoridad —`aplicarEstado` reconstruye desde la lista
        // de jugadas y revierte esto si Lichess no la aceptó—, pero mientras
        // tanto el tablero muestra lo que el usuario hizo.
        chess.move({ from, to, promotion: promo });
        jugadaEnViaje = enViaje;
        set({
          fen: chess.fen(),
          turn: chess.turn() as Color,
          dests: computeDests(chess),
          check: chess.inCheck(),
          sanMoves: chess.history(),
          lastMove: [from, to],
          enviando: true,
          avisoEnvio: null,
        });

        // Un fallo pasajero (un 429, un corte de red) no saca de la partida:
        // en Lichess sigue corriendo el reloj, y el stream sigue vivo. Se
        // reintenta con espera; solo un fallo definitivo termina en error.
        for (let intento = 0; ; intento++) {
          try {
            await deps.lichess.enviarJugada(tokenActual, s.gameId, uci);
            if (jugadaEnViaje === enViaje) {
              jugadaEnViaje = null;
              set({ enviando: false, avisoEnvio: null });
            }
            return;
          } catch (error) {
            // El stream ya la confirmó, o el usuario salió de la partida.
            if (jugadaEnViaje !== enViaje) return;
            const fallo = (error instanceof LichessError ? error.motivo : 'desconocido') as FalloMaia;
            const espera = esperaParaReintentar(fallo, intento);
            if (espera === null) {
              // Rechazada: se vuelve a la posición confirmada por el servidor.
              jugadaEnViaje = null;
              if (ultimoEstadoConfirmado) aplicarEstado(ultimoEstadoConfirmado);
              set(
                esFalloDefinitivo(fallo)
                  ? { enviando: false, phase: 'error', fallo }
                  : { enviando: false, avisoEnvio: { estado: 'sin-enviar', fallo } },
              );
              return;
            }
            set({ avisoEnvio: { estado: 'reintentando', fallo } });
            await esperar(espera);
            if (jugadaEnViaje !== enViaje) return;
          }
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
        jugadaEnViaje = null;
        set({
          phase: 'inactivo', gameId: null, rival: '', fallo: null, guardada: false,
          resultadoTexto: null, sanMoves: [], lastMove: null, enviando: false, avisoEnvio: null,
          fen: chess.fen(), turn: 'w', dests: new Map(), check: false,
        });
      },
    };
  });
}

export const useMaiaStore = createMaiaStore({ lichess: lichessClient, games: gameRepo });
