// Cliente UCI mínimo para el Stockfish ya declarado como dependencia del
// proyecto. Usa process.execPath para no asumir que `node` está en PATH.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultBinary = join(scriptDir, '..', '..', 'node_modules', 'stockfish', 'bin', 'stockfish-18-lite-single.js');

function parseScore(type, rawScore) {
  const score = Number(rawScore);
  if (!Number.isFinite(score)) return null;
  return type === 'mate' ? Math.sign(score || 1) * 100000 : score;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export class StockfishEngine {
  constructor(binary = defaultBinary) {
    // La distribución WASM de Stockfish termina de inmediato si hereda pipes
    // comunes. `script` le da un pseudo-terminal y mantiene stdin/stdout
    // programables desde este proceso, sin depender de una dependencia extra.
    const command = `${shellQuote(process.execPath)} ${shellQuote(binary)}`;
    this.process = spawn('script', ['-qefc', command, '/dev/null']);
    this.buffer = '';
    this.waiters = [];
    this.multipv = new Map();
    this.process.stdout.on('data', (chunk) => this.consume(chunk.toString()));
    this.process.stderr.on('data', (chunk) => process.stderr.write(chunk));
  }

  consume(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.consumeLine(line.trim());
  }

  consumeLine(line) {
    const depth = Number(/\bdepth (\d+)/.exec(line)?.[1] ?? 0);
    const pvIndex = Number(/\bmultipv (\d+)/.exec(line)?.[1] ?? 1);
    const scoreMatch = /\bscore (cp|mate) (-?\d+)/.exec(line);
    const pvList = /\bpv (.+)$/.exec(line)?.[1];
    const pvMove = pvList?.split(' ')[0];
    if (depth > 0 && scoreMatch && pvMove) {
      const score = parseScore(scoreMatch[1], scoreMatch[2]);
      const previous = this.multipv.get(pvIndex);
      if (score !== null && (!previous || depth >= previous.depth)) {
        this.multipv.set(pvIndex, { depth, move: pvMove, score, pv: pvList.split(' ') });
      }
    }

    for (const waiter of [...this.waiters]) {
      if (!waiter.pattern.test(line)) continue;
      this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
      globalThis.clearTimeout(waiter.timeout);
      waiter.resolve(line);
    }
  }

  send(command) {
    this.process.stdin.write(`${command}\n`);
  }

  waitFor(pattern, timeoutMs = 60_000) {
    return new Promise((resolve, reject) => {
      const waiter = {
        pattern,
        resolve,
        timeout: globalThis.setTimeout(() => {
          this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
          reject(new Error(`Stockfish no respondió a ${pattern} en ${timeoutMs}ms.`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  async init() {
    this.send('uci');
    await this.waitFor(/^uciok$/);
    this.send('isready');
    await this.waitFor(/^readyok$/);
  }

  async analyseMultiPv(fen, count, depth) {
    this.multipv.clear();
    this.send(`setoption name MultiPV value ${Math.max(2, count)}`);
    this.send('isready');
    await this.waitFor(/^readyok$/);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    await this.waitFor(/^bestmove\s+/);
    return [...this.multipv.values()].sort((left, right) => right.score - left.score);
  }

  quit() {
    this.send('quit');
    this.process.kill();
  }
}
