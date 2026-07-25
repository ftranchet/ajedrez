import { describe, expect, it } from 'vitest';
import {
  CANDIDATAS_IMPRECISION,
  UCI_ELO_MAX,
  UCI_ELO_MIN,
  clampUciElo,
  elegirJugadaConImprecision,
  eloAproximado,
  multiPvParaNivel,
} from './engineLevels';
import levelsConfig from '../config/engine-levels.json';
import type { EngineLevel } from './ports';

const LEVELS = levelsConfig.levels as EngineLevel[];

describe('clampUciElo', () => {
  it('respeta el rango que acepta Stockfish', () => {
    expect(clampUciElo(900)).toBe(UCI_ELO_MIN);
    expect(clampUciElo(5000)).toBe(UCI_ELO_MAX);
    expect(clampUciElo(1800)).toBe(1800);
  });

  it('un valor inválido cae al piso en vez de mandarle basura al motor', () => {
    expect(clampUciElo(Number.NaN)).toBe(UCI_ELO_MIN);
  });
});

describe('elegirJugadaConImprecision', () => {
  const jugadas = ['mejor', 'segunda', 'tercera', 'cuarta'];

  it('sin imprecisión siempre juega la mejor', () => {
    expect(elegirJugadaConImprecision(jugadas, 0, () => 0)).toBe('mejor');
    expect(elegirJugadaConImprecision(jugadas, 0, () => 0.99)).toBe('mejor');
  });

  it('con imprecisión juega una alternativa solo cuando el sorteo cae por debajo', () => {
    // rng 0,1 < 0,55 ⇒ se desvía; el segundo rng elige cuál.
    expect(elegirJugadaConImprecision(jugadas, 0.55, () => 0.1)).not.toBe('mejor');
    // rng 0,9 ≥ 0,55 ⇒ juega la mejor.
    expect(elegirJugadaConImprecision(jugadas, 0.55, () => 0.9)).toBe('mejor');
  });

  it('elige entre las alternativas del motor, nunca fuera de la lista', () => {
    const valores = [0.1, 0.99];
    let i = 0;
    const elegida = elegirJugadaConImprecision(jugadas, 1, () => valores[i++] ?? 0);
    expect(jugadas.slice(1)).toContain(elegida);
  });

  it('con una sola línea no puede desviarse, aunque la imprecisión sea alta', () => {
    expect(elegirJugadaConImprecision(['unica'], 1, () => 0)).toBe('unica');
  });

  it('sin jugadas devuelve null en vez de inventar una', () => {
    expect(elegirJugadaConImprecision([], 0.5, () => 0)).toBeNull();
  });
});

describe('multiPvParaNivel', () => {
  it('solo pide varias líneas cuando el nivel las necesita', () => {
    expect(multiPvParaNivel({})).toBe(1);
    expect(multiPvParaNivel({ imprecision: 0 })).toBe(1);
    expect(multiPvParaNivel({ imprecision: 0.3 })).toBe(CANDIDATAS_IMPRECISION);
  });
});

describe('eloAproximado', () => {
  it('un nivel sin imprecisión vale el Elo que se le pide al motor', () => {
    expect(eloAproximado({ uciElo: 1800 })).toBe(1800);
  });

  it('la imprecisión descuenta: el nivel juega por debajo de lo que se le pide', () => {
    expect(eloAproximado({ uciElo: 1320, imprecision: 0.55 })).toBeLessThan(1320);
  });
});

// El bug que motivó todo esto no era de código sino de configuración: los
// niveles existían, se enviaban al motor, y nadie había comprobado nunca que
// fueran distintos entre sí. Estas comprobaciones no reemplazan la medición
// real (scripts/measure-engine-levels.mjs juega los niveles entre sí), pero
// impiden que el catálogo vuelva a quedar plano por descuido.
describe('catálogo de niveles (RF-1.3)', () => {
  it('todos declaran un Elo dentro del rango del motor y un presupuesto positivo', () => {
    for (const level of LEVELS) {
      expect(level.uciElo).toBe(clampUciElo(level.uciElo));
      expect(level.movetimeMs).toBeGreaterThan(0);
      expect(level.imprecision ?? 0).toBeGreaterThanOrEqual(0);
      expect(level.imprecision ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it('la fuerza estimada crece de forma estricta del nivel 1 al 5', () => {
    const elos = LEVELS.map(eloAproximado);
    for (let i = 1; i < elos.length; i++) {
      expect(elos[i]).toBeGreaterThan(elos[i - 1]);
    }
  });

  it('cubre la banda de la persona objetivo del PRD (900–1900)', () => {
    const elos = LEVELS.map(eloAproximado);
    expect(Math.min(...elos)).toBeLessThanOrEqual(900);
    expect(Math.max(...elos)).toBeGreaterThanOrEqual(1900);
  });
});
