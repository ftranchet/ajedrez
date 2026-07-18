import { describe, expect, it } from 'vitest';
import { analyzeGameWithEngine } from './gameAnalyzer';
import { buildGameAnalysis } from '../../core/analysis';
import { FakeAnalysisEngine } from '../../test/fakeEngine';

const PGN_CON_CAPTURA = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 *';

describe('analyzeGameWithEngine', () => {
  it('devuelve una evaluación por posición, incluida la final (plies+1)', async () => {
    const evals = await analyzeGameWithEngine(PGN_CON_CAPTURA, new FakeAnalysisEngine());
    // 8 medias jugadas en el PGN → 9 evaluaciones.
    expect(evals).toHaveLength(9);
    expect(evals[0].ply).toBe(0);
    expect(evals[8].ply).toBe(8);
  });

  it('registra el lado que mueve y la jugada real en UCI en cada posición', async () => {
    const evals = await analyzeGameWithEngine(PGN_CON_CAPTURA, new FakeAnalysisEngine());
    expect(evals[0].ladoQueMueve).toBe('w');
    expect(evals[0].jugadaUsuario).toBe('e2e4');
    expect(evals[0].san).toBe('e4');
    expect(evals[1].ladoQueMueve).toBe('b');
    expect(evals[1].jugadaUsuario).toBe('e7e5');
    // La última evaluación es la posición final: no hay jugada que jugar desde ahí.
    expect(evals[8].jugadaUsuario).toBe('');
  });

  it('normaliza la evaluación del motor a perspectiva blancas', async () => {
    const evals = await analyzeGameWithEngine(PGN_CON_CAPTURA, new FakeAnalysisEngine());
    // Antes de Bxc6 (ply 6, la sexta media jugada), material está parejo.
    expect(evals.find((e) => e.ply === 6)!.cpAntes).toBeCloseTo(0);
    // Tras Bxc6, antes de dxc6 (posición del ply 7, negras a mover): negras
    // tienen una recaptura gratis (dxc6) que restablece el material, así
    // que la posición ya es objetivamente pareja — el motor falso (con su
    // búsqueda de 1 jugada) lo ve, igual que lo vería uno real. (toBeCloseTo
    // porque invertir el signo de 0 dos veces puede dar -0.)
    expect(evals.find((e) => e.ply === 7)!.cpAntes).toBeCloseTo(0);
    // Posición final (blancas a mover, tras dxc6): el tablero está parejo,
    // pero Nxe5 gana el peón e5 sin recaptura (perdió a su defensor, el
    // caballo, en el intercambio) — el motor falso lo detecta con su
    // búsqueda de 1 jugada, a favor de blancas.
    expect(evals.find((e) => e.ply === 8)!.cpAntes).toBeGreaterThan(0);
  });

  it('el resultado se puede pasar directo a buildGameAnalysis sin ajustes', async () => {
    const evals = await analyzeGameWithEngine(PGN_CON_CAPTURA, new FakeAnalysisEngine());
    const analysis = buildGameAnalysis(evals, {
      momentoCriticoPly: 0,
      plan: '',
      evaluaciones: [],
      completadaEn: '2026-07-17T00:00:00.000Z',
    });
    expect(analysis.jugadas).toHaveLength(8);
  });

  it('reporta progreso ply a ply', async () => {
    const progresos: number[] = [];
    await analyzeGameWithEngine(PGN_CON_CAPTURA, new FakeAnalysisEngine(), { onProgress: (p) => progresos.push(p.ply) });
    expect(progresos).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('una partida que termina en jaque mate se analiza sin consultar al motor en la posición final', async () => {
    // En una posición terminal el motor real responde "bestmove (none)" y el
    // adaptador lo trata como error: antes de la guarda, analizar cualquier
    // partida terminada en mate tiraba y el análisis quedaba colgado.
    const pgnConMate = '1. f3 e5 2. g4 Qh4# 0-1';
    const evals = await analyzeGameWithEngine(pgnConMate, new FakeAnalysisEngine());
    expect(evals).toHaveLength(5);
    // Posición final: blancas a mover, en mate → decisivo para negras en perspectiva blancas.
    expect(evals[4].ladoQueMueve).toBe('w');
    expect(evals[4].cpAntes).toBeLessThan(-10_000);

    // Y la jugada de mate no se clasifica como error de quien la dio.
    const analysis = buildGameAnalysis(evals, {
      momentoCriticoPly: 0,
      plan: '',
      evaluaciones: [],
      completadaEn: '2026-07-17T00:00:00.000Z',
    });
    expect(analysis.jugadas[3].clasificacion).toBe('buena');
  });

  it('invierte el signo cuando la posición se evalúa con negras a mover (perspectiva blancas)', async () => {
    // 4. Ba6?? cuelga el alfil sin compensación (verificado con chess.js);
    // en la posición resultante (negras a mover) el motor ve la recaptura
    // gratis y evalúa a favor de negras — en perspectiva blancas, negativo.
    const pgnConAlfilColgado = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Ba6 bxa6 *';
    const evals = await analyzeGameWithEngine(pgnConAlfilColgado, new FakeAnalysisEngine());
    const trasBa6 = evals.find((e) => e.ply === 7)!; // negras a mover, antes de bxa6
    expect(trasBa6.ladoQueMueve).toBe('b');
    expect(trasBa6.cpAntes).toBeLessThan(0);
  });
});
