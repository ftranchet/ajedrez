import { describe, expect, it } from 'vitest';
import { leerReloj, leerTimeControl, tiemposDesdeRelojes } from './relojPgn';

describe('leerTimeControl', () => {
  it('clasifica con los umbrales de Lichess sobre base + 40 × incremento', () => {
    // 60 + 40×1 = 100 s; 120 + 40×1 = 160 s: los dos son bullet.
    expect(leerTimeControl('60+1')?.ritmo).toBe('bullet');
    expect(leerTimeControl('120+1')?.ritmo).toBe('bullet');
    // 180 s justo: blitz (bullet llega hasta 179).
    expect(leerTimeControl('180')?.ritmo).toBe('blitz');
    // 180 + 40×2 = 260 s: blitz, aunque la base sea de tres minutos.
    expect(leerTimeControl('180+2')).toEqual({ ritmo: 'blitz', incrementoMs: 2000 });
    // 300 + 40×5 = 500 s: el incremento la pasa a rápida.
    expect(leerTimeControl('300+5')?.ritmo).toBe('rapida');
    expect(leerTimeControl('600+0')?.ritmo).toBe('rapida');
    // 1500 s justo: clásica (rápida llega hasta 1499).
    expect(leerTimeControl('900+15')?.ritmo).toBe('clasica');
    expect(leerTimeControl('1800')?.ritmo).toBe('clasica');
  });

  it('acepta base cero con incremento (el 0+1 de Lichess) y decimales', () => {
    expect(leerTimeControl('0+1')).toEqual({ ritmo: 'bullet', incrementoMs: 1000 });
    expect(leerTimeControl('15')).toEqual({ ritmo: 'bullet', incrementoMs: 0 });
    expect(leerTimeControl('60+0.5')).toEqual({ ritmo: 'bullet', incrementoMs: 500 });
  });

  it('"-" es partida sin control de tiempo: sin reloj y sin incremento', () => {
    expect(leerTimeControl('-')).toEqual({ ritmo: 'sin-reloj', incrementoMs: null });
  });

  it('con jugadas por período da el ritmo pero no el incremento: el reloj se recarga', () => {
    // FIDE clásico: 40 jugadas en 90 minutos con 30 s, después 30 minutos.
    expect(leerTimeControl('40/5400+30:1800+30')).toEqual({ ritmo: 'clasica', incrementoMs: null });
    expect(leerTimeControl('40/7200:3600')).toEqual({ ritmo: 'clasica', incrementoMs: null });
    // Las diarias de Chess.com: una jugada por día.
    expect(leerTimeControl('1/86400')).toEqual({ ritmo: 'clasica', incrementoMs: null });
  });

  it('no adivina: desconocido, reloj de arena, vacío o basura devuelven null', () => {
    expect(leerTimeControl(undefined)).toBeNull();
    expect(leerTimeControl('')).toBeNull();
    expect(leerTimeControl('?')).toBeNull();
    expect(leerTimeControl('*180')).toBeNull();
    expect(leerTimeControl('0')).toBeNull();
    expect(leerTimeControl('3 min')).toBeNull();
    expect(leerTimeControl('40/7200:basura')).toBeNull();
  });
});

describe('leerReloj', () => {
  it('lee el formato de Lichess y el de Chess.com, con décimas', () => {
    expect(leerReloj(' [%clk 0:03:00] ')).toBe(180_000);
    expect(leerReloj('[%clk 0:02:59.9]')).toBe(179_900);
    expect(leerReloj('[%clk 1:30:05]')).toBe(5_405_000);
  });

  it('encuentra el reloj entre otras anotaciones del comentario', () => {
    expect(leerReloj(' [%eval 0.2] [%clk 0:02:58] ')).toBe(178_000);
    expect(leerReloj('buena jugada [%clk 0:00:07]')).toBe(7_000);
  });

  it('devuelve null si el comentario no trae reloj', () => {
    expect(leerReloj('buena jugada')).toBeNull();
    expect(leerReloj('[%eval 0.2]')).toBeNull();
    expect(leerReloj('[%emt 0:00:05]')).toBeNull();
  });
});

describe('tiemposDesdeRelojes', () => {
  it('resta el reloj anterior del mismo bando y suma el incremento, con el índice del ply', () => {
    // 3+2: las dos primeras jugadas no tienen reloj previo (0 = sin dato).
    // Blancas: 180 → 178 en su segunda jugada, con 2 s de incremento → 4 s.
    // Negras: 180 → 175 → 5 s + 2 s = 7 s.
    const relojes = [180_000, 180_000, 178_000, 175_000, 170_500, 175_000];
    expect(tiemposDesdeRelojes(relojes, 2000)).toEqual([0, 0, 4_000, 7_000, 9_500, 2_000]);
  });

  it('una jugada sin reloj, o cuya anterior no lo tiene, queda sin dato', () => {
    const relojes = [60_000, 60_000, null, 55_000, 50_000, 54_000];
    // Ply 2 no tiene reloj; ply 4 no tiene el anterior (ply 2): ambos 0.
    expect(tiemposDesdeRelojes(relojes, 0)).toEqual([0, 0, 0, 5_000, 0, 1_000]);
  });

  it('una resta negativa (el rival le dio tiempo) no inventa un tiempo: queda sin dato', () => {
    const relojes = [60_000, 60_000, 75_000, 58_000];
    expect(tiemposDesdeRelojes(relojes, 0)).toEqual([0, 0, 0, 2_000]);
  });

  it('sin ningún dato devuelve [], igual que una partida sin relojes', () => {
    expect(tiemposDesdeRelojes([], 0)).toEqual([]);
    expect(tiemposDesdeRelojes([180_000, 180_000], 2000)).toEqual([]);
    expect(tiemposDesdeRelojes([null, null, null], 0)).toEqual([]);
  });
});
