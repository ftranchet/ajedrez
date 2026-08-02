// Adaptador del motor (ADR-0002): Stockfish WASM single-thread en un Web
// Worker. El archivo .js real lo publica scripts/copy-engine.mjs en
// public/engine/ junto con un manifest.json con su nombre.
import { clampUciElo, elegirJugadaPorTemperatura, multiPvParaNivel } from '../../core/engineLevels';
import type { EngineEvaluation, EngineLevel, EnginePort } from '../../core/ports';

interface AnalyzeOptions {
  /**
   * Elo objetivo cuando el motor juega contra el usuario, o `null` para
   * analizar a fuerza plena.
   *
   * Es obligatorio y explícito porque el worker es un **singleton compartido**
   * entre la partida y el análisis: si jugar dejara `UCI_LimitStrength`
   * encendido, la fase 2 del análisis (E3) correría en silencio a 1320 Elo y
   * clasificaría errores contra un motor capado, sin que nada lo delatara.
   * Cada búsqueda fija las dos opciones, siempre.
   */
  limitElo: number | null;
  /** Uno de los dos: presupuesto por tiempo (juego contra el usuario) o por profundidad (análisis, RNF-3). */
  movetimeMs?: number;
  depth?: number;
  /** Líneas a pedir; >1 solo cuando el nivel juega con imprecisión. */
  multiPv?: number;
}

/** Una línea devuelta por el motor, indexada por `multipv`. */
interface LineaMotor {
  move: string;
  cp: number | null;
  mateIn: number | null;
}

export class StockfishEngine implements EnginePort {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;
  /** Cola de análisis: UCI es un protocolo con estado y dos `go` intercalados
   * mezclan sus `bestmove` (p. ej. una partida en curso y un análisis E3
   * disparados casi a la vez sobre este mismo singleton). */
  private pending: Promise<unknown> = Promise.resolve();
  /**
   * Rechazos de las esperas en curso. Cuando el worker se descarta —timeout,
   * `error`, `messageerror`— hay que cortarlas en el acto: si no, se quedan
   * colgadas hasta su propio timeout esperando a un worker que ya no existe.
   */
  private esperando = new Set<(err: Error) => void>();

  init(): Promise<void> {
    this.initPromise ??= this.boot().catch((err) => {
      // Un fallo de arranque (sin red / cache frío la primera vez) no debe
      // quedar cacheado para siempre: sin esto, `??=` conservaba la promesa
      // rechazada y ningún reintento podía volver a bootear sin recargar la
      // página. Se limpia el estado para que la próxima llamada re-intente.
      this.initPromise = null;
      this.worker?.terminate();
      this.worker = null;
      throw err;
    });
    return this.initPromise;
  }

  private async boot(): Promise<void> {
    // Rutas relativas a la base: la app puede servirse desde un subpath
    // (p. ej. GitHub Pages en /ajedrez/).
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}engine/manifest.json`);
    if (!res.ok) throw new Error('No se encontró el manifest del motor');
    const { file } = (await res.json()) as { file: string };
    const worker = new Worker(`${base}engine/${file}`);
    // Un worker que muere o manda algo indeserializable no avisaba por ningún
    // lado: la operación en curso se quedaba esperando hasta su timeout y la
    // siguiente hablaba con un worker roto. Se descarta y la próxima consulta
    // arranca uno nuevo.
    worker.addEventListener('error', () => {
      this.descartarWorker('El motor se cayó; se reinicia en la próxima consulta.', worker);
    });
    worker.addEventListener('messageerror', () => {
      this.descartarWorker('El motor mandó un mensaje ilegible; se reinicia en la próxima consulta.', worker);
    });
    this.worker = worker;
    this.send('uci');
    await this.waitFor(/^uciok$/m);
    this.send('isready');
    await this.waitFor(/^readyok$/m);
  }

  /**
   * Jugada del motor al nivel pedido (RF-1.3). Los niveles con imprecisión
   * piden varias líneas y a veces juegan una alternativa: es la única forma de
   * bajar del piso de 1320 Elo que impone `UCI_Elo` sin caer en jugadas
   * absurdas (ver core/engineLevels.ts).
   */
  async bestMove(fen: string, level: EngineLevel): Promise<string> {
    const lineas = await this.search(fen, {
      limitElo: level.uciElo,
      movetimeMs: level.movetimeMs,
      multiPv: multiPvParaNivel(level),
    });
    const elegida = elegirJugadaPorTemperatura(lineas, level.temperaturaCp ?? 0);
    if (!elegida) throw new Error('El motor no devolvió jugada');
    return elegida;
  }

  /** Fuerza plena por profundidad — para el análisis de partidas, nunca para jugar contra el usuario. */
  async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
    const [mejor] = await this.search(fen, { limitElo: null, depth, multiPv: 1 });
    if (!mejor) throw new Error('El motor no devolvió evaluación');
    return mejor;
  }

  private search(fen: string, opts: AnalyzeOptions): Promise<LineaMotor[]> {
    const run = () => this.searchNow(fen, opts);
    const result = this.pending.then(run, run);
    this.pending = result.catch(() => {}); // un análisis fallido no bloquea los siguientes
    return result;
  }

  private async searchNow(fen: string, opts: AnalyzeOptions): Promise<LineaMotor[]> {
    await this.init();
    const worker = this.worker;
    if (!worker) throw new Error('Motor no inicializado');

    // Índice `multipv` → última línea vista a la mayor profundidad. Stockfish
    // reemite cada línea a cada profundidad; quedarse con la última es quedarse
    // con la más profunda.
    const lineas = new Map<number, LineaMotor>();
    const onInfo = (e: MessageEvent) => {
      const text = typeof e.data === 'string' ? e.data : '';
      const scoreMatch = /score (cp|mate) (-?\d+)/.exec(text);
      const pvMatch = /\bpv\s+(\S+)/.exec(text);
      if (!scoreMatch || !pvMatch) return;
      const indice = Number(/\bmultipv\s+(\d+)/.exec(text)?.[1] ?? 1);
      const valor = Number(scoreMatch[2]);
      lineas.set(indice, {
        move: pvMatch[1],
        cp: scoreMatch[1] === 'cp' ? valor : null,
        mateIn: scoreMatch[1] === 'mate' ? valor : null,
      });
    };
    worker.addEventListener('message', onInfo);

    try {
      const multiPv = Math.max(1, opts.multiPv ?? 1);
      // Las dos opciones se fijan siempre, en los dos sentidos: ver AnalyzeOptions.
      if (opts.limitElo === null) {
        this.send('setoption name UCI_LimitStrength value false');
        this.send('setoption name Skill Level value 20');
      } else {
        this.send('setoption name Skill Level value 20');
        this.send('setoption name UCI_LimitStrength value true');
        this.send(`setoption name UCI_Elo value ${clampUciElo(opts.limitElo)}`);
      }
      this.send(`setoption name MultiPV value ${multiPv}`);
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(opts.depth !== undefined ? `go depth ${opts.depth}` : `go movetime ${opts.movetimeMs}`);
      const line = await this.waitFor(/^bestmove\s+(\S+)/m, 30_000);
      const match = /^bestmove\s+(\S+)/m.exec(line);
      if (!match || match[1] === '(none)') throw new Error(`El motor no devolvió jugada: ${line}`);

      const ordenadas = [...lineas.entries()].sort(([a], [b]) => a - b).map(([, linea]) => linea);
      // Si no llegó ninguna línea `info` utilizable (posiciones de mate en 1,
      // búsquedas muy cortas), el `bestmove` sigue siendo una respuesta válida.
      return ordenadas.length > 0 ? ordenadas : [{ move: match[1], cp: null, mateIn: null }];
    } finally {
      worker.removeEventListener('message', onInfo);
    }
  }

  dispose(): void {
    this.descartarWorker('El motor se cerró.');
  }

  /**
   * Tira el worker y corta lo que estuviera esperándolo. La próxima consulta
   * re-bootea (`searchNow` siempre pasa por `init()`).
   *
   * **Por qué terminar y no solo mandar `stop`.** UCI es un protocolo con
   * estado: al vencer un timeout, Stockfish sigue pensando y responde a `stop`
   * con un `bestmove` tardío. Si para entonces la operación siguiente ya
   * instaló su listener, ese `bestmove` la resolvía —asociando la jugada o la
   * evaluación de una posición a otra distinta—. Drenar ese mensaje y
   * resincronizar con `isready`/`readyok` también funcionaría, pero deja al
   * motor en un estado que hay que razonar; terminar el worker no deja nada
   * que drenar.
   */
  private descartarWorker(motivo: string, soloSi?: Worker): void {
    // Un evento tardío de un worker ya reemplazado no puede matar al nuevo:
    // sus esperas se rechazaron cuando se lo descartó.
    if (soloSi !== undefined && this.worker !== soloSi) return;
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    const esperando = [...this.esperando];
    this.esperando.clear();
    for (const rechazar of esperando) rechazar(new Error(motivo));
  }

  private send(cmd: string): void {
    if (!this.worker) throw new Error('Motor no inicializado');
    this.worker.postMessage(cmd);
  }

  private waitFor(pattern: RegExp, timeoutMs = 15_000): Promise<string> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('Motor no inicializado'));
    return new Promise((resolve, reject) => {
      const terminar = (): void => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        this.esperando.delete(reject);
      };
      const timer = setTimeout(() => {
        terminar();
        // El worker se tira entero: su `bestmove` tardío no puede aparecer en
        // la operación siguiente si el worker ya no existe (ver
        // `descartarWorker`).
        this.descartarWorker(`Timeout esperando ${pattern}`, worker);
        reject(new Error(`Timeout esperando ${pattern}`));
      }, timeoutMs);
      const onMessage = (e: MessageEvent) => {
        const text = typeof e.data === 'string' ? e.data : '';
        if (pattern.test(text)) {
          terminar();
          resolve(text);
        }
      };
      // Registrado para que un fallo del worker corte esta espera en el acto.
      this.esperando.add(reject);
      worker.addEventListener('message', onMessage);
    });
  }
}

export const engine: EnginePort = new StockfishEngine();
