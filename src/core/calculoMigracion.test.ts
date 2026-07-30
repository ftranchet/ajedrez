import { describe, expect, it } from 'vitest';
import type { CompromisoAttempt, StoykoAttempt } from './types';
import { compromisoAAttempt, stoykoAAttempt, unificarIntentosDeCalculo } from './calculoMigracion';

const compromiso: CompromisoAttempt = {
  id: 'c1',
  itemId: 'lichess-abc',
  profundidad: 3,
  correcta: false,
  primerErrorEn: 1,
  tiempoMs: 240_000,
  fecha: '2026-07-20T10:00:00.000Z',
};

const stoyko: StoykoAttempt = {
  id: 's1',
  itemId: 'stoyko-01',
  candidatas: [
    { jugada: 'd5c6', evaluacion: '±' },
    { jugada: 'g1f3', evaluacion: '=' },
  ],
  acierto: true,
  confianzaDeclarada: 70,
  tiempoMs: 1_800_000,
  fecha: '2026-07-21T10:00:00.000Z',
};

describe('compromisoAAttempt', () => {
  it('conserva resultado, tiempo y el ply donde se desvió', () => {
    const nuevo = compromisoAAttempt(compromiso, ['d5c6', 'b7c6', 'd1f3']);
    expect(nuevo).toMatchObject({
      id: 'c1',
      preset: 'forzado',
      itemId: 'lichess-abc',
      correcta: false,
      primerErrorEn: 1,
      tiempoMs: 240_000,
      fecha: compromiso.fecha,
    });
  });

  // La línea declarada nunca se guardó en el formato viejo: solo el ply donde
  // se desvió. Se reconstruyen los plies que sí se pueden afirmar.
  it('reconstruye solo los plies correctos, sin inventar los equivocados', () => {
    expect(compromisoAAttempt(compromiso, ['d5c6', 'b7c6', 'd1f3']).ramas).toEqual([{ linea: ['d5c6'] }]);
    const acertado = compromisoAAttempt({ ...compromiso, correcta: true, primerErrorEn: null }, ['d5c6', 'b7c6', 'd1f3']);
    expect(acertado.ramas).toEqual([{ linea: ['d5c6', 'b7c6', 'd1f3'] }]);
  });

  it('sin el ítem en el catálogo, la rama queda vacía en vez de fabricada', () => {
    expect(compromisoAAttempt(compromiso).ramas).toEqual([{ linea: [] }]);
  });
});

describe('stoykoAAttempt', () => {
  it('cada candidata pasa a ser una rama de un ply con su evaluación', () => {
    expect(stoykoAAttempt(stoyko).ramas).toEqual([
      { linea: ['d5c6'], evaluacion: '±' },
      { linea: ['g1f3'], evaluacion: '=' },
    ]);
  });

  it('el acierto viejo era la cobertura, y la confianza y el tiempo se conservan', () => {
    expect(stoykoAAttempt(stoyko)).toMatchObject({
      preset: 'abierto',
      cobertura: true,
      profundidadVista: 1,
      confianzaDeclarada: 70,
      tiempoMs: 1_800_000,
    });
  });

  // No se guardaba la evaluación del motor de la posición, así que la brecha no
  // se puede calcular: queda declarada como desconocida en vez de inventada.
  it('la brecha de evaluación queda en null, no en 0', () => {
    expect(stoykoAAttempt(stoyko).brechaEvaluacion).toBeNull();
  });

  it('no haber tenido la mejor jugada deja la profundidad en 0', () => {
    expect(stoykoAAttempt({ ...stoyko, acierto: false }).profundidadVista).toBe(0);
  });
});

describe('unificarIntentosDeCalculo', () => {
  it('junta los dos formatos y los ordena por fecha', () => {
    const unificados = unificarIntentosDeCalculo([compromiso], [stoyko]);
    expect(unificados.map((intento) => intento.id)).toEqual(['c1', 's1']);
    expect(unificados.map((intento) => intento.preset)).toEqual(['forzado', 'abierto']);
  });

  it('sin intentos viejos no inventa ninguno', () => {
    expect(unificarIntentosDeCalculo([], [])).toEqual([]);
  });
});
