import { describe, expect, it } from 'vitest';
import {
  CP_MATE,
  UCI_ELO_MAX,
  UCI_ELO_MIN,
  clampUciElo,
  elegirJugadaPorTemperatura,
  multiPvParaNivel,
  puntajeComparable,
  type LineaCandidata,
} from './engineLevels';
import levelsConfig from '../config/engine-levels.json';
import type { EngineLevel } from './ports';

const LEVELS = levelsConfig.levels as EngineLevel[];

function linea(move: string, cp: number): LineaCandidata {
  return { move, cp, mateIn: null };
}

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

describe('puntajeComparable', () => {
  it('el mate es el extremo de la escala, en el signo que corresponde', () => {
    expect(puntajeComparable({ move: 'a', cp: null, mateIn: 3 })).toBe(CP_MATE);
    expect(puntajeComparable({ move: 'a', cp: null, mateIn: -2 })).toBe(-CP_MATE);
    expect(puntajeComparable(linea('a', 45))).toBe(45);
  });
});

describe('elegirJugadaPorTemperatura', () => {
  const lineas = [linea('mejor', 50), linea('media', -60), linea('mala', -400)];

  it('sin temperatura siempre juega la mejor', () => {
    expect(elegirJugadaPorTemperatura(lineas, 0, () => 0.99)).toBe('mejor');
    expect(elegirJugadaPorTemperatura(lineas, 0, () => 0)).toBe('mejor');
  });

  it('sin jugadas devuelve null en vez de inventar una', () => {
    expect(elegirJugadaPorTemperatura([], 200, () => 0)).toBeNull();
  });

  it('con una sola candidata no puede desviarse', () => {
    expect(elegirJugadaPorTemperatura([linea('unica', 0)], 500, () => 0.9)).toBe('unica');
  });

  // El mecanismo anterior elegía entre las cuatro mejores líneas de Stockfish,
  // que son todas buenas: producía un rival algo menos preciso, nunca uno débil.
  // La temperatura sí alcanza jugadas que pierden material.
  it('a temperatura alta, una jugada que cuelga material aparece de vez en cuando', () => {
    const elegidas = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const elegida = elegirJugadaPorTemperatura(lineas, 400, () => i / 100);
      if (elegida) elegidas.add(elegida);
    }
    expect(elegidas.has('mala')).toBe(true);
    expect(elegidas.has('mejor')).toBe(true);
  });

  it('a temperatura baja la mala prácticamente no sale', () => {
    const elegidas = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const elegida = elegirJugadaPorTemperatura(lineas, 20, () => i / 100);
      if (elegida) elegidas.add(elegida);
    }
    expect(elegidas.has('mala')).toBe(false);
  });

  it('cuanto peor la jugada, menos probable: el peso decae con la pérdida', () => {
    // Con dos candidatas, el dardo justo en el peso de la mejor separa las dos
    // regiones; una pérdida mayor achica la región de la alternativa.
    const cerca = [linea('mejor', 0), linea('otra', -50)];
    const lejos = [linea('mejor', 0), linea('otra', -600)];
    const alternativaCerca = elegirJugadaPorTemperatura(cerca, 100, () => 0.75);
    const alternativaLejos = elegirJugadaPorTemperatura(lejos, 100, () => 0.75);
    expect(alternativaCerca).toBe('otra');
    expect(alternativaLejos).toBe('mejor');
  });

  it('un mate a favor no se cambia por una jugada normal', () => {
    const conMate = [{ move: 'mate', cp: null, mateIn: 2 }, linea('normal', 300)];
    const elegidas = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const elegida = elegirJugadaPorTemperatura(conMate, 400, () => i / 50);
      if (elegida) elegidas.add(elegida);
    }
    expect([...elegidas]).toEqual(['mate']);
  });
});

describe('multiPvParaNivel', () => {
  it('un nivel sin candidatas pide una sola línea', () => {
    expect(multiPvParaNivel({})).toBe(1);
    expect(multiPvParaNivel({ candidatas: 0 })).toBe(1);
    expect(multiPvParaNivel({ candidatas: 12 })).toBe(12);
  });
});

// El bug que motivó todo esto no era de código sino de configuración: los
// niveles existían, se enviaban al motor, y nadie había comprobado nunca que
// fueran distintos entre sí. Estas comprobaciones no reemplazan la medición
// real (`npm run measure:niveles` mide centipeones perdidos por jugada y juega
// los niveles entre sí), pero impiden que el catálogo vuelva a quedar plano.
describe('catálogo de niveles (RF-1.3)', () => {
  it('todos declaran un Elo dentro del rango del motor y un presupuesto positivo', () => {
    for (const level of LEVELS) {
      expect(level.uciElo).toBe(clampUciElo(level.uciElo));
      expect(level.movetimeMs).toBeGreaterThan(0);
    }
  });

  it('la debilidad decrece de forma estricta del nivel 1 al 5', () => {
    const temperaturas = LEVELS.map((level) => level.temperaturaCp ?? 0);
    for (let i = 1; i < temperaturas.length; i++) {
      expect(temperaturas[i]).toBeLessThanOrEqual(temperaturas[i - 1]);
    }
    // Y el extremo débil tiene que ser realmente débil: por encima del umbral
    // de "error grave" del análisis (200 cp), no un rival apenas impreciso.
    expect(temperaturas[0]).toBeGreaterThan(200);
    // El extremo fuerte tampoco puede ser perfecto: un rival que nunca se
    // equivoca no se parece a nadie contra quien vayas a jugar, y medido daba
    // 1 cp/jugada — indistinguible del 3 y del 4 para cualquier humano.
    expect(temperaturas.at(-1)).toBeGreaterThan(0);
    expect(temperaturas.at(-1)).toBeLessThan(temperaturas[0]);
  });

  it('un nivel con temperatura pide varias candidatas, o no tendría entre qué elegir', () => {
    for (const level of LEVELS) {
      if ((level.temperaturaCp ?? 0) > 0) expect(multiPvParaNivel(level)).toBeGreaterThan(1);
    }
  });

  it('la fuerza pedida al motor no decrece', () => {
    const elos = LEVELS.map((level) => level.uciElo);
    for (let i = 1; i < elos.length; i++) {
      expect(elos[i]).toBeGreaterThanOrEqual(elos[i - 1]);
    }
  });
});
