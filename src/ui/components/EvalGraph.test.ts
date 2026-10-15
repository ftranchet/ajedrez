import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MoveAnalysisEntry, MoveClassification } from '../../core/types';
import { t } from '../i18n/es';
import { coordenadaDePunto, EvalGraph, trazadoDeLaCurva } from './EvalGraph';

/** Una jugada con la evaluación después de ella; lo demás no se dibuja. */
function jugada(ply: number, cpAntes: number, cpDespues: number, clasificacion: MoveClassification): MoveAnalysisEntry {
  return {
    ply,
    san: 'e4',
    fenAntes: '',
    ladoQueMueve: ply % 2 === 0 ? 'w' : 'b',
    jugadaUsuario: 'e2e4',
    jugadaMotor: 'e2e4',
    cpAntes,
    cpDespues,
    cpPerdidos: 0,
    clasificacion,
  };
}

// Cuatro jugadas: un error en la segunda y uno grave en la última.
const jugadas = [
  jugada(0, 20, 30, 'buena'),
  jugada(1, 30, 250, 'error'),
  jugada(2, 250, 240, 'buena'),
  jugada(3, 240, -400, 'grave'),
];

/** Los vértices de un path "M x y L x y …", en orden. */
function vertices(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/[ML] (\S+) (\S+)/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
}

describe('coordenadaDePunto', () => {
  it('reparte los puntos de punta a punta del ancho', () => {
    expect(coordenadaDePunto(0, 5, 0).x).toBe(0);
    expect(coordenadaDePunto(2, 5, 0).x).toBe(150);
    expect(coordenadaDePunto(4, 5, 0).x).toBe(300);
  });

  it('la igualdad va al medio, las blancas arriba y la escala se corta en ±6 peones', () => {
    expect(coordenadaDePunto(0, 2, 0).y).toBe(30);
    expect(coordenadaDePunto(0, 2, 600).y).toBe(2);
    expect(coordenadaDePunto(0, 2, -600).y).toBe(58);
    expect(coordenadaDePunto(0, 2, 5000).y).toBe(2);
  });
});

describe('trazadoDeLaCurva', () => {
  // Regresión del hallazgo N3 de la auditoría 2026-10-15: los marcadores se
  // ubicaban en (i + 1) / puntos.length y la curva en i / (puntos.length − 1),
  // así que el grave de la última jugada quedaba en x = 240 y no al final de
  // la curva (x = 300), lejos de su caída.
  it('cada marcador es el vértice de la curva que sigue a su jugada', () => {
    const { path, marcadores } = trazadoDeLaCurva(jugadas);
    const curva = vertices(path);
    expect(curva).toHaveLength(jugadas.length + 1);
    expect(marcadores.map((m) => m.ply)).toEqual([1, 3]);
    expect(marcadores[0]).toEqual({ ply: 1, ...curva[2] });
    expect(marcadores[1]).toEqual({ ply: 3, ...curva[4] });
    expect(marcadores[1].x).toBe(300);
  });
});

describe('EvalGraph', () => {
  it('dibuja los marcadores sobre la curva y se nombra con el texto de i18n', () => {
    const html = renderToStaticMarkup(createElement(EvalGraph, { jugadas }));
    const curva = vertices(/ d="([^"]+)"/.exec(html)![1]);
    const circulos = [...html.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map(([, x, y]) => ({ x: Number(x), y: Number(y) }));
    expect(circulos).toEqual([curva[2], curva[4]]);
    expect(html).toContain(`aria-label="${t.analisis.curvaTitulo}"`);
  });

  it('sin jugadas no dibuja nada', () => {
    expect(renderToStaticMarkup(createElement(EvalGraph, { jugadas: [] }))).toBe('');
  });
});
