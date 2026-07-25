import { describe, expect, it } from 'vitest';
import type { CalibrationRecord } from './types';
import { brechaCalibracion, brierScore, brierScoreByContext, calibrationCurve, calibrationInsight, serieBrechaCalibracion, shouldSampleConfidence } from './calibration';

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

describe('calibrationCurve', () => {
  it('agrupa confianza declarada y tasa real en bandas de 20 puntos', () => {
    const curve = calibrationCurve([
      { confianzaDeclarada: 85, acierto: true },
      { confianzaDeclarada: 90, acierto: false },
      { confianzaDeclarada: 95, acierto: true },
      { confianzaDeclarada: 45, acierto: false },
    ]);
    expect(curve).toHaveLength(2);
    expect(curve[0]).toMatchObject({ desde: 40, cantidad: 1, confianzaMedia: 45, aciertoReal: 0 });
    expect(curve[1]).toMatchObject({ desde: 80, cantidad: 3, confianzaMedia: 90 });
    expect(curve[1].aciertoReal).toBeCloseTo(2 / 3);
  });

  it('acota valores históricos fuera de 0–100', () => {
    const curve = calibrationCurve([
      { confianzaDeclarada: -5, acierto: false },
      { confianzaDeclarada: 120, acierto: true },
    ]);
    expect(curve[0].confianzaMedia).toBe(0);
    expect(curve[1].confianzaMedia).toBe(100);
  });
});

describe('calibrationInsight', () => {
  it('explica sobreconfianza por contexto cuando hay muestra suficiente', () => {
    const records = [
      { id: '1', contexto: 'radar' as const, confianzaDeclarada: 90, acierto: true, fecha: '2026-07-19' },
      { id: '2', contexto: 'radar' as const, confianzaDeclarada: 90, acierto: false, fecha: '2026-07-19' },
      { id: '3', contexto: 'radar' as const, confianzaDeclarada: 90, acierto: false, fecha: '2026-07-19' },
    ];
    expect(calibrationInsight(records)).toEqual({
      direccion: 'sobreconfianza',
      contexto: 'radar',
      confianza: 90,
      acierto: 33,
      cantidad: 3,
    });
  });

  it('no afirma un patrón con una muestra insuficiente', () => {
    expect(
      calibrationInsight([
        { id: '1', contexto: 'radar', confianzaDeclarada: 90, acierto: false, fecha: '2026-07-19' },
        { id: '2', contexto: 'radar', confianzaDeclarada: 90, acierto: false, fecha: '2026-07-19' },
      ]),
    ).toBeNull();
  });
});

describe('brechaCalibracion (RF-10.3)', () => {
  const r = (confianzaDeclarada: number, acierto: boolean) => ({ confianzaDeclarada, acierto });

  it('sin registros no inventa un número', () => {
    expect(brechaCalibracion([])).toBeNull();
  });

  it('quien declara lo que acierta tiene brecha cercana a cero', () => {
    // Banda 60–79: declara ~70 y acierta 70%.
    const records = [
      ...Array.from({ length: 7 }, () => r(70, true)),
      ...Array.from({ length: 3 }, () => r(70, false)),
    ];
    expect(brechaCalibracion(records)!).toBeLessThan(1);
  });

  it('la sobreconfianza se lee en puntos, que es lo que la hace legible', () => {
    // Declara 90 y acierta la mitad: 40 puntos de brecha.
    const records = [
      ...Array.from({ length: 5 }, () => r(90, true)),
      ...Array.from({ length: 5 }, () => r(90, false)),
    ];
    expect(brechaCalibracion(records)!).toBeCloseTo(40, 0);
  });

  it('a diferencia de Brier, no penaliza acertar poco si estaba bien anticipado', () => {
    // Alguien calibrado en material difícil: declara 30 y acierta 30%.
    const dificil = [
      ...Array.from({ length: 3 }, () => r(30, true)),
      ...Array.from({ length: 7 }, () => r(30, false)),
    ];
    // Alguien sobreconfiado en material fácil: declara 100 y acierta 80%.
    const facil = [
      ...Array.from({ length: 8 }, () => r(100, true)),
      ...Array.from({ length: 2 }, () => r(100, false)),
    ];
    // Brier premia al segundo por acertar más; la brecha muestra que el
    // primero está mejor calibrado, que es lo que la métrica quiere medir.
    expect(brierScore(dificil)!).toBeGreaterThan(brierScore(facil)!);
    expect(brechaCalibracion(dificil)!).toBeLessThan(brechaCalibracion(facil)!);
  });
});

describe('serieBrechaCalibracion', () => {
  const registro = (fecha: string, confianzaDeclarada: number, acierto: boolean): CalibrationRecord => ({
    id: crypto.randomUUID(),
    contexto: 'radar',
    confianzaDeclarada,
    acierto,
    fecha,
  });

  it('no devuelve puntos hasta completar la primera ventana', () => {
    const pocos = Array.from({ length: 5 }, (_, i) =>
      registro(`2026-07-0${i + 1}T10:00:00.000Z`, 80, true),
    );
    expect(serieBrechaCalibracion(pocos, 12)).toEqual([]);
  });

  it('produce un punto por respuesta una vez que hay ventana completa', () => {
    const registros = Array.from({ length: 15 }, (_, i) =>
      registro(new Date(2026, 6, i + 1, 10).toISOString(), 80, i % 2 === 0),
    );
    const serie = serieBrechaCalibracion(registros, 12);
    expect(serie).toHaveLength(4);
    expect(serie.every((punto) => punto.valor >= 0)).toBe(true);
  });
});
