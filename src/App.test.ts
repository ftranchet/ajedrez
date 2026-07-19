import { describe, expect, it } from 'vitest';
import { hashForTab, tabFromHash } from './App';

describe('rutas principales por hash', () => {
  it('resuelve rutas válidas y vuelve a Hoy ante una desconocida', () => {
    expect(tabFromHash('#/panel')).toBe('panel');
    expect(tabFromHash('#/calculo/detalle')).toBe('calculo');
    expect(tabFromHash('#/desconocida')).toBe('hoy');
    expect(tabFromHash('')).toBe('hoy');
  });

  it('genera hashes compatibles con GitHub Pages', () => {
    expect(hashForTab('jugar')).toBe('#/jugar');
  });
});
