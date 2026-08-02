// El adaptador del motor sin motor: un Worker falso que habla UCI. Lo que se
// prueba acá no es Stockfish sino el protocolo con estado que lo rodea —quién
// contesta a qué búsqueda—, que es donde estaba el fallo capaz de asociar la
// evaluación de una posición a otra distinta.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StockfishEngine } from './stockfishEngine';

class FakeWorker {
  static instancias: FakeWorker[] = [];
  /** Valor inicial de `respondeGo`: el worker nace dentro del adaptador, así
   * que la única forma de configurarlo antes del primer `go` es acá. */
  static respondeGoPorDefecto = true;
  terminado = false;
  enviados: string[] = [];
  /** Si es false, la búsqueda no contesta: sirve para forzar el timeout. */
  respondeGo = FakeWorker.respondeGoPorDefecto;
  private listeners = new Map<string, Set<(e: unknown) => void>>();

  constructor() {
    FakeWorker.instancias.push(this);
  }

  addEventListener(tipo: string, fn: (e: unknown) => void): void {
    if (!this.listeners.has(tipo)) this.listeners.set(tipo, new Set());
    this.listeners.get(tipo)!.add(fn);
  }

  removeEventListener(tipo: string, fn: (e: unknown) => void): void {
    this.listeners.get(tipo)?.delete(fn);
  }

  postMessage(cmd: string): void {
    this.enviados.push(cmd);
    // Un worker real contesta en otro turno del event loop: el adaptador manda
    // el comando y *después* instala el listener. Responder en el acto haría
    // pasar tests que en producción se cuelgan.
    const responder = (): void => {
      if (this.terminado) return;
      if (cmd === 'uci') this.emitir('uciok');
      else if (cmd === 'isready') this.emitir('readyok');
      else if (cmd.startsWith('go') && this.respondeGo) {
        this.emitir('info depth 20 multipv 1 score cp 35 pv e2e4 e7e5');
        this.emitir('bestmove e2e4');
      }
    };
    queueMicrotask(responder);
  }

  terminate(): void {
    this.terminado = true;
  }

  /** Un mensaje del motor, como si llegara del worker real. */
  emitir(texto: string): void {
    for (const fn of this.listeners.get('message') ?? []) fn({ data: texto });
  }

  disparar(tipo: 'error' | 'messageerror'): void {
    for (const fn of this.listeners.get(tipo) ?? []) fn({});
  }
}

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Espera a que el adaptador llegue a mandar el `go` de la búsqueda. */
async function hastaElGo(worker: FakeWorker): Promise<void> {
  for (let i = 0; i < 50 && !worker.enviados.some((cmd) => cmd.startsWith('go')); i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

beforeEach(() => {
  FakeWorker.instancias = [];
  FakeWorker.respondeGoPorDefecto = true;
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ file: 'stockfish.js' }) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('StockfishEngine', () => {
  it('evalúa una posición con el protocolo UCI completo', async () => {
    const engine = new StockfishEngine();
    const evaluacion = await engine.evaluate(FEN, 20);
    expect(evaluacion).toEqual({ move: 'e2e4', cp: 35, mateIn: null });
    const [worker] = FakeWorker.instancias;
    expect(worker!.enviados).toContain('ucinewgame');
    expect(worker!.enviados).toContain(`position fen ${FEN}`);
  });

  describe('timeout', () => {
    it('un bestmove tardío no puede resolver la búsqueda siguiente', async () => {
      // El fallo original: al vencer el timeout se mandaba `stop` y se
      // rechazaba, pero Stockfish contesta a `stop` con un `bestmove` tardío.
      // La operación siguiente ya tenía su listener puesto y lo tomaba como
      // propio, asociando una jugada a una posición que no era la suya.
      FakeWorker.respondeGoPorDefecto = false;
      vi.useFakeTimers();
      const engine = new StockfishEngine();

      const primero = engine.evaluate(FEN, 20);
      const fallo = expect(primero).rejects.toThrow(/Timeout/);
      // Arranque (fetch + uci/isready) y `go`: todo corre en microtareas, que
      // este avance vacía sin consumir tiempo del timeout.
      await vi.advanceTimersByTimeAsync(1);
      const colgado = FakeWorker.instancias[0]!;
      expect(colgado.enviados.some((cmd) => cmd.startsWith('go'))).toBe(true);

      await vi.advanceTimersByTimeAsync(30_000);
      await fallo;

      // El worker colgado se tira: no queda nadie a quien pueda contestarle.
      expect(colgado.terminado).toBe(true);

      // Y aunque llegue igual, no hay ningún listener escuchándolo.
      colgado.emitir('bestmove h2h4');

      vi.useRealTimers();
      FakeWorker.respondeGoPorDefecto = true;
      const segundo = await engine.evaluate('8/8/8/8/8/8/8/K6k w - - 0 1', 20);
      // La respuesta es la del worker nuevo, no la del anterior.
      expect(segundo.move).toBe('e2e4');
      expect(FakeWorker.instancias).toHaveLength(2);
      expect(FakeWorker.instancias[1]!.terminado).toBe(false);
    });

    it('el motor se recupera solo: la búsqueda siguiente arranca un worker nuevo', async () => {
      FakeWorker.respondeGoPorDefecto = false;
      vi.useFakeTimers();
      const engine = new StockfishEngine();
      const primero = engine.evaluate(FEN, 20);
      const fallo = expect(primero).rejects.toThrow(/Timeout/);
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(30_000);
      await fallo;
      vi.useRealTimers();

      FakeWorker.respondeGoPorDefecto = true;
      await expect(engine.evaluate(FEN, 20)).resolves.toMatchObject({ move: 'e2e4' });
    });
  });

  describe('fallos del worker', () => {
    it('un `error` corta la espera en curso en vez de dejarla colgada', async () => {
      const engine = new StockfishEngine();
      await engine.init();
      const worker = FakeWorker.instancias[0]!;
      worker.respondeGo = false;

      const busqueda = engine.evaluate(FEN, 20);
      const fallo = expect(busqueda).rejects.toThrow(/se cayó/);
      // Sin manejador de `error`, esto se quedaba esperando 30 segundos.
      await hastaElGo(worker);
      worker.disparar('error');
      await fallo;
      expect(worker.terminado).toBe(true);
    });

    it('un `messageerror` también descarta el worker', async () => {
      const engine = new StockfishEngine();
      await engine.init();
      const worker = FakeWorker.instancias[0]!;
      worker.respondeGo = false;

      const busqueda = engine.evaluate(FEN, 20);
      const fallo = expect(busqueda).rejects.toThrow(/ilegible/);
      await hastaElGo(worker);
      worker.disparar('messageerror');
      await fallo;
      expect(worker.terminado).toBe(true);
    });

    it('un evento tardío de un worker ya reemplazado no mata al nuevo', async () => {
      const engine = new StockfishEngine();
      await engine.init();
      const viejo = FakeWorker.instancias[0]!;
      viejo.disparar('error');

      await engine.evaluate(FEN, 20);
      const nuevo = FakeWorker.instancias[1]!;
      viejo.disparar('error'); // llega tarde, cuando ya hay otro worker
      expect(nuevo.terminado).toBe(false);
      await expect(engine.evaluate(FEN, 20)).resolves.toMatchObject({ move: 'e2e4' });
    });
  });
});
