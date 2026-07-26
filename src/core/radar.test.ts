import { describe, expect, it } from 'vitest';
import { RADAR_INITIAL_STATE, OWN_ERROR_RADAR_MAX_SHARE, adjustDifficulty, centroInicialDesdeDiagnostico, dificultadNormalizada, esRespuestaCorrectaRadar, explainFeedback, isOwnErrorRadarItem, ownErrorRadarItems, recordServed, scheduleOwnErrorRadarSlots, selectNextRadarItem, type RadarSelectionState } from './radar';
import type { RadarItem, TipoRadar } from './types';
import { buildErrorCard } from './errorCard';
import { seedRadarItems } from '../services/puzzles/seedData';

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
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 50 };
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

  // Medido con `npm run measure:radar` antes del arreglo: evitando solo los 8
  // ids más recientes —una sesión— una posición volvía AL DÍA SIGUIENTE en las
  // cinco bandas de la dieta, y a los 30 días el usuario había visto 33–48 de
  // las 116. Una táctica que uno recuerda no entrena nada.
  it('una posición no vuelve en la sesión siguiente cuando el pool da para más', () => {
    // Pool grande a propósito: acá la banda tiene 36 posiciones, así que la
    // ventana (60% = 21) cubre de sobra una sesión de 8.
    const pool = buildPool(120);
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 50 };
    const rng = seededRng(21);
    const sesiones: string[][] = [];
    for (let sesion = 0; sesion < 2; sesion++) {
      const servidas: string[] = [];
      for (let i = 0; i < 8; i++) {
        const item = selectNextRadarItem(pool, state, rng);
        if (!item) continue;
        servidas.push(item.id);
        state = recordServed(state, item);
      }
      sesiones.push(servidas);
    }
    const primera = new Set(sesiones[0]);
    expect(sesiones[1].filter((id) => primera.has(id))).toEqual([]);
  });

  it('con una banda chica la ventana se recorta, pero sigue siendo la más ancha posible', () => {
    // Con 16 posiciones alcanzables no hay manera de proteger 8 por sesión
    // entera: lo honesto es evitar todo lo que se pueda (60% = 9) y no fingir
    // una garantía que el catálogo no da.
    const pool = buildPool(50); // banda de 16 en el centro 50
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 50 };
    const rng = seededRng(21);
    const servidas: string[] = [];
    for (let i = 0; i < 30; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      servidas.push(item.id);
      state = recordServed(state, item);
    }
    for (let i = 9; i < servidas.length; i++) {
      expect(servidas.slice(i - 9, i)).not.toContain(servidas[i]);
    }
  });

  it('la ventana se achica con el pool en vez de vaciar la selección', () => {
    // Con 6 posiciones no hay forma de no repetir: lo que no puede pasar es
    // que el filtro se quede sin candidatos y deje de servir.
    const pool = buildPool(6);
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 50 };
    const rng = seededRng(4);
    for (let i = 0; i < 60; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      expect(item).not.toBeNull();
      state = recordServed(state, item!);
    }
  });

  it('la memoria de ids no crece sin límite', () => {
    const pool = buildPool(50);
    let state: RadarSelectionState = RADAR_INITIAL_STATE;
    const rng = seededRng(8);
    for (let i = 0; i < 400; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      state = recordServed(state, item!);
    }
    expect(state.historialIds.length).toBeLessThanOrEqual(120);
  });

  it('respeta la banda normalizada cuando hay candidatos suficientes', () => {
    const pool = buildPool(50);
    const state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 50 };
    const rng = seededRng(1);
    const item = selectNextRadarItem(pool, state, rng);
    expect(item).not.toBeNull();
    expect(Math.abs(dificultadNormalizada(item!, pool) - 50)).toBeLessThanOrEqual(15);
  });

  it('no mezcla escalas: el punto medio de fuentes con ratings incompatibles vale lo mismo', () => {
    const base = buildPool(2)[0];
    const pool: RadarItem[] = [
      { ...base, id: 'lichess-bajo', fuente: 'lichess-cc0', rating: 800 },
      { ...base, id: 'lichess-medio', fuente: 'lichess-cc0', rating: 1200 },
      { ...base, id: 'lichess-alto', fuente: 'lichess-cc0', rating: 2000 },
      { ...base, id: 'quiet-bajo', fuente: 'pipeline-tranquilas', rating: 1300 },
      { ...base, id: 'quiet-medio', fuente: 'pipeline-tranquilas', rating: 1700 },
      { ...base, id: 'quiet-alto', fuente: 'pipeline-tranquilas', rating: 2300 },
    ];
    expect(dificultadNormalizada(pool[1], pool)).toBe(50);
    expect(dificultadNormalizada(pool[4], pool)).toBe(50);
  });

  // `selectNextRadarItem` dejó de llamar a `dificultadNormalizada` por ítem
  // (filtraba y ordenaba el pool entero cada vez: 67 ms por selección con 2000
  // posiciones) y precalcula los percentiles de una pasada. El atajo solo vale
  // si da exactamente lo mismo, y eso no se puede afirmar leyéndolo.
  it('el atajo de percentiles coincide con dificultadNormalizada en todo el catálogo', () => {
    const pool = [...seedRadarItems];
    // La banda de selección es el único consumidor del atajo: si algún ítem
    // difiriera, entraría o saldría de la banda y la selección cambiaría.
    for (const centro of [0, 20, 50, 65, 80, 100]) {
      const porFuncionPublica = pool
        .filter((item) => Math.abs(dificultadNormalizada(item, pool) - centro) <= 15)
        .map((item) => item.id)
        .sort();
      const state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: centro };
      // Se sirve todo el catálogo con memoria vacía y ventana 0: sin descarte
      // por repetición, lo servible es exactamente la banda (más el rescate).
      const servibles = new Set<string>();
      const rng = seededRng(centro + 1);
      for (let i = 0; i < 2000; i++) {
        const item = selectNextRadarItem(pool, state, rng);
        if (item) servibles.add(item.id);
      }
      // Todo lo que la función pública pone en la banda tiene que ser servible.
      for (const id of porFuncionPublica) expect(servibles.has(id), `${id} en centro ${centro}`).toBe(true);
    }
  });

  it('una cohorte de rating constante queda honestamente en el centro', () => {
    const base = buildPool(2)[0];
    const pool: RadarItem[] = [
      { ...base, id: 'a', fuente: 'pipeline-envenenada', rating: 1500 },
      { ...base, id: 'b', fuente: 'pipeline-envenenada', rating: 1500 },
    ];
    expect(dificultadNormalizada(pool[0], pool)).toBe(50);
    expect(dificultadNormalizada(pool[1], pool)).toBe(50);
  });
});

// El lote publicado reproduce esto tal cual: las 8 envenenadas y las 8 de
// doble solución vienen de autojuego, todas con rating fijo 1500, y por eso
// viven exactamente en el percentil 50. Medido antes del arreglo: con el
// centro adaptativo en 70 o más, el Radar servía CERO ofertas envenenadas.
describe('cobertura de tipos fuera de la banda (RF-5.1)', () => {
  /** Catálogo con la forma del real: un tipo entero encerrado en el percentil 50. */
  function poolConTipoEncerrado(): RadarItem[] {
    const base = buildPool(1)[0];
    const calibradas: RadarItem[] = Array.from({ length: 40 }, (_, i) => ({
      ...base,
      id: `cc0-${i}`,
      tipo: TIPOS[i % 4], // los cuatro tipos con rating calibrado
      fuente: 'lichess-cc0',
      rating: 800 + i * 30,
    }));
    const generadas: RadarItem[] = Array.from({ length: 8 }, (_, i) => ({
      ...base,
      id: `enven-${i}`,
      tipo: 'envenenada',
      fuente: 'pipeline-envenenada',
      rating: 1500, // cohorte constante ⇒ percentil 50 para todas
    }));
    return [...calibradas, ...generadas];
  }

  it('un usuario que mejora sigue viendo ofertas envenenadas', () => {
    const pool = poolConTipoEncerrado();
    // 85 está a 35 percentiles del 50: muy afuera de la banda de ±15.
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 85 };
    const rng = seededRng(7);
    const vistos = new Set<TipoRadar>();
    for (let i = 0; i < 300; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      vistos.add(item.tipo);
      state = recordServed(state, item);
    }
    // Sin el rescate esto era 0: "capturar siempre está bien" pasaba a ser
    // cierto el 100% de las veces, que es el patrón trivial que RF-5.1 prohíbe.
    expect(vistos.has('envenenada')).toBe(true);
    expect(vistos.size).toBe(5);
  });

  it('tampoco desaparece en el extremo fácil de la escala', () => {
    const pool = poolConTipoEncerrado();
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 5 };
    const rng = seededRng(11);
    const vistos = new Set<TipoRadar>();
    for (let i = 0; i < 300; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      vistos.add(item.tipo);
      state = recordServed(state, item);
    }
    expect(vistos.has('envenenada')).toBe(true);
  });

  it('el rescate no inunda la sesión con el tipo escaso', () => {
    const pool = poolConTipoEncerrado();
    let state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 85 };
    const rng = seededRng(3);
    let envenenadas = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      if (!item) continue;
      if (item.tipo === 'envenenada') envenenadas++;
      state = recordServed(state, item);
    }
    // Presente de verdad, pero sin desplazar al catálogo calibrado: 8
    // posiciones no pueden sostener un tercio de las sesiones sin volverse
    // memorizadas.
    expect(envenenadas).toBeGreaterThan(total * 0.05);
    expect(envenenadas).toBeLessThan(total * 0.35);
  });

  it('cuando la banda ya cubre todos los tipos, no rescata nada', () => {
    // buildPool reparte los cinco tipos por toda la escala de rating: la banda
    // de ±15 alcanza para todos y la selección tiene que seguir respetándola.
    const pool = buildPool(50);
    const state: RadarSelectionState = { ...RADAR_INITIAL_STATE, dificultadCentro: 50 };
    const rng = seededRng(5);
    for (let i = 0; i < 50; i++) {
      const item = selectNextRadarItem(pool, state, rng);
      expect(Math.abs(dificultadNormalizada(item!, pool) - 50)).toBeLessThanOrEqual(15);
    }
  });
});

describe('errores propios dentro del Radar (RF-5.9)', () => {
  const ownCard = buildErrorCard({
    id: 'partida-1',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    ladoAMover: 'w',
    jugadaUsuario: 'f2f3',
    jugadaCorrecta: 'g1f3',
    categoria: 'posicional',
    origen: 'partida',
  });

  it('recicla solo tarjetas de partidas propias y excluye las que ya van a la Cola', () => {
    const radarCard = { ...ownCard, id: 'radar-1', origen: 'radar' as const };
    const excludedCard = { ...ownCard, id: 'partida-vencida' };
    const items = ownErrorRadarItems([ownCard, radarCard, excludedCard], ['partida-vencida']);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'error-propio:partida-1',
      errorCardId: 'partida-1',
      fuente: 'error-propio',
      solucion: ['g1f3'],
    });
    expect(isOwnErrorRadarItem(items[0])).toBe(true);
  });

  it('reserva lugares aleatorios sin superar un cuarto del bloque', () => {
    const slots = scheduleOwnErrorRadarSlots(10, 20, seededRng(19));
    expect(slots).toHaveLength(Math.floor(10 * OWN_ERROR_RADAR_MAX_SHARE));
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots.every((slot) => slot >= 0 && slot < 10)).toBe(true);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
  });

  it('no inventa cupo si no hay errores propios o el bloque es demasiado corto', () => {
    expect(scheduleOwnErrorRadarSlots(8, 0, seededRng(1))).toEqual([]);
    expect(scheduleOwnErrorRadarSlots(3, 3, seededRng(1))).toEqual([]);
  });

  it('registra el id reciclado sin contaminar el historial de tipos del catálogo', () => {
    const item = ownErrorRadarItems([ownCard])[0];
    const initial = { ...RADAR_INITIAL_STATE, historialTipos: ['defensa' as const] };
    const next = recordServed(initial, item);
    expect(next.historialIds).toContain('error-propio:partida-1');
    expect(next.historialTipos).toEqual(['defensa']);
  });
});

describe('adjustDifficulty', () => {
  it('sube el centro cuando el acierto reciente supera 80% (RF-5.5)', () => {
    const next = adjustDifficulty(RADAR_INITIAL_STATE, true, 0.9);
    expect(next.dificultadCentro).toBeGreaterThan(RADAR_INITIAL_STATE.dificultadCentro);
  });

  it('baja el centro cuando el acierto reciente cae debajo de 60%', () => {
    const next = adjustDifficulty(RADAR_INITIAL_STATE, false, 0.4);
    expect(next.dificultadCentro).toBeLessThan(RADAR_INITIAL_STATE.dificultadCentro);
  });

  it('dentro de la banda 60-80% hace ajustes chicos, no saltos', () => {
    const next = adjustDifficulty(RADAR_INITIAL_STATE, true, 0.7);
    expect(Math.abs(next.dificultadCentro - RADAR_INITIAL_STATE.dificultadCentro)).toBeLessThan(4);
  });

  it('no empuja el centro más allá del rango normalizado 0–100', () => {
    // Sin tope, una racha sostenida dejaba el centro fuera del rango de
    // cualquier posición y el filtro por banda quedaba vacío para siempre.
    const arriba = adjustDifficulty({ ...RADAR_INITIAL_STATE, dificultadCentro: 100 }, true, 0.9);
    expect(arriba.dificultadCentro).toBe(100);
    const abajo = adjustDifficulty({ ...RADAR_INITIAL_STATE, dificultadCentro: 0 }, false, 0.4);
    expect(abajo.dificultadCentro).toBe(0);
  });
});

describe('explainFeedback', () => {
  const item: RadarItem = {
    id: 'x',
    // Posición real: desde la ronda C el texto se deriva del tablero.
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
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

describe('centroInicialDesdeDiagnostico (RF-11.4 → RF-5.5)', () => {
  it('acertar en la banda objetivo deja el centro neutral', () => {
    expect(centroInicialDesdeDiagnostico(0.7)).toBe(RADAR_INITIAL_STATE.dificultadCentro);
  });

  it('acertar de más arranca en posiciones más difíciles, y al revés', () => {
    expect(centroInicialDesdeDiagnostico(0.9)).toBeGreaterThan(RADAR_INITIAL_STATE.dificultadCentro);
    expect(centroInicialDesdeDiagnostico(0.4)).toBeLessThan(RADAR_INITIAL_STATE.dificultadCentro);
  });

  it('queda siempre dentro de 0–100, incluso en los extremos', () => {
    expect(centroInicialDesdeDiagnostico(1)).toBeLessThanOrEqual(100);
    expect(centroInicialDesdeDiagnostico(0)).toBeGreaterThanOrEqual(0);
    // Valores fuera de rango (no deberían llegar) se acotan en vez de romper.
    expect(centroInicialDesdeDiagnostico(5)).toBeLessThanOrEqual(100);
    expect(centroInicialDesdeDiagnostico(-3)).toBeGreaterThanOrEqual(0);
  });

  it('el centro sembrado sirve para seleccionar: un usuario fuerte no arranca en posiciones fáciles', () => {
    const pool: RadarItem[] = Array.from({ length: 20 }, (_, index) => ({
      id: `item-${index}`,
      fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
      tipo: 'ofensiva',
      temas: [],
      rating: 1000 + index * 100,
      solucion: ['a1a2'],
      fuente: 'lichess-cc0',
    }));
    const state = { ...RADAR_INITIAL_STATE, dificultadCentro: centroInicialDesdeDiagnostico(0.95) };
    const elegido = selectNextRadarItem(pool, state, () => 0.5);
    expect(elegido).not.toBeNull();
    expect(elegido!.rating).toBeGreaterThan(1000 + 9 * 100);
  });
});
