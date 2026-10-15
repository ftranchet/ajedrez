// Adaptador de la interfaz de programación de Lichess para jugar contra los
// bots Maia (RF-1.4, ADR-0004).
//
// **Advertencia de verificación.** Este es el único módulo del proyecto que no
// se puede ejercitar desde el entorno de desarrollo: `lichess.org` no es
// alcanzable desde ahí. Sí lo es desde el navegador del usuario —la app es
// client-side y la llamada sale de su máquina—, así que la función existe; lo
// que no existe es una prueba automática de punta a punta. Por eso todo lo
// interpretable vive en `core/maia.ts` con tests, y acá queda solo el transporte:
// cuanto más delgado sea este archivo, menos hay que verificar a mano.
//
// Endpoints usados (todos con CORS abierto y token personal por cabecera):
//   GET  /api/account                        validar token
//   GET  /api/stream/event                   saber cuándo arranca la partida
//   POST /api/challenge/{bot}                desafiar
//   GET  /api/board/game/stream/{id}         seguir la partida
//   POST /api/board/game/{id}/move/{uci}     jugar
//   POST /api/board/game/{id}/resign         abandonar
//   GET  /game/export/{id}                   PGN final
import { colorDelUsuario, falloDesdeEstadoHttp } from '../../core/maia';
import type { EstadoPartidaLichess, LichessPort, PartidaLichessIniciada } from '../../core/ports';

const BASE = 'https://lichess.org';

/** Error con motivo explicable, para que la interfaz no diga solo "falló". */
export class LichessError extends Error {
  constructor(public readonly motivo: ReturnType<typeof falloDesdeEstadoHttp> | 'sin-conexion') {
    super(motivo);
    this.name = 'LichessError';
  }
}

async function pedir(token: string, ruta: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  } catch {
    // Falla de red, DNS o CORS: no hay estado HTTP que interpretar.
    throw new LichessError('sin-conexion');
  }
  if (!response.ok) throw new LichessError(falloDesdeEstadoHttp(response.status));
  return response;
}

/**
 * Lee un stream ndjson y entrega cada objeto. Lichess mantiene estas conexiones
 * abiertas y envía líneas vacías como latido, que se descartan.
 */
async function* leerNdjson(response: Response, signal: AbortSignal): AsyncGenerator<Record<string, unknown>> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lineas = buffer.split('\n');
      buffer = lineas.pop() ?? '';
      for (const linea of lineas) {
        const texto = linea.trim();
        if (texto === '') continue; // latido
        try {
          yield JSON.parse(texto) as Record<string, unknown>;
        } catch {
          // Una línea corrupta no puede cortar la partida en curso.
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/**
 * Cierra un stream que se abrió y no se llegó a leer. Si ya se estaba leyendo,
 * lo cerró `leerNdjson` al salir y el cuerpo sigue bloqueado por ese lector.
 */
async function cerrarSinLeer(response: Response): Promise<void> {
  if (response.body && !response.body.locked) await response.body.cancel().catch(() => {});
}

/**
 * Cuánto se espera la respuesta del bot. Un desafío creado sin
 * `keepAliveStream` vence a los 20 s si nadie lo acepta, y el stream no siempre
 * lo avisa: pasado este margen ya no puede llegar el `gameStart`.
 */
export const ESPERA_RESPUESTA_MS = 30_000;

/** Id de un desafío: la respuesta del POST lo trae en la raíz, o bajo `challenge` en el formato viejo. */
function idDeDesafio(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const objeto = raw as { id?: unknown; challenge?: { id?: unknown } };
  if (typeof objeto.id === 'string') return objeto.id;
  return typeof objeto.challenge?.id === 'string' ? objeto.challenge.id : null;
}

function estadoDesde(raw: Record<string, unknown>): EstadoPartidaLichess {
  return {
    moves: typeof raw.moves === 'string' ? raw.moves : '',
    status: typeof raw.status === 'string' ? raw.status : 'started',
    ...(raw.winner === 'white' || raw.winner === 'black' ? { winner: raw.winner } : {}),
  };
}

export class LichessClient implements LichessPort {
  async cuenta(token: string): Promise<{ username: string }> {
    const response = await pedir(token, '/api/account');
    const data = (await response.json()) as { username?: string };
    if (!data.username) throw new LichessError('token-invalido');
    return { username: data.username };
  }

  async desafiarBot(
    token: string,
    bot: string,
    control: { minutos: number; incremento: number },
    signal: AbortSignal,
  ): Promise<PartidaLichessIniciada> {
    const { username } = await this.cuenta(token);

    // Señal propia de la espera: se corta si el llamador cancela o si el bot
    // no contesta a tiempo. Sin esto, un bot caído dejaba la pantalla en
    // "buscando partida" para siempre.
    const espera = new AbortController();
    const cancelar = () => espera.abort();
    if (signal.aborted) espera.abort();
    signal.addEventListener('abort', cancelar, { once: true });
    let vencida = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let eventos: Response | null = null;

    try {
      // El stream de eventos se abre ANTES de desafiar: si el bot acepta rápido,
      // el `gameStart` llega antes de que alcancemos a escuchar y la partida
      // quedaría empezada sin que la app se entere.
      eventos = await pedir(token, '/api/stream/event', { signal: espera.signal });

      const cuerpo = new URLSearchParams({
        rated: 'false',
        'clock.limit': String(control.minutos * 60),
        'clock.increment': String(control.incremento),
        color: 'random',
        variant: 'standard',
      });
      const respuesta = await pedir(token, `/api/challenge/${bot}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cuerpo.toString(),
        signal: espera.signal,
      });
      // La partida que nace del desafío lleva su mismo id. Sin él no hay forma
      // de reconocerla: al conectarse, Lichess manda un `gameStart` por cada
      // partida en curso del usuario, y tomar el primero hacía que la app
      // "jugara" una partida por correspondencia abierta.
      const desafioId = idDeDesafio(await respuesta.json().catch(() => null));
      if (!desafioId) throw new LichessError('desconocido');

      temporizador = setTimeout(() => {
        vencida = true;
        espera.abort();
      }, ESPERA_RESPUESTA_MS);

      for await (const evento of leerNdjson(eventos, espera.signal)) {
        if (evento.type === 'gameStart') {
          const game = evento.game as Record<string, unknown> | undefined;
          const gameId = typeof game?.gameId === 'string' ? game.gameId : typeof game?.id === 'string' ? game.id : null;
          if (gameId !== desafioId) continue;
          clearTimeout(temporizador);
          return await this.primerEstado(token, gameId, username, signal);
        }
        if (evento.type === 'challengeDeclined' || evento.type === 'challengeCanceled') {
          // Rechazado o cancelado: que el bot no juegue es un desenlace normal.
          if (idDeDesafio(evento.challenge) === desafioId) throw new LichessError('bot-no-disponible');
        }
      }
      throw new LichessError('bot-no-disponible');
    } catch (error) {
      // Vencida la espera, la lectura falla por el corte: lo que pasó es que
      // el bot no contestó.
      if (vencida && !signal.aborted) throw new LichessError('bot-no-disponible');
      throw error;
    } finally {
      clearTimeout(temporizador);
      signal.removeEventListener('abort', cancelar);
      // Si el desafío falló antes de leer, el stream de eventos seguía abierto.
      if (eventos) await cerrarSinLeer(eventos);
    }
  }

  /** Primer mensaje del stream de la partida (`gameFull`): trae colores y estado. */
  private async primerEstado(
    token: string,
    gameId: string,
    username: string,
    signal: AbortSignal,
  ): Promise<PartidaLichessIniciada> {
    const response = await pedir(token, `/api/board/game/stream/${gameId}`, { signal });
    for await (const mensaje of leerNdjson(response, signal)) {
      if (mensaje.type !== 'gameFull') continue;
      const white = mensaje.white as { id?: string; name?: string } | undefined;
      const black = mensaje.black as { id?: string; name?: string } | undefined;
      const color = colorDelUsuario({ white, black }, username);
      if (!color) throw new LichessError('desconocido');
      return {
        gameId,
        color,
        rival: (color === 'w' ? black?.name : white?.name) ?? 'Maia',
        estadoInicial: estadoDesde((mensaje.state as Record<string, unknown>) ?? {}),
      };
    }
    throw new LichessError('desconocido');
  }

  async seguirPartida(
    token: string,
    gameId: string,
    onEstado: (estado: EstadoPartidaLichess) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const response = await pedir(token, `/api/board/game/stream/${gameId}`, { signal });
    for await (const mensaje of leerNdjson(response, signal)) {
      if (mensaje.type === 'gameFull') {
        onEstado(estadoDesde((mensaje.state as Record<string, unknown>) ?? {}));
      } else if (mensaje.type === 'gameState') {
        onEstado(estadoDesde(mensaje));
      }
    }
  }

  async enviarJugada(token: string, gameId: string, uci: string): Promise<void> {
    await pedir(token, `/api/board/game/${gameId}/move/${uci}`, { method: 'POST' });
  }

  async abandonar(token: string, gameId: string): Promise<void> {
    await pedir(token, `/api/board/game/${gameId}/resign`, { method: 'POST' });
  }

  async pgn(token: string, gameId: string): Promise<string> {
    const response = await pedir(token, `/game/export/${gameId}?clocks=false&evals=false`, {
      headers: { Accept: 'application/x-chess-pgn' },
    });
    return response.text();
  }
}

export const lichessClient: LichessPort = new LichessClient();
