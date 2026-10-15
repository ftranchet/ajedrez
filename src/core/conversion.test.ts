import { describe, expect, it } from 'vitest';
import {
  evaluarConversion,
  UMBRAL_PERDIDA_CP,
  VENTAJA_GANADORA_CP,
  ventajaDesperdiciada,
  ventajasDesperdiciadas,
} from './conversion';
import type { Color, GameAnalysis, GameRecord, MoveAnalysisEntry } from './types';

function jugada(ply: number, cpAntes: number, ladoQueMueve: Color): MoveAnalysisEntry {
  return {
    ply,
    san: 'e4',
    fenAntes: `fen-${ply}`,
    ladoQueMueve,
    jugadaUsuario: 'e2e4',
    jugadaMotor: 'e2e4',
    cpAntes,
    cpDespues: cpAntes,
    cpPerdidos: 0,
    clasificacion: 'buena',
  };
}

function analisis(jugadas: MoveAnalysisEntry[]): GameAnalysis {
  return { jugadas, comparacionEvaluaciones: [], analizadaEn: '2026-07-25T10:00:00.000Z' };
}

function game(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: 'g1',
    pgn: '1. e4 e5 *',
    fuente: 'manual',
    ritmo: 'clasica',
    resultado: '1/2-1/2',
    tiemposPorJugadaMs: [],
    analizada: true,
    fecha: '2026-07-20T10:00:00.000Z',
    jugadorColor: 'w',
    ...overrides,
  };
}

describe('ventajaDesperdiciada (RF-8.1)', () => {
  it('encuentra el pico de ventaja de una partida que se fue en tablas', () => {
    const g = game({
      analisis: analisis([jugada(0, 320, 'w'), jugada(2, 610, 'w'), jugada(4, 400, 'w')]),
    });
    const resultado = ventajaDesperdiciada(g);
    expect(resultado).toMatchObject({ gameId: 'g1', ply: 2, ventajaCp: 610, fen: 'fen-2' });
  });

  it('no propone nada si la partida se ganó: no hay nada que convertir', () => {
    const g = game({ resultado: '1-0', analisis: analisis([jugada(0, 800, 'w')]) });
    expect(ventajaDesperdiciada(g)).toBeNull();
  });

  it('ignora las ventajas que no llegan al umbral de posición ganadora', () => {
    const g = game({ analisis: analisis([jugada(0, 250, 'w'), jugada(2, 120, 'w')]) });
    expect(ventajaDesperdiciada(g)).toBeNull();
  });

  it('con negras, la ventaja del usuario es la evaluación invertida', () => {
    // cpAntes está en perspectiva blancas: -500 significa que negras gana.
    const conNegras = game({ jugadorColor: 'b', resultado: '1-0', analisis: analisis([jugada(1, -500, 'b')]) });
    expect(ventajaDesperdiciada(conNegras)).toMatchObject({ ventajaCp: 500 });

    // Y +500 con negras es ventaja del rival: no se ofrece para "convertir".
    const rivalGanando = game({ jugadorColor: 'b', resultado: '1-0', analisis: analisis([jugada(1, 500, 'b')]) });
    expect(ventajaDesperdiciada(rivalGanando)).toBeNull();
  });

  it('solo toma posiciones donde le tocaba mover al usuario', () => {
    // La ventaja mayor está en una posición donde mueve el rival: rejugar
    // desde ahí no sería convertir, sería esperar.
    const g = game({ analisis: analisis([jugada(1, 900, 'b'), jugada(2, 400, 'w')]) });
    expect(ventajaDesperdiciada(g)).toMatchObject({ ply: 2, ventajaCp: 400 });
  });

  it('sin análisis o sin color atribuible no se puede afirmar de quién era la ventaja', () => {
    expect(ventajaDesperdiciada(game({ analisis: undefined }))).toBeNull();
    const sinColor = game({ analisis: analisis([jugada(0, 900, 'w')]) });
    delete (sinColor as Partial<GameRecord>).jugadorColor;
    expect(ventajaDesperdiciada(sinColor)).toBeNull();
  });
});

describe('ventajasDesperdiciadas', () => {
  it('devuelve una por partida, más recientes primero', () => {
    const vieja = game({ id: 'vieja', fecha: '2026-07-01T10:00:00.000Z', analisis: analisis([jugada(0, 500, 'w')]) });
    const nueva = game({ id: 'nueva', fecha: '2026-07-20T10:00:00.000Z', analisis: analisis([jugada(0, 400, 'w'), jugada(2, 900, 'w')]) });
    const ganada = game({ id: 'ganada', resultado: '1-0', analisis: analisis([jugada(0, 900, 'w')]) });

    const resultado = ventajasDesperdiciadas([vieja, nueva, ganada]);
    expect(resultado.map((v) => v.gameId)).toEqual(['nueva', 'vieja']);
  });
});

describe('evaluarConversion', () => {
  // Terminarla sin ganar es fallar, pero no es que "la ventaja cayó": ahogar
  // al rival con diez peones de más termina la partida con la ventaja
  // intacta. Antes los dos fallos eran 'perdida' y compartían ese texto.
  it('ganar la partida es convertir; terminarla sin ganar es un fallo propio', () => {
    expect(evaluarConversion(0, true, true)).toBe('convertida');
    expect(evaluarConversion(0, true, false)).toBe('sin-ganar');
    expect(evaluarConversion(1000, true, false)).toBe('sin-ganar');
  });

  it('sostener la ventaja continúa; que caiga a menos de la mitad la da por perdida', () => {
    expect(evaluarConversion(400, false, false)).toBe('en-curso');
    expect(evaluarConversion(200, false, false)).toBe('en-curso');
    expect(evaluarConversion(120, false, false)).toBe('perdida');
    expect(evaluarConversion(-300, false, false)).toBe('perdida');
  });

  // N4 (auditoría 2026-10-15): el umbral es la mitad de la vara de RF-8.1
  // (+3), fijo, no la mitad del pico. Lo que muestra la pantalla sale de esta
  // misma constante (textoConversionPerdida, ui/format.ts).
  it('el umbral es +1,5 fijo: la mitad de la ventaja ganadora', () => {
    expect(UMBRAL_PERDIDA_CP).toBe(VENTAJA_GANADORA_CP / 2);
    expect(UMBRAL_PERDIDA_CP).toBe(150);
    expect(evaluarConversion(UMBRAL_PERDIDA_CP, false, false)).toBe('en-curso');
    expect(evaluarConversion(UMBRAL_PERDIDA_CP - 1, false, false)).toBe('perdida');
  });
});
