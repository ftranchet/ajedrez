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

    // El stream de eventos se abre ANTES de desafiar: si el bot acepta rápido,
    // el `gameStart` llega antes de que alcancemos a escuchar y la partida
    // quedaría empezada sin que la app se entere.
    const eventos = await pedir(token, '/api/stream/event', { signal });

    const cuerpo = new URLSearchParams({
      rated: 'false',
      'clock.limit': String(control.minutos * 60),
      'clock.increment': String(control.incremento),
      color: 'random',
      variant: 'standard',
    });
    await pedir(token, `/api/challenge/${bot}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
      signal,
    });

    for await (const evento of leerNdjson(eventos, signal)) {
      if (evento.type !== 'gameStart') continue;
      const game = evento.game as Record<string, unknown> | undefined;
      const gameId = typeof game?.gameId === 'string' ? game.gameId : typeof game?.id === 'string' ? game.id : null;
      if (!gameId) continue;
      const estadoInicial = await this.primerEstado(token, gameId, username, signal);
      return estadoInicial;
    }
    throw new LichessError('bot-no-disponible');
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
