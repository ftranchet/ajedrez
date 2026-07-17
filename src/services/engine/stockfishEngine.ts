// Adaptador del motor (ADR-0002): Stockfish WASM single-thread en un Web
// Worker. El archivo .js real lo publica scripts/copy-engine.mjs en
// public/engine/ junto con un manifest.json con su nombre.
import type { EngineEvaluation, EngineLevel, EnginePort } from '../../core/ports';

interface AnalyzeOptions {
  skill: number;
  /** Uno de los dos: presupuesto por tiempo (juego contra el usuario) o por profundidad (análisis, RNF-3). */
  movetimeMs?: number;
  depth?: number;
}

export class StockfishEngine implements EnginePort {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    this.initPromise ??= this.boot();
    return this.initPromise;
  }

  private async boot(): Promise<void> {
    // Rutas relativas a la base: la app puede servirse desde un subpath
    // (p. ej. GitHub Pages en /ajedrez/).
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}engine/manifest.json`);
    if (!res.ok) throw new Error('No se encontró el manifest del motor');
    const { file } = (await res.json()) as { file: string };
    this.worker = new Worker(`${base}engine/${file}`);
    this.send('uci');
    await this.waitFor(/^uciok$/m);
    this.send('isready');
    await this.waitFor(/^readyok$/m);
  }

  async bestMove(fen: string, level: EngineLevel): Promise<string> {
    const result = await this.analyze(fen, { skill: level.skill, movetimeMs: level.movetimeMs });
    return result.move;
  }

  /** Fuerza máxima (Skill Level 20), profundidad fija — para el análisis de partidas, no para jugar contra el usuario. */
  async evaluate(fen: string, depth: number): Promise<EngineEvaluation> {
    return this.analyze(fen, { skill: 20, depth });
  }

  private async analyze(fen: string, opts: AnalyzeOptions): Promise<EngineEvaluation> {
    await this.init();
    const worker = this.worker;
    if (!worker) throw new Error('Motor no inicializado');

    let cp: number | null = null;
    let mateIn: number | null = null;
    const onInfo = (e: MessageEvent) => {
      const text = typeof e.data === 'string' ? e.data : '';
      const mateMatch = /score mate (-?\d+)/.exec(text);
      const cpMatch = /score cp (-?\d+)/.exec(text);
      if (mateMatch) {
        mateIn = Number(mateMatch[1]);
        cp = null;
      } else if (cpMatch) {
        cp = Number(cpMatch[1]);
        mateIn = null;
      }
    };
    worker.addEventListener('message', onInfo);

    try {
      this.send(`setoption name Skill Level value ${opts.skill}`);
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(opts.depth !== undefined ? `go depth ${opts.depth}` : `go movetime ${opts.movetimeMs}`);
      const line = await this.waitFor(/^bestmove\s+(\S+)/m, 30_000);
      const match = /^bestmove\s+(\S+)/m.exec(line);
      if (!match || match[1] === '(none)') throw new Error(`El motor no devolvió jugada: ${line}`);
      return { move: match[1], cp, mateIn };
    } finally {
      worker.removeEventListener('message', onInfo);
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
  }

  private send(cmd: string): void {
    if (!this.worker) throw new Error('Motor no inicializado');
    this.worker.postMessage(cmd);
  }

  private waitFor(pattern: RegExp, timeoutMs = 15_000): Promise<string> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('Motor no inicializado'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.removeEventListener('message', onMessage);
        reject(new Error(`Timeout esperando ${pattern}`));
      }, timeoutMs);
      const onMessage = (e: MessageEvent) => {
        const text = typeof e.data === 'string' ? e.data : '';
        if (pattern.test(text)) {
          clearTimeout(timer);
          worker.removeEventListener('message', onMessage);
          resolve(text);
        }
      };
      worker.addEventListener('message', onMessage);
    });
  }
}

export const engine: EnginePort = new StockfishEngine();
