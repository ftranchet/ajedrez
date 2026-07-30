import { describe, expect, it } from 'vitest';
import type { RadarItem } from './types';
import {
  PLIES_MIN_LINEA,
  RAMAS_CON_LINEA,
  RAMAS_MIN_ABIERTO,
  declaracionCompleta,
  distanciaEvaluacion,
  esAptoParaForzado,
  evaluarAbierto,
  evaluarForzado,
  itemsParaForzado,
} from './calculo';

const item = (solucion: string[]): RadarItem => ({
  id: 'x',
  fen: 'startpos',
  tipo: 'ofensiva',
  temas: [],
  rating: 1500,
  solucion,
  fuente: 'seed-dev',
});

describe('preset forzado (RF-7.1)', () => {
  it('una línea idéntica a la verificada es correcta', () => {
    expect(evaluarForzado(item(['e2e4', 'e7e5', 'g1f3']), { linea: ['e2e4', 'e7e5', 'g1f3'] })).toEqual({
      correcta: true,
      primerErrorEn: null,
    });
  });

  it('marca el primer ply que se desvía, no solo que falló', () => {
    expect(evaluarForzado(item(['e2e4', 'e7e5', 'g1f3']), { linea: ['e2e4', 'e7e6', 'g1f3'] })).toEqual({
      correcta: false,
      primerErrorEn: 1,
    });
  });

  it('una línea más corta que la pedida falla en el ply que falta', () => {
    expect(evaluarForzado(item(['e2e4', 'e7e5', 'g1f3']), { linea: ['e2e4', 'e7e5'] })).toEqual({
      correcta: false,
      primerErrorEn: 2,
    });
  });

  it('solo sirven ítems del Radar cuya solución sea una línea de 3 a 7 plies', () => {
    expect(esAptoParaForzado(item(['e2e4']))).toBe(false);
    expect(esAptoParaForzado(item(['e2e4', 'e7e5', 'g1f3']))).toBe(true);
    expect(esAptoParaForzado(item(Array(8).fill('e2e4')))).toBe(false);
    expect(itemsParaForzado([item(['e2e4']), item(['e2e4', 'e7e5', 'g1f3'])])).toHaveLength(1);
  });
});

describe('distanciaEvaluacion', () => {
  it('coincidir es 0 y leer la posición al revés es 4', () => {
    expect(distanciaEvaluacion('=', '=')).toBe(0);
    expect(distanciaEvaluacion('+-', '-+')).toBe(4);
  });

  it('un paso de la escala es 1, en cualquier dirección', () => {
    expect(distanciaEvaluacion('±', '=')).toBe(1);
    expect(distanciaEvaluacion('=', '±')).toBe(1);
    expect(distanciaEvaluacion('∓', '+-')).toBe(3);
  });
});

describe('preset abierto (RF-7.2)', () => {
  const entrada = { lineaMotor: ['d5c6', 'b7c6', 'd1f3'], evaluacionMotor: '±' as const };

  it('mide cobertura, profundidad y brecha por separado, sin promediarlas', () => {
    const resultado = evaluarAbierto(entrada, [
      { linea: ['d5c6', 'b7c6', 'd1f3'], evaluacion: '±' },
      { linea: ['g1f3'], evaluacion: '=' },
    ]);
    expect(resultado).toEqual({ cobertura: true, profundidadVista: 3, brechaEvaluacion: 0 });
  });

  it('tener la mejor jugada pero calcularla poco da cobertura sin profundidad', () => {
    const resultado = evaluarAbierto(entrada, [
      { linea: ['d5c6'], evaluacion: '±' },
      { linea: ['g1f3'], evaluacion: '=' },
    ]);
    expect(resultado.cobertura).toBe(true);
    expect(resultado.profundidadVista).toBe(1);
  });

  it('desviarse a mitad de la línea corta la profundidad ahí', () => {
    const resultado = evaluarAbierto(entrada, [{ linea: ['d5c6', 'd7c6', 'd1f3'], evaluacion: '±' }]);
    expect(resultado.profundidadVista).toBe(1);
  });

  // Lo que este preset mide no es "acertaste": es cuánto viste y cuánto se
  // desvió tu juicio. No haber tenido la mejor jugada no anula lo segundo.
  it('sin la mejor jugada entre las candidatas, la brecha sale de la rama que el usuario evaluó', () => {
    // Declaró '-+' donde el motor dice '±': tres pasos de la escala.
    const resultado = evaluarAbierto(entrada, [{ linea: ['g1f3'], evaluacion: '-+' }]);
    expect(resultado).toEqual({ cobertura: false, profundidadVista: 0, brechaEvaluacion: 3 });
  });

  it('sin ninguna evaluación declarada, la brecha es null y no se inventa un 0', () => {
    expect(evaluarAbierto(entrada, [{ linea: ['d5c6'] }]).brechaEvaluacion).toBeNull();
  });
});

describe('declaracionCompleta', () => {
  it('el forzado pide una sola rama con la profundidad pedida', () => {
    expect(declaracionCompleta('forzado', [{ linea: ['e2e4', 'e7e5'] }], 3)).toBe(false);
    expect(declaracionCompleta('forzado', [{ linea: ['e2e4', 'e7e5', 'g1f3'] }], 3)).toBe(true);
    expect(declaracionCompleta('forzado', [{ linea: ['e2e4', 'e7e5', 'g1f3'] }, { linea: ['d2d4'] }], 3)).toBe(false);
  });

  // Decisión de producto (2026-07-30): línea en las dos primeras ramas, el
  // resto candidata suelta. Cinco líneas de cuatro plies en un celular es una
  // carga de datos, no un ejercicio; la amplitud la sostienen las sueltas.
  it('el abierto pide línea en las dos primeras ramas y evaluación en todas', () => {
    const conLinea = (jugada: string) => ({ linea: [jugada, 'e7e5'], evaluacion: '=' as const });
    const suelta = (jugada: string) => ({ linea: [jugada], evaluacion: '±' as const });

    // Dos ramas, pero la segunda sin línea: incompleta.
    expect(declaracionCompleta('abierto', [conLinea('e2e4'), suelta('d2d4')], 0)).toBe(false);
    // Las dos con línea: completa.
    expect(declaracionCompleta('abierto', [conLinea('e2e4'), conLinea('d2d4')], 0)).toBe(true);
    // Y de la tercera en adelante, la candidata suelta alcanza.
    expect(declaracionCompleta('abierto', [conLinea('e2e4'), conLinea('d2d4'), suelta('c2c4')], 0)).toBe(true);
    expect(RAMAS_CON_LINEA).toBe(2);
    expect(PLIES_MIN_LINEA).toBe(2);
  });

  it('sin evaluación no está completa, tenga línea o no', () => {
    expect(declaracionCompleta('abierto', [{ linea: ['e2e4', 'e7e5'] }, { linea: ['d2d4', 'd7d5'] }], 0)).toBe(false);
  });

  it('una sola rama no alcanza, aunque tenga línea y evaluación', () => {
    expect(declaracionCompleta('abierto', [{ linea: ['e2e4', 'e7e5'], evaluacion: '=' }], 0)).toBe(false);
    expect(RAMAS_MIN_ABIERTO).toBe(2);
  });

  it('el abierto no acepta más ramas que el tope', () => {
    const ramas = Array.from({ length: 6 }, (_, i) => ({ linea: [`e2e${i}`, 'e7e5'], evaluacion: '=' as const }));
    expect(declaracionCompleta('abierto', ramas, 0)).toBe(false);
  });
});
