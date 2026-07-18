// Dexie sobre IndexedDB con migraciones versionadas (ADR-0001, RNF-5).
// Toda versión que cambie el modelo de datos agrega un bloque version(n)
// nuevo con su upgrade; nunca se edita una versión ya publicada.
import Dexie, { type Table } from 'dexie';
import type {
  CalibrationRecord,
  CandidataAttempt,
  CompromisoAttempt,
  CurriculumDatasetMeta,
  CurriculumItem,
  CurriculumProgress,
  DobleSolucionAttempt,
  ErrorCard,
  GameRecord,
  Profile,
  RadarAttempt,
  RadarDatasetMeta,
  RadarItem,
  RadarProgress,
  StoykoAttempt,
  StoykoDatasetMeta,
  StoykoItem,
  TriageAttempt,
} from '../../core/types';

export const DB_NAME = 'elomax';
/** Versión de esquema expuesta en el manifiesto de exportación (RF-14.1/14.2). */
export const SCHEMA_VERSION = 11;

export class ElomaxDB extends Dexie {
  games!: Table<GameRecord, string>;
  errorCards!: Table<ErrorCard, string>;
  radarItems!: Table<RadarItem, string>;
  calibrationRecords!: Table<CalibrationRecord, string>;
  radarProgress!: Table<RadarProgress, string>;
  radarDatasetMeta!: Table<RadarDatasetMeta, string>;
  radarAttempts!: Table<RadarAttempt, string>;
  curriculumItems!: Table<CurriculumItem, string>;
  curriculumDatasetMeta!: Table<CurriculumDatasetMeta, string>;
  curriculumProgress!: Table<CurriculumProgress, string>;
  profile!: Table<Profile, string>;
  candidataAttempts!: Table<CandidataAttempt, string>;
  compromisoAttempts!: Table<CompromisoAttempt, string>;
  dobleSolucionAttempts!: Table<DobleSolucionAttempt, string>;
  stoykoItems!: Table<StoykoItem, string>;
  stoykoDatasetMeta!: Table<StoykoDatasetMeta, string>;
  stoykoAttempts!: Table<StoykoAttempt, string>;
  triageAttempts!: Table<TriageAttempt, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    // v1 — esquema inicial: partidas con índice por fecha.
    this.version(1).stores({
      games: 'id, fecha',
    });

    // v2 — migración de prueba (Fase 0): agrega el índice `fuente` y
    // rellena el campo en registros v1 que no lo tenían. Demuestra que el
    // mecanismo de upgrade funciona antes de que haya datos reales en juego.
    this.version(2)
      .stores({
        games: 'id, fecha, fuente',
      })
      .upgrade(async (tx) => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Partial<GameRecord>) => {
            if (g.fuente === undefined) g.fuente = 'local';
            if (g.analizada === undefined) g.analizada = false;
          });
      });

    // v3 — Fase 1 (E4/E5/E10): Cola Universal de errores, catálogo del
    // Radar y registros de calibración. Puramente aditivo: `games` no
    // cambia, no hace falta transformar datos existentes.
    this.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });

    // v4 — Fase 1: el selector del Radar deja de reiniciarse en cada sesión,
    // las respuestas quedan medibles y el catálogo embebido queda versionado.
    // Es una migración aditiva: no modifica datos personales existentes
    // (RNF-5, RF-5.5).
    this.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });

    // v5 — Fase 3 (E6): currículo base de patrones y finales. `curriculumItems`
    // es catálogo reseedable (como `radarItems`); `curriculumProgress` es dato
    // personal (estado FSRS + demostraciones limpias por elemento, RF-6.3) y
    // se incluye en la exportación (RF-14.1). Puramente aditiva.
    this.version(5).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
    });

    // v6 — Fase 3 (E11): perfil del usuario (banda de Elo del diagnóstico
    // inicial, RF-11.4), que el Prescriptor usa para la dieta base por banda
    // (RF-11.2). Tabla nueva y chica; puramente aditiva.
    this.version(6).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
    });

    // v7 — Fase 4 (E5): regla de candidatas (RF-5.8). Tabla nueva y chica;
    // puramente aditiva.
    this.version(7).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
    });

    // v8 — Fase 4 (E7): cálculo comprometido (RF-7.1). Tabla nueva y chica;
    // puramente aditiva.
    this.version(8).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
    });

    // v9 — Fase 4 (E5): doble solución (RF-5.7). Tabla nueva y chica;
    // puramente aditiva.
    this.version(9).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
      dobleSolucionAttempts: 'id, itemId, fecha',
    });

    // v10 — Fase 4 (E7): ejercicio de Stoyko semanal (RF-7.2). Catálogo
    // reseedable nuevo (`stoykoItems`, igual patrón que `curriculumItems`);
    // no hay tabla de intentos propia — el resultado de cada ejercicio se
    // registra en `calibrationRecords` (contexto 'stoyko', ya contemplado
    // desde E10) y la fecha del último se guarda en `profile` (sin nuevo
    // índice, no hace falta bump de tabla para ese campo). Puramente aditiva.
    this.version(10).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
      dobleSolucionAttempts: 'id, itemId, fecha',
      stoykoItems: 'id',
      stoykoDatasetMeta: 'id',
    });

    // v11 — Fase 4 (E7/E9): el intento de Stoyko (candidatas, evaluaciones,
    // tiempo, confianza) y el de Triage de reloj (decisión, si fue correcta,
    // latencia) pasan a persistirse — antes se evaluaban en memoria y se
    // perdían (`inicioMs` de Stoyko ni siquiera se leía). Dos tablas nuevas y
    // chicas, incluidas en la exportación (RF-14.1). Puramente aditiva.
    this.version(11).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
      dobleSolucionAttempts: 'id, itemId, fecha',
      stoykoItems: 'id',
      stoykoDatasetMeta: 'id',
      stoykoAttempts: 'id, itemId, fecha',
      triageAttempts: 'id, itemId, fecha',
    });
  }
}

export const db = new ElomaxDB();
