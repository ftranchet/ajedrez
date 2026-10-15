import { describe, expect, it } from 'vitest';
import { buildExportBundle, validateImportBundle } from './exportData';
import { DEFAULT_PROFILE } from './prescriptor';
import { startN1Experiment } from './n1Experiment';
import { SCHEMA_VERSION } from '../services/storage/db';

const empty = {
  games: [],
  errorCards: [],
  calibrationRecords: [],
  radarProgress: [],
  radarAttempts: [],
  curriculumProgress: [],
  profile: DEFAULT_PROFILE,
  candidataAttempts: [],
  compromisoAttempts: [],
  calculoAttempts: [],
  dobleSolucionAttempts: [],
  stoykoAttempts: [],
  triageAttempts: [],
  sessions: [],
  transferMeasurements: [],
  n1Experiments: [],
  dailyAssignments: [],
  trainingEvents: [],
};

describe('buildExportBundle', () => {
  it('incluye la versión de esquema actual y la fecha de exportación', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const bundle = buildExportBundle(empty, now);
    expect(bundle.manifest.esquema).toBe(SCHEMA_VERSION);
    expect(bundle.manifest.exportadoEn).toBe(now.toISOString());
    expect(bundle.manifest.app).toBe('elomax');
  });
});

describe('validateImportBundle', () => {
  it('acepta un paquete bien formado (round-trip con buildExportBundle)', () => {
    const bundle = buildExportBundle(empty);
    const result = validateImportBundle(JSON.parse(JSON.stringify(bundle)));
    expect(result.ok).toBe(true);
  });

  it('rechaza algo que no es un objeto', () => {
    expect(validateImportBundle('texto').ok).toBe(false);
    expect(validateImportBundle(null).ok).toBe(false);
    expect(validateImportBundle(42).ok).toBe(false);
  });

  it('rechaza un objeto sin manifiesto', () => {
    const result = validateImportBundle({ games: [], errorCards: [], calibrationRecords: [] });
    expect(result.ok).toBe(false);
  });

  it('rechaza un esquema más nuevo que el soportado (RF-14.2, migración futura)', () => {
    const result = validateImportBundle({
      manifest: { esquema: SCHEMA_VERSION + 1, exportadoEn: '2026-07-17T00:00:00.000Z', app: 'elomax' },
      games: [],
      errorCards: [],
      calibrationRecords: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('más nueva');
  });

  it('rechaza si falta alguna colección', () => {
    const result = validateImportBundle({
      manifest: { esquema: SCHEMA_VERSION, exportadoEn: '2026-07-17T00:00:00.000Z', app: 'elomax' },
      games: [],
    });
    expect(result.ok).toBe(false);
  });

  it('acepta un respaldo de antes de Fase 3, sin progreso del currículo ni perfil', () => {
    const result = validateImportBundle({
      manifest: { esquema: SCHEMA_VERSION, exportadoEn: '2026-07-17T00:00:00.000Z', app: 'elomax' },
      games: [],
      errorCards: [],
      calibrationRecords: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.curriculumProgress).toEqual([]);
      expect(result.bundle.profile).toEqual(DEFAULT_PROFILE);
      expect(result.bundle.sessions).toEqual([]);
    }
  });

  it('rechaza una sesión corrupta antes de restaurar', () => {
    const bundle = buildExportBundle({
      ...empty,
      sessions: [{ id: 's1', fechaInicio: '2026-07-19T10:00:00.000Z', estado: 'completada', bloques: [] }],
      transferMeasurements: [],
    });
    const raw = JSON.parse(JSON.stringify(bundle));
    raw.sessions[0].bloques = 'no-es-array';
    const result = validateImportBundle(raw);
    expect(result.ok).toBe(false);
  });

  it('acepta perfiles anteriores sin plan y rechaza un plan semanal inválido', () => {
    const legacy = buildExportBundle({
      ...empty,
      profile: { id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: null },
    });
    expect(validateImportBundle(JSON.parse(JSON.stringify(legacy))).ok).toBe(true);

    const corrupt = JSON.parse(JSON.stringify(buildExportBundle(empty)));
    corrupt.profile.planSemanal = { sesionesObjetivo: 12, minutosObjetivo: 0 };
    expect(validateImportBundle(corrupt).ok).toBe(false);
  });

  it('acepta preferencias sensoriales explícitas y rechaza valores corruptos', () => {
    const valid = JSON.parse(JSON.stringify(buildExportBundle({
      ...empty,
      profile: {
        ...DEFAULT_PROFILE,
        preferenciasSensoriales: { sonido: true, vibracion: false },
      },
    })));
    expect(validateImportBundle(valid).ok).toBe(true);

    valid.profile.preferenciasSensoriales.sonido = 'sí';
    expect(validateImportBundle(valid).ok).toBe(false);
  });

  it('rechaza un experimento n=1 corrupto antes de restaurar', () => {
    const bundle = buildExportBundle(empty);
    const raw = JSON.parse(JSON.stringify(bundle));
    raw.n1Experiments = [{
      id: 'n1-corrupto',
      estado: 'activo',
      creadoEn: '2026-07-19T00:00:00.000Z',
      modalidadA: 'radar',
      modalidadB: 'radar',
      dosisSemanalA: 20,
      dosisSemanalB: 20,
      lineaBase: { erroresGravesPorPartida: null, partidasAnalizadas: 0, rating: null, registradaEn: '2026-07-19T00:00:00.000Z' },
      fases: [],
    }];
    expect(validateImportBundle(raw).ok).toBe(false);
  });

  it('rechaza un esquema fraccional (B17)', () => {
    const raw = JSON.parse(JSON.stringify(buildExportBundle(empty)));
    raw.manifest.esquema = 17.5;
    const result = validateImportBundle(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('inválida');
  });

  it('un esquema fraccional mayor que el actual también es inválido, no "más nuevo"', () => {
    // "Actualizá la app" no arreglaría nada: no existe ninguna versión 20,5.
    const raw = JSON.parse(JSON.stringify(buildExportBundle(empty)));
    raw.manifest.esquema = SCHEMA_VERSION + 0.5;
    const result = validateImportBundle(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('inválida');
      expect(result.error).not.toContain('Actualizá');
    }
  });
});

// B10: de nueve tablas solo se miraba que fueran listas. Un registro sin `id`
// llegaba al `bulkPut`, la escritura lanzaba `DataError` y la restauración
// terminaba en una excepción sin mensaje; un enumerado desconocido entraba y
// rompía después, lejos del respaldo que lo trajo.
describe('validación por registro de todas las tablas (B10, RF-14.2)', () => {
  type Registro = Record<string, unknown>;
  const TABLAS = [
    'games',
    'errorCards',
    'calibrationRecords',
    'radarProgress',
    'radarAttempts',
    'curriculumProgress',
    'candidataAttempts',
    'compromisoAttempts',
    'calculoAttempts',
    'dobleSolucionAttempts',
    'stoykoAttempts',
    'triageAttempts',
    'sessions',
    'transferMeasurements',
    'n1Experiments',
    'dailyAssignments',
    'trainingEvents',
  ] as const;
  type Tabla = (typeof TABLAS)[number];
  const F = '2026-07-19T10:00:00.000Z';
  const FSRS = {
    due: F, stability: 1, difficulty: 5, elapsedDays: 0, scheduledDays: 0,
    reps: 1, lapses: 0, learningSteps: 0, state: 'learning', lastReview: F,
  };

  /**
   * Un registro por tabla con solo los campos obligatorios: es lo que trae un
   * respaldo viejo, anterior a los opcionales (`dificultadNormalizada`,
   * `origenContenido`, `evalGuess`, `tiempoMs`…), y tiene que seguir
   * restaurándose.
   */
  function respaldoCompleto(): Record<Tabla, Registro[]> & { manifest: Registro; profile: unknown } {
    return JSON.parse(JSON.stringify({
      manifest: { esquema: SCHEMA_VERSION, exportadoEn: F, app: 'elomax' },
      profile: DEFAULT_PROFILE,
      games: [{ id: 'g1', pgn: '1. e4 *', fecha: F, fuente: 'local', ritmo: 'sin-reloj', resultado: '*', analizada: false, tiemposPorJugadaMs: [] }],
      errorCards: [{
        id: 'card-1', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', ladoAMover: 'w', jugadaUsuario: 'a1a2',
        jugadaCorrecta: 'a1b1', categoria: 'tactico', origen: 'partida', creadaEn: F, fsrs: FSRS,
      }],
      calibrationRecords: [{ id: 'cal-1', contexto: 'radar', confianzaDeclarada: 70, acierto: true, fecha: F }],
      radarProgress: [{ id: 'principal', historialTipos: ['tranquila'], historialIds: ['radar-1'], aciertosRecientes: [true], updatedAt: F }],
      radarAttempts: [{ id: 'r1', itemId: 'radar-1', tipo: 'tranquila', rating: 1200, acierto: true, fecha: F }],
      curriculumProgress: [{ id: 'patron-1', fsrs: FSRS, demostracionesLimpias: 1, updatedAt: F }],
      candidataAttempts: [{ id: 'cand-1', itemId: 'radar-1', cambio: false, resultado: 'sin-cambio', fecha: F }],
      compromisoAttempts: [{ id: 'comp-1', itemId: 'radar-1', profundidad: 3, correcta: true, primerErrorEn: null, fecha: F }],
      calculoAttempts: [{ id: 'calc-1', preset: 'abierto', ramas: [{ linea: ['e2e4'], evaluacion: '=' }], fecha: F }],
      dobleSolucionAttempts: [{ id: 'ds-1', itemId: 'radar-1', resultado: 'familiar', fecha: F }],
      stoykoAttempts: [{
        id: 'st-1', itemId: 'stoyko-01', candidatas: [{ jugada: 'e2e4', evaluacion: '=' }],
        acierto: true, confianzaDeclarada: 70, tiempoMs: 12_000, fecha: F,
      }],
      triageAttempts: [{ id: 'tr-1', itemId: 'radar-1', tipo: 'ofensiva', decisionUsuario: 'calcular', decisionCorrecta: 'calcular', correcta: true, fecha: F }],
      sessions: [{ id: 'ses-1', fechaInicio: F, estado: 'completada', bloques: [] }],
      transferMeasurements: [{ id: 'transfer-1', datasetVersion: 'transfer-v1', startedAt: F, completedAt: null, responses: [] }],
      n1Experiments: [startN1Experiment(
        { modalidadA: 'radar', modalidadB: 'calculo', dosisSemanalA: 24, dosisSemanalB: 3 },
        { games: [], sessions: [], calculoAttempts: [] },
        new Date(F),
        'n1-1',
      )],
      dailyAssignments: [{ id: '2026-07-19', creadoEn: F, bloques: [] }],
      trainingEvents: [{ id: 'final:f1:1', modalidad: 'final', fecha: F, ms: 480_000 }],
    }));
  }

  const sin = (registro: Registro, campo: string): Registro => {
    const copia = { ...registro };
    delete copia[campo];
    return copia;
  };

  it('acepta un registro mínimo en cada tabla, sin los campos opcionales que un respaldo viejo no trae', () => {
    const result = validateImportBundle(respaldoCompleto());
    expect(result.ok).toBe(true);
  });

  it('acepta campos desconocidos: una versión más nueva puede sumarlos sin cambiar de esquema', () => {
    const raw = respaldoCompleto();
    for (const tabla of TABLAS) raw[tabla] = raw[tabla].map((registro) => ({ ...registro, campoNuevo: 'x' }));
    // Campos opcionales de esta versión: los contadores del acierto (RF-6.5) y
    // el día de entrada de una tarjeta diferida (ADR-0017).
    raw.curriculumProgress = [{ ...raw.curriculumProgress[0]!, intentos: 4, aciertos: 3 }];
    raw.errorCards = [{ ...raw.errorCards[0]!, entraEn: '2026-10-16' }];
    expect(validateImportBundle(raw).ok).toBe(true);
  });

  it.each([
    ['contadores de texto, que la suma concatena ("3" + 1 = "31")', { intentos: '3', aciertos: '3' }],
    ['más aciertos que intentos', { intentos: 2, aciertos: 3 }],
    ['un contador sin el otro', { intentos: 4 }],
    ['contadores negativos o fraccionarios', { intentos: -1, aciertos: 0.5 }],
    ['un acierto nulo', { intentos: 4, aciertos: null }],
  ])('rechaza un progreso del currículo con %s', (_, contadores) => {
    const raw = respaldoCompleto();
    raw.curriculumProgress = [{ ...raw.curriculumProgress[0]!, ...contadores }];
    expect(validateImportBundle(raw).ok).toBe(false);
  });

  it('rechaza un día de entrada que no tiene forma de día', () => {
    const raw = respaldoCompleto();
    raw.errorCards = [{ ...raw.errorCards[0]!, entraEn: '16/10/2026' }];
    expect(validateImportBundle(raw).ok).toBe(false);
  });

  it.each(TABLAS)('rechaza un registro sin id en %s', (tabla) => {
    const raw = respaldoCompleto();
    raw[tabla] = [sin(raw[tabla][0]!, 'id')];
    expect(validateImportBundle(raw).ok).toBe(false);
  });

  it('rechaza un id vacío o que no es texto', () => {
    const vacio = respaldoCompleto();
    vacio.radarAttempts = [{ ...vacio.radarAttempts[0]!, id: '' }];
    expect(validateImportBundle(vacio).ok).toBe(false);

    const numerico = respaldoCompleto();
    numerico.triageAttempts = [{ ...numerico.triageAttempts[0]!, id: 7 }];
    expect(validateImportBundle(numerico).ok).toBe(false);
  });

  const corrupciones: Array<[string, Tabla, (registro: Registro) => Registro]> = [
    ['una tarjeta con una categoría desconocida', 'errorCards', (r) => ({ ...r, categoria: 'tactica' })],
    ['una tarjeta con un origen desconocido', 'errorCards', (r) => ({ ...r, origen: 'leccion' })],
    ['una tarjeta con un estado FSRS desconocido', 'errorCards', (r) => ({ ...r, fsrs: { ...FSRS, state: 'nueva' } })],
    ['un progreso del Radar con un tipo desconocido en el historial', 'radarProgress', (r) => ({ ...r, historialTipos: ['tactica'] })],
    ['un progreso del Radar sin historial de ids', 'radarProgress', (r) => sin(r, 'historialIds')],
    ['un progreso del Radar con aciertos que no son booleanos', 'radarProgress', (r) => ({ ...r, aciertosRecientes: ['sí'] })],
    ['un progreso del Radar con un centro de dificultad que no es número', 'radarProgress', (r) => ({ ...r, dificultadCentro: '50' })],
    ['una respuesta del Radar con un tipo desconocido', 'radarAttempts', (r) => ({ ...r, tipo: 'tactica' })],
    ['una respuesta del Radar sin ítem', 'radarAttempts', (r) => sin(r, 'itemId')],
    ['una respuesta del Radar sin acierto', 'radarAttempts', (r) => sin(r, 'acierto')],
    ['una respuesta del Radar sin fecha', 'radarAttempts', (r) => sin(r, 'fecha')],
    ['una respuesta del Radar con un origen desconocido', 'radarAttempts', (r) => ({ ...r, origenContenido: 'otro' })],
    ['una respuesta del Radar con una dificultad que no es número', 'radarAttempts', (r) => ({ ...r, dificultadNormalizada: '50' })],
    ['un progreso del currículo sin FSRS', 'curriculumProgress', (r) => sin(r, 'fsrs')],
    ['un progreso del currículo con un estado FSRS desconocido', 'curriculumProgress', (r) => ({ ...r, fsrs: { ...FSRS, state: 'nueva' } })],
    ['un progreso del currículo sin demostraciones limpias', 'curriculumProgress', (r) => sin(r, 'demostracionesLimpias')],
    ['un progreso del currículo sin fecha de actualización', 'curriculumProgress', (r) => sin(r, 'updatedAt')],
    ['un intento de candidatas con un resultado desconocido', 'candidataAttempts', (r) => ({ ...r, resultado: 'igual' })],
    ['un intento de candidatas sin cambio', 'candidataAttempts', (r) => sin(r, 'cambio')],
    ['un intento comprometido sin acierto', 'compromisoAttempts', (r) => sin(r, 'correcta')],
    ['un intento comprometido sin profundidad', 'compromisoAttempts', (r) => sin(r, 'profundidad')],
    ['un intento de cálculo con un preset desconocido', 'calculoAttempts', (r) => ({ ...r, preset: 'libre' })],
    ['un intento de cálculo con ramas que no son lista', 'calculoAttempts', (r) => ({ ...r, ramas: 'e2e4' })],
    ['un intento de cálculo sin fecha', 'calculoAttempts', (r) => sin(r, 'fecha')],
    ['un intento de cálculo con un origen mal formado', 'calculoAttempts', (r) => ({ ...r, origen: { gameId: 'g1' } })],
    ['un intento de doble solución con un resultado desconocido', 'dobleSolucionAttempts', (r) => ({ ...r, resultado: 'mejor' })],
    ['un intento del cálculo de la semana con candidatas que no son lista', 'stoykoAttempts', (r) => ({ ...r, candidatas: 'e2e4' })],
    ['un intento del cálculo de la semana sin acierto', 'stoykoAttempts', (r) => sin(r, 'acierto')],
    ['un ejercicio de criterio con una decisión desconocida', 'triageAttempts', (r) => ({ ...r, decisionUsuario: 'dudar' })],
    ['un ejercicio de criterio sin decisión correcta', 'triageAttempts', (r) => sin(r, 'decisionCorrecta')],
    ['un ejercicio de criterio sin resultado', 'triageAttempts', (r) => sin(r, 'correcta')],
    ['un ejercicio de criterio con un tipo desconocido', 'triageAttempts', (r) => ({ ...r, tipo: 'tactica' })],
  ];

  it.each(corrupciones)('rechaza %s', (_descripcion, tabla, corromper) => {
    const raw = respaldoCompleto();
    raw[tabla] = [corromper(raw[tabla][0]!)];
    expect(validateImportBundle(raw).ok).toBe(false);
  });

  it('acepta los campos opcionales y los que están en desuso cuando vienen bien formados', () => {
    const raw = respaldoCompleto();
    // La latencia del criterio que ya no se registra y el centro del Radar en
    // la escala anterior a ADR-0007 siguen viajando en respaldos viejos.
    raw.compromisoAttempts = [{ ...raw.compromisoAttempts[0]!, correcta: false, primerErrorEn: 2, tiempoMs: 42_000 }];
    raw.triageAttempts = [{ ...raw.triageAttempts[0]!, tiempoMs: 900 }];
    raw.radarProgress = [{ ...raw.radarProgress[0]!, ratingCentro: 1160 }];
    raw.radarAttempts = [
      { ...raw.radarAttempts[0]!, dificultadNormalizada: 62, origenContenido: 'catalogo', evalGuess: 'igual' },
      { ...raw.radarAttempts[0]!, id: 'r2', origenContenido: 'diagnostico' },
    ];
    raw.calculoAttempts = [{ ...raw.calculoAttempts[0]!, preset: 'forzado', origen: { gameId: 'g1', ply: 14 }, tiempoMs: 30_000 }];
    expect(validateImportBundle(raw).ok).toBe(true);
  });

  it('los mensajes no nombran ejercicios que la interfaz ya no llama así', () => {
    // "Triage" y "Stoyko" son identificadores internos; el usuario conoce
    // esos ejercicios como "¿Calcular o ya alcanza?" y "Cálculo".
    const errores: string[] = [];
    for (const tabla of ['stoykoAttempts', 'triageAttempts', 'compromisoAttempts', 'calculoAttempts', 'candidataAttempts'] as const) {
      const malFormado = respaldoCompleto();
      malFormado[tabla] = [sin(malFormado[tabla][0]!, 'id')];
      const noEsLista = { ...respaldoCompleto(), [tabla]: 'no-es-lista' };
      for (const raw of [malFormado, noEsLista]) {
        const result = validateImportBundle(raw);
        expect(result.ok).toBe(false);
        if (!result.ok) errores.push(result.error);
      }
    }
    expect(errores).toHaveLength(10);
    for (const error of errores) {
      expect(error).not.toMatch(/stoyko|triage|comprometid|declarado|regla de candidatas|criterio de cálculo/i);
    }
  });
});

// El token de Lichess (RF-1.4) es una credencial con permiso de jugar en la
// cuenta del usuario. La exportación está pensada para moverse entre equipos y
// para que el usuario la abra y la comparta, así que el token vive en
// localStorage (ui/lichessToken.ts) y no en el perfil. Este test fija esa
// frontera: si alguna vez se agregara al perfil "por comodidad", falla acá.
describe('la exportación no transporta credenciales', () => {
  it('el paquete no contiene ningún token de Lichess', () => {
    const bundle = buildExportBundle({
      games: [],
      errorCards: [],
      calibrationRecords: [],
      radarProgress: [],
      radarAttempts: [],
      curriculumProgress: [],
      profile: {
        id: 'principal',
        bandaElo: 'elemental',
        diagnosticoCompletadoEn: null,
        ratingsExternos: [{ valor: 1500, fuente: 'lichess', fecha: '2026-07-25T10:00:00.000Z' }],
      },
      candidataAttempts: [],
      compromisoAttempts: [],
  calculoAttempts: [],
      dobleSolucionAttempts: [],
      stoykoAttempts: [],
      triageAttempts: [],
      sessions: [],
      dailyAssignments: [],
      transferMeasurements: [],
      n1Experiments: [],
      trainingEvents: [],
    });
    const serializado = JSON.stringify(bundle);
    expect(serializado).not.toMatch(/lip_/);
    expect(serializado).not.toMatch(/token/i);
  });
});
