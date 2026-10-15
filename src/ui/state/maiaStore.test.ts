// El flujo de Maia se prueba contra un doble del puerto de Lichess. Es la
// única forma disponible: `lichess.org` no es alcanzable desde el entorno de
// desarrollo (sí desde el navegador del usuario, que es donde la app corre),
// así que la verificación de punta a punta la hace una persona. Estos tests
// cubren lo que sí se puede cubrir: que el tablero refleje el estado remoto,
// que una jugada no se pinte antes de que Lichess la acepte, y que la partida
// terminada entre al ciclo de análisis.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstadoPartidaLichess, LichessPort, PartidaLichessIniciada } from '../../core/ports';
import type { GameRecord } from '../../core/types';
import { createMaiaStore } from './maiaStore';
import { LichessError } from '../../services/lichess/lichessClient';

const { registrarTiempoEntrenado } = vi.hoisted(() => ({ registrarTiempoEntrenado: vi.fn() }));
vi.mock('../../services/storage/trainingEventRepo', () => ({ registrarTiempoEntrenado }));

afterEach(() => {
  vi.useRealTimers();
  registrarTiempoEntrenado.mockClear();
});

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

  it('si Lichess rechaza la jugada de forma definitiva, el tablero vuelve a la posición confirmada', async () => {
    const { store, emitir } = crearDoble({
      enviarJugada: async () => {
        throw new LichessError('token-invalido');
      },
    });
    await store.getState().empezar('token', 'maia1');
    emitir({ moves: '', status: 'started' });

    await store.getState().userMove('e2' as never, 'e4' as never);

    expect(store.getState().sanMoves).toEqual([]);
    expect(store.getState().phase).toBe('error');
    expect(store.getState().fallo).toBe('token-invalido');
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

// B12: cualquier fallo al mandar una jugada pasaba a 'error' y la pantalla
// volvía a la configuración, con la partida todavía corriendo en Lichess.
describe('maiaStore — un fallo pasajero al mandar una jugada no saca de la partida', () => {
  it('un corte de red se reintenta y la jugada llega', async () => {
    vi.useFakeTimers();
    const enviarJugada = vi
      .fn<LichessPort['enviarJugada']>()
      .mockRejectedValueOnce(new LichessError('sin-conexion'))
      .mockResolvedValueOnce(undefined);
    const { store } = crearDoble({ enviarJugada });
    await store.getState().empezar('token', 'maia1');

    const jugada = store.getState().userMove('e2' as never, 'e4' as never);
    await vi.advanceTimersByTimeAsync(0);

    expect(store.getState().phase).toBe('jugando');
    expect(store.getState().avisoEnvio).toEqual({ estado: 'reintentando', fallo: 'sin-conexion' });
    expect(store.getState().sanMoves).toEqual(['e4']);
    expect(store.getState().enviando).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    await jugada;

    expect(enviarJugada).toHaveBeenCalledTimes(2);
    expect(store.getState().avisoEnvio).toBeNull();
    expect(store.getState().enviando).toBe(false);
    expect(store.getState().phase).toBe('jugando');
  });

  it('ante un 429 espera el minuto que pide Lichess antes de reintentar', async () => {
    vi.useFakeTimers();
    const enviarJugada = vi
      .fn<LichessPort['enviarJugada']>()
      .mockRejectedValueOnce(new LichessError('limite-de-tasa'))
      .mockResolvedValueOnce(undefined);
    const { store } = crearDoble({ enviarJugada });
    await store.getState().empezar('token', 'maia1');

    const jugada = store.getState().userMove('e2' as never, 'e4' as never);
    await vi.advanceTimersByTimeAsync(59_000);
    expect(enviarJugada).toHaveBeenCalledTimes(1);
    expect(store.getState().avisoEnvio).toEqual({ estado: 'reintentando', fallo: 'limite-de-tasa' });

    await vi.advanceTimersByTimeAsync(1_000);
    await jugada;
    expect(enviarJugada).toHaveBeenCalledTimes(2);
    expect(store.getState().phase).toBe('jugando');
  });

  it('agotados los reintentos, la jugada vuelve al tablero y la partida sigue', async () => {
    vi.useFakeTimers();
    const enviarJugada = vi.fn<LichessPort['enviarJugada']>().mockRejectedValue(new LichessError('sin-conexion'));
    const { store } = crearDoble({ enviarJugada });
    await store.getState().empezar('token', 'maia1');

    const jugada = store.getState().userMove('e2' as never, 'e4' as never);
    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);
    await jugada;

    expect(enviarJugada).toHaveBeenCalledTimes(4);
    const s = store.getState();
    expect(s.phase).toBe('jugando');
    expect(s.avisoEnvio).toEqual({ estado: 'sin-enviar', fallo: 'sin-conexion' });
    expect(s.sanMoves).toEqual([]);
    expect(s.enviando).toBe(false);
    expect(s.turn).toBe('w');
  });

  it('si la jugada llegó y se perdió la respuesta, el stream la confirma y no se reintenta', async () => {
    vi.useFakeTimers();
    const enviarJugada = vi.fn<LichessPort['enviarJugada']>().mockRejectedValue(new LichessError('sin-conexion'));
    const { store, emitir } = crearDoble({ enviarJugada });
    await store.getState().empezar('token', 'maia1');

    const jugada = store.getState().userMove('e2' as never, 'e4' as never);
    await vi.advanceTimersByTimeAsync(0);
    emitir({ moves: 'e2e4 e7e5', status: 'started' });
    await vi.advanceTimersByTimeAsync(10_000);
    await jugada;

    expect(enviarJugada).toHaveBeenCalledTimes(1);
    expect(store.getState().avisoEnvio).toBeNull();
    expect(store.getState().sanMoves).toEqual(['e4', 'e5']);
    expect(store.getState().enviando).toBe(false);
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

  // D21: las partidas contra Maia se guardaban con `tiemposPorJugadaMs: []`,
  // así que "donde más tiempo consumiste" (RF-7.2) nunca tenía datos.
  it('guarda lo que tardó cada jugada, leído de los relojes de Lichess', async () => {
    const { store, guardadas, emitir } = crearDoble();
    await store.getState().empezar('token', 'maia1');
    const relojes = (wtime: number, btime: number) => ({ wtime, btime, winc: 20_000, binc: 20_000 });

    emitir({ moves: 'e2e4', status: 'started', ...relojes(1_800_000, 1_800_000) });
    emitir({ moves: 'e2e4 e7e5', status: 'started', ...relojes(1_800_000, 1_800_000) });
    // 2.Cf3 en 90 s; 2...Cc6 en 5 s; 3.Ab5 en 30 s. El estado final dice mate
    // (de mentira, alcanza para el test): la jugada que termina no suma incremento.
    emitir({ moves: 'e2e4 e7e5 g1f3', status: 'started', ...relojes(1_730_000, 1_800_000) });
    emitir({ moves: 'e2e4 e7e5 g1f3 b8c6', status: 'started', ...relojes(1_730_000, 1_815_000) });
    emitir({ moves: 'e2e4 e7e5 g1f3 b8c6 f1b5', status: 'mate', winner: 'white', ...relojes(1_700_000, 1_815_000) });
    await vi.waitFor(() => expect(guardadas).toHaveLength(1));

    expect(guardadas[0].tiemposPorJugadaMs).toEqual([0, 0, 90_000, 5_000, 30_000]);
  });

  // B19: el inicio de la partida era una variable de módulo. La segunda
  // instancia lo pisaba, y al terminar lo dejaba en null: la primera partida
  // no registraba su tiempo.
  it('cada instancia mide el tiempo de su propia partida', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 17, 12, 0));
    const a = crearDoble();
    await a.store.getState().empezar('token', 'maia1');

    vi.setSystemTime(new Date(2026, 6, 17, 12, 10));
    const b = crearDoble();
    await b.store.getState().empezar('token', 'maia1');

    vi.setSystemTime(new Date(2026, 6, 17, 12, 20));
    b.emitir({ moves: 'e2e4', status: 'resign', winner: 'black' });
    await vi.waitFor(() => expect(b.store.getState().guardada).toBe(true));

    vi.setSystemTime(new Date(2026, 6, 17, 12, 30));
    a.emitir({ moves: 'e2e4', status: 'resign', winner: 'black' });
    await vi.waitFor(() => expect(a.store.getState().guardada).toBe(true));

    // `vi.waitFor` adelanta el reloj falso unos milisegundos en cada sondeo.
    const minutosDe = (id: string) => {
      const llamada = registrarTiempoEntrenado.mock.calls.find((c) => c[0] === 'partida' && c[1] === id);
      return llamada ? Math.round((llamada[2] as number) / 60_000) : null;
    };
    expect(minutosDe(b.guardadas[0].id)).toBe(10);
    expect(minutosDe(a.guardadas[0].id)).toBe(30);
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

  // Cancelar aborta la espera del desafío, que entonces falla. Antes ese
  // fallo se mostraba como "algo salió mal con Lichess" sobre la pantalla a
  // la que el usuario ya había vuelto.
  it('cancelar la búsqueda no termina en un error', async () => {
    const { store } = crearDoble({
      desafiarBot: (_token, _bot, _control, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    });
    const empezando = store.getState().empezar('token', 'maia1');
    expect(store.getState().phase).toBe('desafiando');

    store.getState().volver();
    await empezando;

    expect(store.getState().phase).toBe('inactivo');
    expect(store.getState().fallo).toBeNull();
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
