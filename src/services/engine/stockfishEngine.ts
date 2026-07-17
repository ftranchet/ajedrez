// Adaptador del motor (ADR-0002): Stockfish WASM single-thread en un Web
// Worker. El archivo .js real lo publica scripts/copy-engine.mjs en
// public/engine/ junto con un manifest.json con su nombre.
import type { EngineLevel, EnginePort } from '../../core/ports';

export class StockfishEngine implements EnginePort {
  private worker: Worker | null = null;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    this.initPromise ??= this.boot();
    return this.initPromise;
  }

  private async boot(): Promise<void> {
    const res = await fetch('/engine/manifest.json');
    if (!res.ok) throw new Error('No se encontró el manifest del motor');
    const { file } = (await res.json()) as { file: string };
    this.worker = new Worker(`/engine/${file}`);
    this.send('uci');
    await this.waitFor(/^uciok$/m);
    this.send('isready');
    await this.waitFor(/^readyok$/m);
  }

  async bestMove(fen: string, level: EngineLevel): Promise<string> {
    await this.init();
    this.send(`setoption name Skill Level value ${level.skill}`);
    this.send('ucinewgame');
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${level.movetimeMs}`);
    const line = await this.waitFor(/^bestmove\s+(\S+)/m, 30_000);
    const match = /^bestmove\s+(\S+)/m.exec(line);
    if (!match || match[1] === '(none)') throw new Error(`El motor no devolvió jugada: ${line}`);
    return match[1];
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
