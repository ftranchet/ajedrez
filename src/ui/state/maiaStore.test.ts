// El flujo de Maia se prueba contra un doble del puerto de Lichess. Es la
// única forma disponible: `lichess.org` no es alcanzable desde el entorno de
// desarrollo (sí desde el navegador del usuario, que es donde la app corre),
// así que la verificación de punta a punta la hace una persona. Estos tests
// cubren lo que sí se puede cubrir: que el tablero refleje el estado remoto,
// que una jugada no se pinte antes de que Lichess la acepte, y que la partida
// terminada entre al ciclo de análisis.
import { describe, expect, it, vi } from 'vitest';
import type { EstadoPartidaLichess, LichessPort, PartidaLichessIniciada } from '../../core/ports';
import type { GameRecord } from '../../core/types';
import { createMaiaStore } from './maiaStore';
import { LichessError } from '../../services/lichess/lichessClient';

function crearDoble(overrides: Partial<LichessPort> = {}) {
  let emitir: ((estado: EstadoPartidaLichess) => void) | null = null;
  const guardadas: GameRecord[] = [];
  const inicio: PartidaLichessIniciada = {
    gameId: 'abc123',
    color: 'w',
    rival: 'maia1',
    estadoInicial: { moves: '', status: 'started' },
  };
  const lichess: LichessPort = {
    cuenta: async () => ({ username: 'fran' }),
    desafiarBot: async () => inicio,
    seguirPartida: async (_token, _gameId, onEstado) => {
      emitir = onEstado;
      await new Promise(() => {}); // el stream queda abierto
    },
    enviarJugada: async () => {},
    abandonar: async () => {},
    pgn: async () => '1. e4 e5 2. Nf3 Nc6 *',
    ...overrides,
  };
  const store = createMaiaStore({ lichess, games: { save: async (g) => { guardadas.push(g); } } });
  return { store, guardadas, emitir: (estado: EstadoPartidaLichess) => emitir?.(estado) };
}

describe('maiaStore — el tablero es un espejo del estado remoto', () => {
  it('arranca la partida y toma color y rival de Lichess', async () => {
    const { store } = crearDoble();
    await store.getState().empezar('token', 'maia1');

    const s = store.getState();
    expect(s.phase).toBe('jugando');
    expect(s.gameId).toBe('abc123');
    expect(s.playerColor).toBe('w');
    expect(s.rival).toBe('maia1');
  });

  it('reconstruye el tablero desde la lista completa de jugadas', async () => {
    const { store, emitir } = crearDoble();
    await store.getState().empezar('token', 'maia1');

    emitir({ moves: 'e2e4 e7e5 g1f3', status: 'started' });

    const s = store.getState();
    expect(s.sanMoves).toEqual(['e4', 'e5', 'Nf3']);
    expect(s.turn).toBe('b');
    expect(s.lastMove).toEqual(['g1', 'f3']);
  });

  // Esperar al stream para pintar la jugada propia hacía que la pieza soltada
  // volviera de un salto a su casilla y reapareciera en destino un segundo
  // después. Ahora se aplica en el acto y el servidor sigue siendo la autoridad.
  it('la jugada propia se ve en el acto, sin esperar al servidor', async () => {
    const enviarJugada = vi.fn(async () => {});
    const { store, emitir } = crearDoble({ enviarJugada });
    await store.getState().empezar('token', 'maia1');

    await store.getState().userMove('e2' as never, 'e4' as never);

    expect(enviarJugada).toHaveBeenCalledWith('token', 'abc123', 'e2e4');
    expect(store.getState().sanMoves).toEqual(['e4']);
    expect(store.getState().lastMove).toEqual(['e2', 'e4']);

    // Cuando el servidor confirma esa misma jugada, la posición no cambia: no
    // hay salto ni re-animación.
    emitir({ moves: 'e2e4', status: 'started' });
    expect(store.getState().sanMoves).toEqual(['e4']);
    expect(store.getState().enviando).toBe(false);
  });

  it('si Lichess rechaza la jugada, el tablero vuelve a la posición confirmada', async () => {
    const { store, emitir } = crearDoble({
      enviarJugada: async () => {
        throw new LichessError('desconocido');
      },
    });
    await store.getState().empezar('token', 'maia1');
    emitir({ moves: '', status: 'started' });

    await store.getState().userMove('e2' as never, 'e4' as never);

    expect(store.getState().sanMoves).toEqual([]);
    expect(store.getState().phase).toBe('error');
  });

  // La respuesta de Maia llega como una jugada nueva sobre la posición que el
  // usuario ya está viendo: un solo ply de diferencia, que es lo que el tablero
  // puede animar bien.
  it('la respuesta del rival avanza un solo ply sobre lo ya mostrado', async () => {
    const { store, emitir } = crearDoble();
    await store.getState().empezar('token', 'maia1');

    await store.getState().userMove('e2' as never, 'e4' as never);
    emitir({ moves: 'e2e4 e7e5', status: 'started' });

    expect(store.getState().sanMoves).toEqual(['e4', 'e5']);
    expect(store.getState().lastMove).toEqual(['e7', 'e5']);
    expect(store.getState().turn).toBe('w');
  });

  it('no deja jugar cuando no es el turno del usuario', async () => {
    const enviarJugada = vi.fn(async () => {});
    const { store, emitir } = crearDoble({ enviarJugada });
    await store.getState().empezar('token', 'maia1');
    emitir({ moves: 'e2e4', status: 'started' }); // ahora mueven negras

    await store.getState().userMove('e7' as never, 'e5' as never);
    expect(enviarJugada).not.toHaveBeenCalled();
  });
});

describe('maiaStore — la partida terminada entra al ciclo de análisis', () => {
  it('guarda el PGN con fuente lichess y el color del usuario', async () => {
    const { store, guardadas, emitir } = crearDoble();
    await store.getState().empezar('token', 'maia1');

    emitir({ moves: 'e2e4 e7e5', status: 'mate', winner: 'white' });
    await vi.waitFor(() => expect(guardadas).toHaveLength(1));

    expect(store.getState().phase).toBe('terminada');
    expect(guardadas[0]).toMatchObject({
      fuente: 'lichess',
      ritmo: 'clasica',
      resultado: '1-0',
      jugadorColor: 'w',
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
    });
    await vi.waitFor(() => expect(store.getState().guardada).toBe(true));
  });

  it('si no se puede traer el PGN, avisa en vez de inventar la partida', async () => {
    const { store, guardadas, emitir } = crearDoble({
      pgn: async () => {
        throw new LichessError('sin-conexion');
      },
    });
    await store.getState().empezar('token', 'maia1');

    emitir({ moves: 'e2e4', status: 'resign', winner: 'black' });
    await vi.waitFor(() => expect(store.getState().phase).toBe('terminada'));

    expect(guardadas).toHaveLength(0);
    expect(store.getState().guardada).toBe(false);
  });
});

describe('maiaStore — fallos explicables', () => {
  it('un bot ocupado no es un error genérico', async () => {
    const { store } = crearDoble({
      desafiarBot: async () => {
        throw new LichessError('bot-no-disponible');
      },
    });
    await store.getState().empezar('token', 'maia9');

    expect(store.getState().phase).toBe('error');
    expect(store.getState().fallo).toBe('bot-no-disponible');
  });

  it('un token sin permisos se distingue de uno inválido', async () => {
    const { store } = crearDoble({
      desafiarBot: async () => {
        throw new LichessError('sin-permisos');
      },
    });
    await store.getState().empezar('token', 'maia1');
    expect(store.getState().fallo).toBe('sin-permisos');
  });

  it('volver limpia el estado para un desafío nuevo', async () => {
    const { store } = crearDoble();
    await store.getState().empezar('token', 'maia1');
    store.getState().volver();

    const s = store.getState();
    expect(s.phase).toBe('inactivo');
    expect(s.gameId).toBeNull();
    expect(s.sanMoves).toEqual([]);
  });
});
