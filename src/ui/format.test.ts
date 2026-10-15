import { describe, expect, it } from 'vitest';
import { buildGameAnalysis, lecturaMomentoCritico, type EngineEvalAtPly } from '../core/analysis';
import { posicionPropiaParaCalculo } from '../core/calculoPosicion';
import { ventajaDesperdiciada } from '../core/conversion';
import { CP_MATE } from '../core/engineLevels';
import type { Color, GameRecord, PhaseOneData } from '../core/types';
import { esMate, formatDecimal, formatDuracion, formatPeones, formatVentaja, fraseSaltoVentaja } from './format';
import { t } from './i18n/es';

describe('formato numérico de interfaz', () => {
  it('usa coma rioplatense y conserva la precisión solicitada', () => {
    expect(formatDecimal(1.2, 2)).toBe('1,20');
    expect(formatDecimal(0.875, 1)).toBe('0,9');
  });
});

describe('formatDuracion', () => {
  it('por debajo del minuto muestra segundos', () => {
    expect(formatDuracion(45_000)).toBe('45 s');
    expect(formatDuracion(0)).toBe('0 s');
  });

  it('desde un minuto redondea a minutos: el tiempo es profundidad, no una marca', () => {
    expect(formatDuracion(60_000)).toBe('1 min');
    expect(formatDuracion(720_000)).toBe('12 min');
    expect(formatDuracion(100_000)).toBe('2 min'); // 1 min 40 s redondea a 2
  });

  it('no produce duraciones negativas', () => {
    expect(formatDuracion(-1000)).toBe('0 s');
  });
});

describe('formatVentaja', () => {
  it('muestra peones con un decimal y el signo de quién está mejor', () => {
    expect(formatVentaja(120)).toBe('+1,2');
    expect(formatVentaja(-80)).toBe('−0,8');
  });

  it('la igualdad es 0,0 y nunca "−0,0"', () => {
    expect(formatVentaja(0)).toBe('0,0');
    expect(formatVentaja(-4)).toBe('0,0');
    expect(formatVentaja(4)).toBe('0,0');
  });

  it('usa el menos tipográfico, el mismo de los símbolos de evaluación', () => {
    expect(formatVentaja(-250)).toBe('−2,5');
    expect(formatVentaja(-250)).not.toContain('-');
  });

  // El mate se guarda como ±CP_MATE centipeones: dividido por cien salía
  // "+1000,0", una ventaja que no existe en ningún tablero (B7, RNF-10).
  it('el mate se nombra, no se cuenta: nunca "+1000,0"', () => {
    expect(formatVentaja(CP_MATE)).toBe('mate a favor');
    expect(formatVentaja(-CP_MATE)).toBe('mate en contra');
    expect(formatVentaja(CP_MATE)).not.toMatch(/\d/);
    expect(formatVentaja(-CP_MATE)).not.toMatch(/\d/);
  });

  it('una ventaja enorme pero sin mate sigue siendo un número', () => {
    // El umbral es el centinela del mate, no el tope de diez peones de la
    // aritmética: +15 es una ventaja real y llamarla mate sería inventar.
    expect(formatVentaja(1500)).toBe('+15,0');
    expect(formatVentaja(-2500)).toBe('−25,0');
    expect(esMate(1500)).toBe(false);
    expect(esMate(CP_MATE)).toBe(true);
    expect(esMate(-CP_MATE)).toBe(true);
  });
});

describe('fraseSaltoVentaja', () => {
  const analisis = { costo: t.analisis.momentoLecturaCosto, mate: t.analisis.momentoLecturaMate };

  it('sin mate dice el salto y lo que costó, en peones', () => {
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 150, ventajaDespues: -170, cpPerdidos: 320 })).toBe(
      'Esa jugada costó 3,2 peones: la evaluación pasó de +1,5 a −1,7.',
    );
  });

  // El costo sale de la escala acotada a diez peones, donde el mate vale diez:
  // "de +2,0 a mate en contra — costó 12,0 peones" es una cifra de esa
  // convención que el lector no puede reconstruir. Con el mate nombrado, el
  // salto ya dice qué se perdió.
  it('con mate en un extremo dice el salto sin costo en peones', () => {
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 200, ventajaDespues: -CP_MATE, cpPerdidos: 1200 })).toBe(
      'Con esa jugada la evaluación pasó de +2,0 a mate en contra.',
    );
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: CP_MATE, ventajaDespues: -CP_MATE, cpPerdidos: 2000 })).toBe(
      'Con esa jugada la evaluación pasó de mate a favor a mate en contra.',
    );
  });
});

// El caso real del hallazgo B7: el error más caro de una partida suele ser un
// mate desperdiciado, y es justo el que eligen la lectura del momento crítico
// y la posición propia de Cálculo.
describe('una partida cuyo error más caro desperdicia un mate', () => {
  const fase1: PhaseOneData = { momentoCriticoPly: 4, plan: 'atacar el enroque', evaluaciones: [], completadaEn: '2026-10-15T10:00:00.000Z' };

  function evalEn(ply: number, ladoQueMueve: Color, cpAntes: number): EngineEvalAtPly {
    return { ply, fen: `fen-${ply}`, san: `j${ply}`, ladoQueMueve, jugadaUsuario: 'a2a3', cpAntes, jugadaMotor: 'a2a4' };
  }

  function partida(jugadorColor: Color, evals: EngineEvalAtPly[], resultado: GameRecord['resultado']): GameRecord {
    return {
      id: 'g-mate',
      pgn: '*',
      fuente: 'local',
      ritmo: 'clasica',
      resultado,
      tiemposPorJugadaMs: [],
      analizada: true,
      fecha: '2026-10-15T10:00:00.000Z',
      jugadorColor,
      analisis: buildGameAnalysis(evals, null),
    };
  }

  // Blancas tienen mate en el ply 4 y juegan algo que deja "solo" +5: con la
  // escala acotada es la pérdida más grande de la partida (5 peones).
  const blancasTiranElMate = [
    evalEn(0, 'w', 30),
    evalEn(1, 'b', 40),
    evalEn(2, 'w', 350),
    evalEn(3, 'b', 900),
    evalEn(4, 'w', CP_MATE),
    evalEn(5, 'b', 500),
  ];

  it('la lectura del momento crítico nombra el mate en vez de mostrar "+1000,0"', () => {
    const lectura = lecturaMomentoCritico(buildGameAnalysis(blancasTiranElMate, fase1), fase1)!;
    expect(lectura.plyMotor).toBe(4);
    // El dominio no pierde información: la ventaja sigue siendo el mate.
    expect(lectura.ventajaAntes).toBe(CP_MATE);
    expect(formatVentaja(lectura.ventajaAntes)).not.toMatch(/1000/);
    expect(formatVentaja(lectura.ventajaAntes)).toBe('mate a favor');
    expect(fraseSaltoVentaja({ costo: t.analisis.momentoLecturaCosto, mate: t.analisis.momentoLecturaMate }, lectura)).toBe(
      'Con esa jugada la evaluación pasó de mate a favor a +5,0.',
    );
  });

  it('la posición propia de Cálculo, con negras: el mate es de quien movió', () => {
    // Perspectiva blancas: −CP_MATE es mate de las negras; después queda −300,
    // o sea +3 para las negras, que son el usuario.
    const negrasTiranElMate = [evalEn(0, 'w', -200), evalEn(1, 'b', -CP_MATE), evalEn(2, 'w', -300)];
    const posicion = posicionPropiaParaCalculo([partida('b', negrasTiranElMate, '1/2-1/2')])!;
    expect(posicion.ply).toBe(1);
    expect(posicion.ventajaAntes).toBe(CP_MATE);
    expect(fraseSaltoVentaja({ costo: t.stoyko.origenPropiaPeones, mate: t.stoyko.origenPropiaMate }, posicion)).toBe(
      'Posición de tu propia partida: acá tu ventaja pasó de mate a favor a +3,0. Volvés a tomar esa decisión.',
    );
  });

  it('la ventaja desperdiciada de Conversión conserva el mate y se reconoce como tal', () => {
    const ventaja = ventajaDesperdiciada(partida('w', blancasTiranElMate, '1/2-1/2'))!;
    expect(ventaja.ventajaCp).toBe(CP_MATE);
    expect(esMate(ventaja.ventajaCp)).toBe(true);
  });
});

describe('formatPeones', () => {
  // Lo que costó una jugada es una magnitud: "perdiste −2,5" es doble negación.
  it('no lleva signo: es cuánto costó, no una evaluación', () => {
    expect(formatPeones(250)).toBe('2,5');
    expect(formatPeones(-250)).toBe('2,5');
    expect(formatPeones(0)).toBe('0,0');
  });
});
