// El transporte de Lichess contra un `fetch` simulado. `lichess.org` no es
// alcanzable desde el entorno de desarrollo, pero lo que hay que verificar acá
// no es la red sino qué hace el cliente con lo que llega por el stream de
// eventos: reconocer la partida de SU desafío, entender un rechazo, no esperar
// para siempre y no dejar conexiones abiertas (B11).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESPERA_RESPUESTA_MS, LichessClient, LichessError } from './lichessClient';

const CONTROL = { minutos: 30, incremento: 20 };

/** Stream ndjson manejado desde el test. Como el de `fetch`, se corta al abortar la señal. */
function streamSimulado(signal?: AbortSignal | null) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelado = false;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      cancelado = true;
    },
  });
  signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
  const encoder = new TextEncoder();
  return {
    body,
    enviar(evento: unknown) {
      controller.enqueue(encoder.encode(`${JSON.stringify(evento)}\n`));
    },
    get cancelado() {
      return cancelado;
    },
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const gameFull = (gameId: string) => ({
  type: 'gameFull',
  id: gameId,
  white: { id: 'fran', name: 'fran' },
  black: { id: 'maia1', name: 'maia1' },
  state: { type: 'gameState', moves: '', status: 'started' },
});

/**
 * Lichess simulado. Al conectarse al stream de eventos manda un `gameStart`
 * por cada partida que el usuario ya tenía en curso, como el de verdad; qué
 * pasa después del desafío lo decide cada test con `alDesafiar`.
 */
function lichessSimulado(opciones: {
  enCurso?: string[];
  alDesafiar?: (eventos: ReturnType<typeof streamSimulado>) => Response;
}) {
  let eventos: ReturnType<typeof streamSimulado> | null = null;
  const partidasSeguidas: string[] = [];
  const fetchSimulado = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const ruta = new URL(String(input)).pathname;
    if (ruta === '/api/account') return json({ username: 'fran' });
    if (ruta === '/api/stream/event') {
      eventos = streamSimulado(init?.signal);
      for (const gameId of opciones.enCurso ?? []) eventos.enviar({ type: 'gameStart', game: { gameId, id: gameId } });
      return new Response(eventos.body);
    }
    if (ruta.startsWith('/api/challenge/')) {
      return opciones.alDesafiar?.(eventos!) ?? json({ id: 'desafio1', status: 'created' });
    }
    if (ruta.startsWith('/api/board/game/stream/')) {
      const gameId = ruta.split('/').pop()!;
      partidasSeguidas.push(gameId);
      const partida = streamSimulado(init?.signal);
      partida.enviar(gameFull(gameId));
      return new Response(partida.body);
    }
    return json({}, 404);
  });
  vi.stubGlobal('fetch', fetchSimulado);
  return {
    partidasSeguidas,
    get eventos() {
      return eventos!;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lichessClient.desafiarBot — la partida es la del desafío (B11)', () => {
  it('ignora los gameStart de otras partidas en curso y toma la de su desafío', async () => {
    const lichess = lichessSimulado({
      enCurso: ['corresp1'],
      alDesafiar: (eventos) => {
        // El rechazo de OTRO desafío tampoco es asunto de este.
        eventos.enviar({ type: 'challengeDeclined', challenge: { id: 'otro' } });
        eventos.enviar({ type: 'gameStart', game: { gameId: 'desafio1', id: 'desafio1' } });
        return json({ id: 'desafio1', status: 'created' });
      },
    });

    const partida = await new LichessClient().desafiarBot('token', 'maia1', CONTROL, new AbortController().signal);

    expect(partida.gameId).toBe('desafio1');
    expect(partida.color).toBe('w');
    expect(lichess.partidasSeguidas).toEqual(['desafio1']);
    expect(lichess.eventos.cancelado).toBe(true);
  });

  it('acepta el id del desafío en el formato viejo de la respuesta', async () => {
    lichessSimulado({
      alDesafiar: (eventos) => {
        eventos.enviar({ type: 'gameStart', game: { gameId: 'viejo1' } });
        return json({ challenge: { id: 'viejo1' }, socketVersion: 0 });
      },
    });

    const partida = await new LichessClient().desafiarBot('token', 'maia1', CONTROL, new AbortController().signal);
    expect(partida.gameId).toBe('viejo1');
  });

  it('un desafío rechazado es "bot no disponible", no una espera eterna', async () => {
    const lichess = lichessSimulado({
      alDesafiar: (eventos) => {
        eventos.enviar({ type: 'challengeDeclined', challenge: { id: 'desafio1', declineReasonKey: 'generic' } });
        return json({ id: 'desafio1', status: 'created' });
      },
    });

    const error = await new LichessClient()
      .desafiarBot('token', 'maia1', CONTROL, new AbortController().signal)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LichessError);
    expect((error as LichessError).motivo).toBe('bot-no-disponible');
    expect(lichess.eventos.cancelado).toBe(true);
  });

  it('un desafío cancelado también', async () => {
    lichessSimulado({
      alDesafiar: (eventos) => {
        eventos.enviar({ type: 'challengeCanceled', challenge: { id: 'desafio1' } });
        return json({ id: 'desafio1', status: 'created' });
      },
    });

    const error = await new LichessClient()
      .desafiarBot('token', 'maia1', CONTROL, new AbortController().signal)
      .catch((e: unknown) => e);
    expect((error as LichessError).motivo).toBe('bot-no-disponible');
  });

  it('si el bot no contesta, deja de esperar', async () => {
    vi.useFakeTimers();
    const lichess = lichessSimulado({ enCurso: ['corresp1'] });

    const resultado = new LichessClient()
      .desafiarBot('token', 'maia1', CONTROL, new AbortController().signal)
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(ESPERA_RESPUESTA_MS);

    const error = await resultado;
    expect(error).toBeInstanceOf(LichessError);
    expect((error as LichessError).motivo).toBe('bot-no-disponible');
    expect(lichess.partidasSeguidas).toEqual([]);
  });

  it('si el desafío falla, cierra el stream de eventos que había abierto', async () => {
    const lichess = lichessSimulado({ alDesafiar: () => json({ error: 'Too many requests' }, 429) });

    const error = await new LichessClient()
      .desafiarBot('token', 'maia1', CONTROL, new AbortController().signal)
      .catch((e: unknown) => e);

    expect((error as LichessError).motivo).toBe('limite-de-tasa');
    expect(lichess.eventos.cancelado).toBe(true);
  });
});
