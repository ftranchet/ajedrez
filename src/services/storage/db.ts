// Dexie sobre IndexedDB con migraciones versionadas (ADR-0001, RNF-5).
// Toda versión que cambie el modelo de datos agrega un bloque version(n)
// nuevo con su upgrade; nunca se edita una versión ya publicada.
import Dexie, { type Table } from 'dexie';
import type {
  CalculoAttempt,
  CalibrationRecord,
  CandidataAttempt,
  CompromisoAttempt,
  CurriculumDatasetMeta,
  CurriculumItem,
  CurriculumProgress,
  DailyAssignment,
  DobleSolucionAttempt,
  ErrorCard,
  GameRecord,
  N1Experiment,
  Profile,
  RadarAttempt,
  RadarDatasetMeta,
  RadarItem,
  RadarProgress,
  SessionRecord,
  StoykoAttempt,
  StoykoDatasetMeta,
  StoykoItem,
  TriageAttempt,
  TransferMeasurement,
} from '../../core/types';
import { compromisoAAttempt, stoykoAAttempt } from '../../core/calculoMigracion';

export const DB_NAME = 'elomax';
// La versión de esquema es el contrato del paquete de exportación, así que vive
// en `core`; se re-exporta acá para no romper a quien ya la importaba de este
// módulo. Un test comprueba que coincida con la última `this.version(N)`.
export { SCHEMA_VERSION } from '../../core/schemaVersion';

/**
 * Ventana hacia atrás desde `diagnosticoCompletadoEn` dentro de la cual una
 * partida local sin reloj se atribuye al diagnóstico en la migración v16. El
 * diagnóstico es una sola sentada (su pausa solo sobrevive mientras la pestaña
 * siga abierta), así que 12 horas es holgado y a la vez acotado.
 */
const VENTANA_ATRIBUCION_DIAGNOSTICO_MS = 12 * 60 * 60 * 1000;

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
  /** Intentos del ejercicio de cálculo declarado (ADR-0015). Unifica los dos
   * formatos anteriores; la migración v18 convierte los viejos. */
  calculoAttempts!: Table<CalculoAttempt, string>;
  dobleSolucionAttempts!: Table<DobleSolucionAttempt, string>;
  stoykoItems!: Table<StoykoItem, string>;
  stoykoDatasetMeta!: Table<StoykoDatasetMeta, string>;
  stoykoAttempts!: Table<StoykoAttempt, string>;
  triageAttempts!: Table<TriageAttempt, string>;
  sessions!: Table<SessionRecord, string>;
  transferMeasurements!: Table<TransferMeasurement, string>;
  n1Experiments!: Table<N1Experiment, string>;
  dailyAssignments!: Table<DailyAssignment, string>;

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
    // tiempo, confianza) y el del ejercicio de criterio (decisión, si fue
    // correcta) pasan a persistirse — antes se evaluaban en memoria y se
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

    // v12 — dificultad normalizada del Radar (ADR-0007) y registro de
    // sesiones (RF-11.1/RF-12.1). El centro viejo mezclaba unidades y no se
    // puede convertir honestamente: se reinicia en el percentil neutral 50,
    // conservando historial y aciertos. `sessions` es dato personal y forma
    // parte de la exportación completa (RF-14.1).
    this.version(12)
      .stores({
        games: 'id, fecha, fuente',
        errorCards: 'id, fsrs.due, origen, categoria',
        radarItems: 'id, tipo, rating',
        calibrationRecords: 'id, contexto, fecha',
        radarProgress: 'id, updatedAt',
        radarDatasetMeta: 'id',
        radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada',
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
        sessions: 'id, fechaInicio, estado',
      })
      .upgrade(async (tx) => {
        await tx
          .table('radarProgress')
          .toCollection()
          .modify((progress: Partial<RadarProgress>) => {
            if (progress.dificultadCentro === undefined) progress.dificultadCentro = 50;
          });
      });

    // v13 — batería de transferencia (RF-12.2). Solo se persisten las tomas
    // personales; el instrumento fijo vive embebido y separado de los
    // catálogos de entrenamiento. Migración puramente aditiva.
    this.version(13).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada',
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
      sessions: 'id, fechaInicio, estado',
      transferMeasurements: 'id, startedAt, completedAt, datasetVersion',
    });

    // v14 — modo experimento n=1 (RF-12.4): configuración ABAB, línea base
    // y snapshots de cada fase. Tabla personal nueva, puramente aditiva.
    this.version(14).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada',
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
      sessions: 'id, fechaInicio, estado',
      transferMeasurements: 'id, startedAt, completedAt, datasetVersion',
      n1Experiments: 'id, creadoEn, estado',
    });

    // v15 — preferencias sensoriales del perfil (sonido y vibración, ambas
    // opt-in). Aunque no cambia ningún índice, se versiona el dato para que
    // los perfiles históricos reciban defaults explícitos sin perder sus
    // demás campos ni pisar preferencias que ya estuvieran guardadas.
    this.version(15)
      .stores({
        games: 'id, fecha, fuente',
        errorCards: 'id, fsrs.due, origen, categoria',
        radarItems: 'id, tipo, rating',
        calibrationRecords: 'id, contexto, fecha',
        radarProgress: 'id, updatedAt',
        radarDatasetMeta: 'id',
        radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada',
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
        sessions: 'id, fechaInicio, estado',
        transferMeasurements: 'id, startedAt, completedAt, datasetVersion',
        n1Experiments: 'id, creadoEn, estado',
      })
      .upgrade(async (tx) => {
        await tx
          .table('profile')
          .toCollection()
          .modify((profile: Partial<Profile>) => {
            const preferences = profile.preferenciasSensoriales;
            profile.preferenciasSensoriales = {
              sonido: typeof preferences?.sonido === 'boolean' ? preferences.sonido : false,
              vibracion: typeof preferences?.vibracion === 'boolean' ? preferences.vibracion : false,
            };
          });
      });

    // v16 — el diagnóstico inicial deja de confundirse con el entrenamiento
    // elegido por el usuario. Sus partidas (`games.contexto`) ya no ocupan el
    // compromiso semanal de partida lenta (RF-11.7) y sus respuestas del Radar
    // (`radarAttempts.origenContenido = 'diagnostico'`) ya no entran en la
    // lectura de la banda 60–80% (RF-5.5). Además el perfil suma el perfil de
    // fugas y los ratings declarados que RF-11.4 y RF-12.1 piden.
    //
    // No alcanza con escribir bien de acá en adelante: quien ya hizo el
    // diagnóstico tiene esos registros indistinguibles de los propios, y el
    // compromiso semanal seguiría dándose por cumplido esta semana. La
    // atribución retroactiva es deliberadamente conservadora — solo registros
    // anteriores a `diagnosticoCompletadoEn`, dentro de una ventana acotada, y
    // como máximo las dos partidas que el diagnóstico juega.
    this.version(16)
      .stores({
        games: 'id, fecha, fuente, contexto',
        errorCards: 'id, fsrs.due, origen, categoria',
        radarItems: 'id, tipo, rating',
        calibrationRecords: 'id, contexto, fecha',
        radarProgress: 'id, updatedAt',
        radarDatasetMeta: 'id',
        radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada, origenContenido',
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
        sessions: 'id, fechaInicio, estado',
        transferMeasurements: 'id, startedAt, completedAt, datasetVersion',
        n1Experiments: 'id, creadoEn, estado',
      })
      .upgrade(async (tx) => {
        const profile: Partial<Profile> | undefined = await tx.table('profile').get('principal');
        const completadoEn = profile?.diagnosticoCompletadoEn
          ? new Date(profile.diagnosticoCompletadoEn).getTime()
          : Number.NaN;
        if (!Number.isFinite(completadoEn)) return;
        const desde = completadoEn - VENTANA_ATRIBUCION_DIAGNOSTICO_MS;

        const enVentana = (iso: unknown): boolean => {
          const t = typeof iso === 'string' ? new Date(iso).getTime() : Number.NaN;
          return Number.isFinite(t) && t >= desde && t <= completadoEn;
        };

        // Las dos partidas del diagnóstico: locales, sin reloj y terminadas
        // antes de que se guardara la banda. Si hubiera más candidatas (el
        // usuario puede saltear el diagnóstico y jugar suelto antes de
        // volver), se atribuyen las dos más cercanas al cierre y las demás
        // quedan como partidas propias.
        const partidas: Array<Partial<GameRecord> & { id: string }> = await tx.table('games').toArray();
        const delDiagnostico = partidas
          .filter(
            (game) =>
              game.contexto === undefined &&
              game.fuente === 'local' &&
              game.ritmo === 'sin-reloj' &&
              enVentana(game.fecha),
          )
          .sort((a, b) => new Date(String(b.fecha)).getTime() - new Date(String(a.fecha)).getTime())
          .slice(0, 2);
        for (const game of delDiagnostico) {
          await tx.table('games').update(game.id, { contexto: 'diagnostico' });
        }

        // Las respuestas del Radar del diagnóstico son las únicas anteriores
        // al cierre que no llevan dificultad normalizada: la sesión siempre la
        // registra, salvo en errores propios, que van marcados aparte.
        await tx
          .table('radarAttempts')
          .toCollection()
          .modify((attempt: Partial<RadarAttempt>) => {
            if (
              attempt.origenContenido === undefined &&
              attempt.dificultadNormalizada === undefined &&
              enVentana(attempt.fecha)
            ) {
              attempt.origenContenido = 'diagnostico';
            }
          });
      });

    // v17 — plan diario persistente (RF-11.1): la asignación del día deja de
    // recalcularse en cada arranque de sesión. Un plan por día local (la clave
    // es 'YYYY-MM-DD'), con los ítems concretos asignados y su progreso, para
    // reanudar sin repetir bloques hechos. Tabla personal nueva, puramente
    // aditiva; los usuarios que ya entrenaron hoy arrancan con el plan sembrado
    // desde sus sesiones registradas (ver core/dailyAssignment.ts).
    this.version(17).stores({
      games: 'id, fecha, fuente, contexto',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada, origenContenido',
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
      sessions: 'id, fechaInicio, estado',
      transferMeasurements: 'id, startedAt, completedAt, datasetVersion',
      n1Experiments: 'id, creadoEn, estado',
      dailyAssignments: 'id, creadoEn',
    });

    // v18 — un solo ejercicio de cálculo declarado (ADR-0015). "Línea
    // comprometida" (RF-7.1) y "Stoyko" (RF-7.2) no eran dos métodos sino dos
    // cortes del mismo procedimiento, y tenían dos formatos de intento para el
    // mismo acto. `calculoAttempts` los unifica en un árbol de ramas.
    //
    // Los intentos viejos se **convierten**, no se leen en paralelo para
    // siempre: el Panel, el resumen de cálculo y el experimento n=1 leen estos
    // datos, y triplicar las formas de leerlos es la clase de deuda que después
    // nadie paga. La conversión no descarta campos (core/calculoMigracion.ts) y
    // deja explícito lo que el formato viejo no guardaba —la línea declarada de
    // un intento fallido, la brecha de evaluación— en vez de inventarlo. Las
    // tablas originales quedan intactas: son el respaldo si esta conversión
    // resultara equivocada, y la exportación las sigue llevando.
    this.version(18)
      .stores({
        games: 'id, fecha, fuente, contexto',
        errorCards: 'id, fsrs.due, origen, categoria',
        radarItems: 'id, tipo, rating',
        calibrationRecords: 'id, contexto, fecha',
        radarProgress: 'id, updatedAt',
        radarDatasetMeta: 'id',
        radarAttempts: 'id, fecha, tipo, rating, dificultadNormalizada, origenContenido',
        curriculumItems: 'id, tipo, patternKey',
        curriculumDatasetMeta: 'id',
        curriculumProgress: 'id, fsrs.due, updatedAt',
        profile: 'id',
        candidataAttempts: 'id, itemId, fecha',
        compromisoAttempts: 'id, itemId, fecha',
        calculoAttempts: 'id, preset, itemId, fecha',
        dobleSolucionAttempts: 'id, itemId, fecha',
        stoykoItems: 'id',
        stoykoDatasetMeta: 'id',
        stoykoAttempts: 'id, itemId, fecha',
        triageAttempts: 'id, itemId, fecha',
        sessions: 'id, fechaInicio, estado',
        transferMeasurements: 'id, startedAt, completedAt, datasetVersion',
        n1Experiments: 'id, creadoEn, estado',
        dailyAssignments: 'id, creadoEn',
      })
      .upgrade(async (tx) => {
        // La línea declarada de un intento forzado no se guardaba: se
        // reconstruyen los plies que la solución del ítem permite afirmar,
        // cuando el ítem todavía está en el catálogo.
        const radarItems = (await tx.table('radarItems').toArray()) as RadarItem[];
        const solucionPorItem = new Map(radarItems.map((item) => [item.id, item.solucion] as const));
        const compromiso = (await tx.table('compromisoAttempts').toArray()) as CompromisoAttempt[];
        const stoyko = (await tx.table('stoykoAttempts').toArray()) as StoykoAttempt[];
        const convertidos: CalculoAttempt[] = [
          ...compromiso.map((viejo) => compromisoAAttempt(viejo, solucionPorItem.get(viejo.itemId))),
          ...stoyko.map(stoykoAAttempt),
        ];
        if (convertidos.length > 0) await tx.table('calculoAttempts').bulkPut(convertidos);
      });
  }
}

export const db = new ElomaxDB();
