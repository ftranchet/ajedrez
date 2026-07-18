import { describe, expect, it } from 'vitest';
import { RADAR_INITIAL_STATE, adjustDifficulty, esRespuestaCorrectaRadar, explainFeedback, recordServed, selectNextRadarItem, type RadarSelectionState } from './radar';
import type { RadarItem, TipoRadar } from './types';

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

const TIPOS: TipoRadar[] = ['ofensiva', 'defensa', 'tranquila', 'genuina', 'envenenada'];

function buildPool(n: number): RadarItem[] {
  const pool: RadarItem[] = [];
  for (let i = 0; i < n; i++) {
    pool.push({
      id: `item-${i}`,
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      tipo: TIPOS[i % TIPOS.length],
      temas: [],
      // Módulo 13 (coprimo con el ciclo de 5 tipos) para que el rating no
      // quede correlacionado 1:1 con el tipo: todos los tipos existen en
      // toda la banda de rating, como en un dataset real.
      rating: 900 + (i % 13) * 50,
      solucion: ['e2e4'],
      fuente: 'seed-dev',
    });
  }
  return pool;
}

describe('selectNextRadarItem', () => {
  it('null con pool vacío', () => {
    expect(selectNextRadarItem([], RADAR_INITIAL_STATE)).toBeNull();
  });

  it('sobre 500 tiradas, aparecen los cinco tipos (mezcla, RF-5.1)', () => {
    const pool = buildPool(50);
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, ratingCentro: 1200 };
    const rng = seededRng(42);
    const vistos = new Set<TipoRadar>();
    for (let i = 0; i < 500; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      vistos.add(item.tipo);
      state = recordServed(state, item);
    }
    expect(vistos.size).toBe(5);
  });

  it('ningún tipo domina de forma determinista: la distribución no es un solo tipo', () => {
    const pool = buildPool(50);
    let state = RADAR_INITIAL_STATE;
    const rng = seededRng(7);
    const conteo: Record<string, number> = {};
    for (let i = 0; i < 500; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      conteo[item.tipo] = (conteo[item.tipo] ?? 0) + 1;
      state = recordServed(state, item);
    }
    const valores = Object.values(conteo);
    const max = Math.max(...valores);
    // ningún tipo se lleva más del 45% de las tiradas (mezcla real, no un tipo fijo)
    expect(max / 500).toBeLessThan(0.45);
  });

  it('no es una rotación fija predecible (mismo tipo puede repetirse alguna vez)', () => {
    const pool = buildPool(50);
    let state = RADAR_INITIAL_STATE;
    const rng = seededRng(99);
    const secuencia: TipoRadar[] = [];
    for (let i = 0; i < 300; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      secuencia.push(item.tipo);
      state = recordServed(state, item);
    }
    const repeticionesInmediatas = secuencia.slice(1).filter((t, i) => t === secuencia[i]).length;
    // Una rotación fija (round-robin) tendría 0 repeticiones inmediatas; acá
    // deben ocurrir algunas (penalización suave, no exclusión dura).
    expect(repeticionesInmediatas).toBeGreaterThan(0);
  });

  it('evita repetir el id exacto servido en la ventana reciente cuando hay alternativas', () => {
    const pool = buildPool(50);
    let state = RADAR_INITIAL_STATE;
    const rng = seededRng(3);
    let repetidoInmediato = 0;
    let anterior: string | null = null;
    for (let i = 0; i < 200; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      if (item.id === anterior) repetidoInmediato++;
      anterior = item.id;
      state = recordServed(state, item);
    }
    expect(repetidoInmediato).toBe(0);
  });

  it('respeta la banda de rating cuando hay candidatos suficientes', () => {
    const pool = buildPool(50);
    const state: RadarSelectionState = { ...RADAR_INITIAL_STATE, ratingCentro: 1000 };
    const rng = seededRng(1);
    const item = selectNextRadarItem(pool, state, rng);
    expect(item).not.toBeNull();
    expect(Math.abs(item!.rating - 1000)).toBeLessThanOrEqual(150);
  });
});

describe('adjustDifficulty', () => {
  it('sube el centro cuando el acierto reciente supera 80% (RF-5.5)', () => {
    const next = adjustDifficulty(RADAR_INITIAL_STATE, true, 0.9);
    expect(next.ratingCentro).toBeGreaterThan(RADAR_INITIAL_STATE.ratingCentro);
  });

  it('baja el centro cuando el acierto reciente cae debajo de 60%', () => {
    const next = adjustDifficulty(RADAR_INITIAL_STATE, false, 0.4);
    expect(next.ratingCentro).toBeLessThan(RADAR_INITIAL_STATE.ratingCentro);
  });

  it('dentro de la banda 60-80% hace ajustes chicos, no saltos', () => {
    const next = adjustDifficulty(RADAR_INITIAL_STATE, true, 0.7);
    expect(Math.abs(next.ratingCentro - RADAR_INITIAL_STATE.ratingCentro)).toBeLessThan(40);
  });

  it('no empuja el centro más allá del rango del catálogo (800–2000)', () => {
    // Sin tope, una racha sostenida dejaba el centro fuera del rango de
    // cualquier posición y el filtro por banda quedaba vacío para siempre.
    const arriba = adjustDifficulty({ ...RADAR_INITIAL_STATE, ratingCentro: 2000 }, true, 0.9);
    expect(arriba.ratingCentro).toBe(2000);
    const abajo = adjustDifficulty({ ...RADAR_INITIAL_STATE, ratingCentro: 800 }, false, 0.4);
    expect(abajo.ratingCentro).toBe(800);
  });
});

describe('explainFeedback', () => {
  const item: RadarItem = {
    id: 'x',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    tipo: 'tranquila',
    temas: [],
    rating: 1000,
    solucion: ['e2e4'],
    fuente: 'seed-dev',
  };

  it('explica también cuando no había táctica (RF-5.3), en fallo y en acierto', () => {
    const fallo = explainFeedback(item, false);
    const acierto = explainFeedback(item, true);
    expect(fallo.length).toBeGreaterThan(0);
    expect(acierto.length).toBeGreaterThan(0);
    expect(fallo).not.toBe(acierto);
  });

  it('da una explicación distinta para cada uno de los cinco tipos', () => {
    const tipos: RadarItem['tipo'][] = ['ofensiva', 'defensa', 'tranquila', 'genuina', 'envenenada'];
    const textos = tipos.map((tipo) => explainFeedback({ ...item, tipo }, false));
    expect(new Set(textos).size).toBe(5);
  });
});

describe('esRespuestaCorrectaRadar', () => {
  const base: RadarItem = {
    id: 'q1',
    fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    tipo: 'tranquila',
    temas: [],
    rating: 1200,
    solucion: ['e2e4'],
    fuente: 'pipeline-tranquilas',
  };

  it('la jugada canónica siempre acierta', () => {
    expect(esRespuestaCorrectaRadar(base, 'e2e4')).toBe(true);
  });

  it('sin jugadasAceptables, cualquier otra jugada falla', () => {
    expect(esRespuestaCorrectaRadar(base, 'd2d4')).toBe(false);
  });

  it('una jugada equivalente listada en jugadasAceptables también acierta (RF-5.3)', () => {
    const conAlt: RadarItem = { ...base, jugadasAceptables: ['d2d4', 'g1f3'] };
    expect(esRespuestaCorrectaRadar(conAlt, 'd2d4')).toBe(true);
    expect(esRespuestaCorrectaRadar(conAlt, 'g1f3')).toBe(true);
    // Una que no está listada sigue siendo fallo.
    expect(esRespuestaCorrectaRadar(conAlt, 'a2a3')).toBe(false);
  });
});
