import { describe, expect, it } from 'vitest';
import { brierScore, brierScoreByContext, shouldSampleConfidence } from './calibration';

describe('shouldSampleConfidence', () => {
  it('respeta la probabilidad ~1/4.5 (RF-10.1): con rng < umbral muestrea', () => {
    expect(shouldSampleConfidence(() => 0)).toBe(true);
    expect(shouldSampleConfidence(() => 0.99)).toBe(false);
  });

  it('sobre muchas tiradas, la tasa de muestreo ronda 20-25%', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    let sampled = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (shouldSampleConfidence(rng)) sampled++;
    const rate = sampled / N;
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.3);
  });
});

describe('brierScore', () => {
  it('null sin registros', () => {
    expect(brierScore([])).toBeNull();
  });

  it('0 con calibración perfecta (100% confianza en aciertos, 0% en fallos)', () => {
    const score = brierScore([
      { confianzaDeclarada: 100, acierto: true },
      { confianzaDeclarada: 0, acierto: false },
    ]);
    expect(score).toBe(0);
  });

  it('1 con la peor calibración posible', () => {
    const score = brierScore([
      { confianzaDeclarada: 100, acierto: false },
      { confianzaDeclarada: 0, acierto: true },
    ]);
    expect(score).toBe(1);
  });

  it('detecta sobreconfianza: alta confianza declarada, baja tasa real de acierto', () => {
    const records = [
      { confianzaDeclarada: 90, acierto: true },
      { confianzaDeclarada: 90, acierto: false },
      { confianzaDeclarada: 90, acierto: false },
      { confianzaDeclarada: 90, acierto: false },
    ];
    // forecast 0.9 vs outcome real 0.25 → mal calibrado, score alto
    expect(brierScore(records)).toBeGreaterThan(0.4);
  });
});

describe('brierScoreByContext', () => {
  it('separa la puntuación por contexto (Radar, análisis, Stoyko)', () => {
    const result = brierScoreByContext([
      { id: '1', contexto: 'radar', confianzaDeclarada: 100, acierto: true, fecha: '2026-07-17' },
      { id: '2', contexto: 'radar', confianzaDeclarada: 0, acierto: false, fecha: '2026-07-17' },
      { id: '3', contexto: 'analisis', confianzaDeclarada: 100, acierto: false, fecha: '2026-07-17' },
    ]);
    expect(result.radar).toBe(0);
    expect(result.analisis).toBe(1);
    expect(result.stoyko).toBeUndefined();
  });
});
