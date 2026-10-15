// Exportación e importación de datos (E14): lógica pura de armado y
// validación del paquete. La mecánica de archivo (.zip) vive en
// services/export — acá no hay File, Blob ni fetch (CONTRIBUTING regla 4).
import type {
  CalculoAttempt,
  CalibrationRecord,
  CandidataAttempt,
  CategoriaError,
  CompromisoAttempt,
  CurriculumProgress,
  DailyAssignment,
  DobleSolucionAttempt,
  ErrorCard,
  GameRecord,
  N1Experiment,
  OrigenTarjeta,
  PresetCalculoPersistido,
  Profile,
  RadarAttempt,
  RadarProgress,
  ResultadoDobleSolucion,
  SessionRecord,
  StoykoAttempt,
  TrainingEvent,
  TriageAttempt,
  TransferMeasurement,
} from './types';
import { SCHEMA_VERSION } from './schemaVersion';
import { esEsquemaMigrable } from './importMigrations';
import { DEFAULT_PROFILE } from './prescriptor';
import { isValidWeeklyPlan } from './adherence';
import { isValidReminder } from './reminder';
import { TIPOS_RADAR } from './leakProfile';
import { STATE_NAMES } from './scheduler';
import { esTrainingEventValido } from './trainingEvents';

export interface ExportManifest {
  esquema: number;
  exportadoEn: string; // ISO 8601
  app: 'elomax';
}

export interface ExportBundle {
  manifest: ExportManifest;
  games: GameRecord[];
  errorCards: ErrorCard[];
  calibrationRecords: CalibrationRecord[];
  radarProgress: RadarProgress[];
  radarAttempts: RadarAttempt[];
  curriculumProgress: CurriculumProgress[];
  profile: Profile;
  candidataAttempts: CandidataAttempt[];
  compromisoAttempts: CompromisoAttempt[];
  calculoAttempts: CalculoAttempt[];
  dobleSolucionAttempts: DobleSolucionAttempt[];
  stoykoAttempts: StoykoAttempt[];
  triageAttempts: TriageAttempt[];
  sessions: SessionRecord[];
  transferMeasurements: TransferMeasurement[];
  n1Experiments: N1Experiment[];
  dailyAssignments: DailyAssignment[];
  /** Tramos de tiempo entrenado (RF-13.4). */
  trainingEvents: TrainingEvent[];
}

export interface ExportSourceData {
  games: GameRecord[];
  errorCards: ErrorCard[];
  calibrationRecords: CalibrationRecord[];
  radarProgress: RadarProgress[];
  radarAttempts: RadarAttempt[];
  curriculumProgress: CurriculumProgress[];
  profile: Profile;
  candidataAttempts: CandidataAttempt[];
  compromisoAttempts: CompromisoAttempt[];
  calculoAttempts: CalculoAttempt[];
  dobleSolucionAttempts: DobleSolucionAttempt[];
  stoykoAttempts: StoykoAttempt[];
  triageAttempts: TriageAttempt[];
  sessions: SessionRecord[];
  transferMeasurements: TransferMeasurement[];
  n1Experiments: N1Experiment[];
  dailyAssignments: DailyAssignment[];
  trainingEvents: TrainingEvent[];
}

/** Arma el paquete de exportación completo, en un solo archivo (RF-14.1). */
export function buildExportBundle(data: ExportSourceData, now: Date = new Date()): ExportBundle {
  return {
    manifest: { esquema: SCHEMA_VERSION, exportadoEn: now.toISOString(), app: 'elomax' },
    games: data.games,
    errorCards: data.errorCards,
    calibrationRecords: data.calibrationRecords,
    radarProgress: data.radarProgress,
    radarAttempts: data.radarAttempts,
    curriculumProgress: data.curriculumProgress,
    profile: data.profile,
    candidataAttempts: data.candidataAttempts,
    compromisoAttempts: data.compromisoAttempts,
    calculoAttempts: data.calculoAttempts,
    dobleSolucionAttempts: data.dobleSolucionAttempts,
    stoykoAttempts: data.stoykoAttempts,
    triageAttempts: data.triageAttempts,
    sessions: data.sessions,
    transferMeasurements: data.transferMeasurements,
    n1Experiments: data.n1Experiments,
    dailyAssignments: data.dailyAssignments,
    trainingEvents: data.trainingEvents,
  };
}

export type ImportResult = { ok: true; bundle: ExportBundle } | { ok: false; error: string };

// --- Validadores por-registro (RF-14.2) ---
// La restauración reemplaza el estado local entero (services/export borra las
// tablas antes de escribir), así que un respaldo con un registro corrupto
// podía dejar la base en un estado inconsistente. Se valida cada entidad
// crítica antes de tocar Dexie; si una sola está mal formada, se rechaza el
// paquete completo (mejor negarse que escribir basura sobre datos buenos).

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

// Piezas para validar cada tabla con lo que la app lee de sus registros sin
// volver a chequearlo. Un registro roto no siempre falla al escribirse: un
// enumerado desconocido o una fecha que no es texto entran sin error y rompen
// después —un `indexOf` que da -1 en el planificador, un `localeCompare` sobre
// `undefined`—, lejos del respaldo que los trajo. Lo opcional se acepta
// ausente (los respaldos viejos no lo traen) y lo desconocido se ignora: una
// versión más nueva puede sumar campos sin cambiar de esquema, y rechazarlos
// sería negarse a restaurar datos buenos.
type Predicado = (x: unknown) => boolean;

/** IndexedDB necesita la clave: sin `id`, el `bulkPut` de la tabla entera falla. */
const esId: Predicado = (x) => typeof x === 'string' && x !== '';
const esTexto: Predicado = (x) => typeof x === 'string';
const esNumero: Predicado = (x) => typeof x === 'number' && Number.isFinite(x);
const esBooleano: Predicado = (x) => typeof x === 'boolean';
const esEnteroNoNegativo: Predicado = (x) => typeof x === 'number' && Number.isInteger(x) && x >= 0;
/** Clave de día local, la misma forma que `dailyAssignmentId`. */
const esDiaLocal: Predicado = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const opcional = (x: unknown, es: Predicado): boolean => x === undefined || es(x);
const esListaDe = (x: unknown, es: Predicado): boolean => Array.isArray(x) && x.every((elemento) => es(elemento));
const unoDe = (valores: readonly string[]): Predicado => (x) => typeof x === 'string' && valores.includes(x);
/** Valores de una unión de textos. El `Record` obliga a listarlos todos: si el
 * tipo suma uno y esta lista no, no compila (y no se rechazan respaldos que lo usen). */
const valoresDe = <T extends string>(todos: Record<T, true>): T[] => Object.keys(todos) as T[];

const esTipoRadar = unoDe(TIPOS_RADAR);
const esCategoriaError = unoDe(valoresDe<CategoriaError>({ tactico: true, posicional: true, tiempo: true, psicologico: true }));
const esOrigenTarjeta = unoDe(valoresDe<OrigenTarjeta>({ radar: true, partida: true, final: true, apertura: true }));
const esOrigenContenido = unoDe(
  valoresDe<NonNullable<RadarAttempt['origenContenido']>>({ catalogo: true, 'error-propio': true, diagnostico: true }),
);
const esPresetCalculo = unoDe(valoresDe<PresetCalculoPersistido>({ forzado: true, abierto: true }));
const esResultadoCandidata = unoDe(valoresDe<CandidataAttempt['resultado']>({ mejoro: true, empeoro: true, 'sin-cambio': true }));
const esResultadoDobleSolucion = unoDe(valoresDe<ResultadoDobleSolucion>({ superior: true, familiar: true, otra: true }));
const esDecisionCriterio = unoDe(valoresDe<TriageAttempt['decisionUsuario']>({ calcular: true, alcanza: true }));

function esGameRecordValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    esId(x.id) &&
    typeof x.pgn === 'string' &&
    typeof x.fecha === 'string' &&
    typeof x.fuente === 'string' &&
    typeof x.ritmo === 'string' &&
    typeof x.resultado === 'string' &&
    typeof x.analizada === 'boolean' &&
    Array.isArray(x.tiemposPorJugadaMs) &&
    (x.contexto === undefined || x.contexto === 'diagnostico')
  );
}

function esFsrsValido(x: unknown): boolean {
  return (
    isObj(x) && typeof x.due === 'string' && typeof x.reps === 'number' && typeof x.lapses === 'number' &&
    // `fromFsrsState` lo traduce con `indexOf`: un nombre desconocido daba -1
    // y el repaso se calculaba sobre un estado que ts-fsrs no tiene.
    opcional(x.state, unoDe(STATE_NAMES))
  );
}

function esErrorCardValida(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    esId(x.id) &&
    typeof x.fen === 'string' &&
    (x.ladoAMover === 'w' || x.ladoAMover === 'b') &&
    typeof x.jugadaUsuario === 'string' &&
    typeof x.jugadaCorrecta === 'string' &&
    // El repaso las expande en la lista de respuestas (B13): un texto suelto
    // se desarmaría en letras que nunca aciertan, y un número rompería el
    // repaso de esa tarjeta.
    opcional(x.jugadasAceptables, (v) => esListaDe(v, esTexto)) &&
    // La fuga táctica filtra por origen y categoría, y el reciclaje en el
    // Radar traduce la categoría a un tipo: un valor fuera del enumerado no
    // contaba en ninguna fuga y se reciclaba como si fuera táctico.
    esCategoriaError(x.categoria) &&
    esOrigenTarjeta(x.origen) &&
    typeof x.creadaEn === 'string' &&
    esFsrsValido(x.fsrs) &&
    // Solo en las diferidas por el tope diario (ADR-0017): fija el día del cupo.
    opcional(x.entraEn, esDiaLocal)
  );
}

function esCalibrationRecordValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    esId(x.id) &&
    typeof x.contexto === 'string' &&
    typeof x.confianzaDeclarada === 'number' &&
    typeof x.acierto === 'boolean' &&
    typeof x.fecha === 'string'
  );
}

function esSessionRecordValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  const blockTypes = ['cola', 'curriculo', 'triage', 'radar'];
  const blockStatuses = ['pendiente', 'en_curso', 'completado', 'salteado'];
  return (
    esId(x.id) &&
    typeof x.fechaInicio === 'string' &&
    (x.estado === 'en_curso' || x.estado === 'completada' || x.estado === 'abandonada') &&
    Array.isArray(x.bloques) &&
    x.bloques.every(
      (block) =>
        isObj(block) &&
        blockTypes.includes(String(block.tipo)) &&
        typeof block.planificados === 'number' &&
        typeof block.completados === 'number' &&
        blockStatuses.includes(String(block.estado)),
    )
  );
}

function esDailyAssignmentValida(x: unknown): boolean {
  if (!isObj(x)) return false;
  const blockTypes = ['cola', 'curriculo', 'triage', 'radar'];
  const sonIds = (ids: unknown): boolean =>
    ids === undefined || (Array.isArray(ids) && ids.every((id) => typeof id === 'string'));
  return (
    esId(x.id) &&
    typeof x.creadoEn === 'string' &&
    Array.isArray(x.bloques) &&
    x.bloques.every(
      (bloque) =>
        isObj(bloque) &&
        blockTypes.includes(String(bloque.tipo)) &&
        typeof bloque.planificados === 'number' &&
        typeof bloque.completados === 'number' &&
        (bloque.estado === 'pendiente' || bloque.estado === 'completado') &&
        sonIds(bloque.itemIds) &&
        sonIds(bloque.completadosIds),
    )
  );
}

function esPerfilDeFugasValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    typeof x.registradoEn === 'string' &&
    Array.isArray(x.porTipo) &&
    x.porTipo.every(
      (entry) =>
        isObj(entry) &&
        (TIPOS_RADAR as string[]).includes(String(entry.tipo)) &&
        Number.isInteger(entry.aciertos) && Number(entry.aciertos) >= 0 &&
        Number.isInteger(entry.total) && Number(entry.total) >= Number(entry.aciertos),
    )
  );
}

function esRatingsExternosValido(x: unknown): boolean {
  if (!Array.isArray(x)) return false;
  const fuentes = ['lichess', 'chesscom', 'otro'];
  return x.every(
    (entry) =>
      isObj(entry) &&
      typeof entry.valor === 'number' && Number.isFinite(entry.valor) &&
      fuentes.includes(String(entry.fuente)) &&
      typeof entry.fecha === 'string',
  );
}

function esProfileValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  const bands = ['principiante', 'elemental', 'intermedio', 'avanzado', 'experto'];
  return x.id === 'principal' && bands.includes(String(x.bandaElo)) &&
    (x.diagnosticoCompletadoEn === null || typeof x.diagnosticoCompletadoEn === 'string') &&
    (x.planSemanal === undefined || isValidWeeklyPlan(x.planSemanal)) &&
    (x.recordatorio === undefined || isValidReminder(x.recordatorio)) &&
    (x.perfilDeFugas === undefined || esPerfilDeFugasValido(x.perfilDeFugas)) &&
    (x.ratingsExternos === undefined || esRatingsExternosValido(x.ratingsExternos)) &&
    (x.preferenciasSensoriales === undefined || (
      isObj(x.preferenciasSensoriales) &&
      typeof x.preferenciasSensoriales.sonido === 'boolean' &&
      typeof x.preferenciasSensoriales.vibracion === 'boolean'
    ));
}

function esTransferMeasurementValida(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    esId(x.id) &&
    typeof x.datasetVersion === 'string' &&
    typeof x.startedAt === 'string' &&
    (x.completedAt === null || typeof x.completedAt === 'string') &&
    Array.isArray(x.responses) &&
    x.responses.every(
      (response) =>
        isObj(response) &&
        typeof response.itemId === 'string' &&
        typeof response.move === 'string' &&
        typeof response.correct === 'boolean' &&
        typeof response.tiempoMs === 'number' &&
        typeof response.fecha === 'string',
    )
  );
}

function esN1ExperimentValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  const modalities = ['radar', 'calculo', 'partidas-analisis'];
  const expectedPhases = [
    ['A1', 'A'],
    ['B1', 'B'],
    ['A2', 'A'],
    ['B2', 'B'],
  ] as const;
  const validOutcome = (outcome: unknown): boolean =>
    isObj(outcome) &&
    (outcome.erroresGravesPorPartida === null ||
      (typeof outcome.erroresGravesPorPartida === 'number' && Number.isFinite(outcome.erroresGravesPorPartida) && outcome.erroresGravesPorPartida >= 0)) &&
    Number.isInteger(outcome.partidasAnalizadas) && Number(outcome.partidasAnalizadas) >= 0 &&
    (outcome.rating === null || (typeof outcome.rating === 'number' && Number.isFinite(outcome.rating)));
  const basicShape = (
    esId(x.id) &&
    (x.estado === 'activo' || x.estado === 'completado') &&
    typeof x.creadoEn === 'string' && Number.isFinite(Date.parse(x.creadoEn)) &&
    modalities.includes(String(x.modalidadA)) &&
    modalities.includes(String(x.modalidadB)) &&
    x.modalidadA !== x.modalidadB &&
    Number.isInteger(x.dosisSemanalA) && Number(x.dosisSemanalA) >= 1 && Number(x.dosisSemanalA) <= 100 &&
    Number.isInteger(x.dosisSemanalB) && Number(x.dosisSemanalB) >= 1 && Number(x.dosisSemanalB) <= 100 &&
    validOutcome(x.lineaBase) && isObj(x.lineaBase) && typeof x.lineaBase.registradaEn === 'string' &&
    Array.isArray(x.fases) &&
    x.fases.length === 4
  );
  if (!basicShape || !Array.isArray(x.fases)) return false;
  const phasesValid = x.fases.every((phase, index) => {
    if (!isObj(phase)) return false;
    const expected = expectedPhases[index];
    const expectedModality = expected[1] === 'A' ? x.modalidadA : x.modalidadB;
    const start = typeof phase.inicio === 'string' ? Date.parse(phase.inicio) : Number.NaN;
    const end = typeof phase.fin === 'string' ? Date.parse(phase.fin) : Number.NaN;
    const snapshotValid = phase.snapshot === undefined || (
      validOutcome(phase.snapshot) && isObj(phase.snapshot) &&
      Number.isInteger(phase.snapshot.dosisReal) && Number(phase.snapshot.dosisReal) >= 0 &&
      typeof phase.snapshot.cerradaEn === 'string'
    );
    return phase.id === expected[0] && phase.condicion === expected[1] && phase.modalidad === expectedModality &&
      Number.isFinite(start) && Number.isFinite(end) && start < end && snapshotValid;
  });
  if (!phasesValid) return false;
  return x.estado === 'completado'
    ? x.fases.every((phase) => isObj(phase) && phase.snapshot !== undefined)
    : x.fases.some((phase) => isObj(phase) && phase.snapshot === undefined);
}

function esRadarProgressValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    // El selector los recorre y los extiende en cada posición servida.
    esListaDe(x.historialTipos, esTipoRadar) &&
    esListaDe(x.historialIds, esTexto) &&
    esListaDe(x.aciertosRecientes, esBooleano) &&
    // Ausente en respaldos anteriores a ADR-0007; `ratingCentro`, en desuso, no se lee.
    opcional(x.dificultadCentro, esNumero)
  );
}

function esRadarAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esTexto(x.itemId) &&
    esTipoRadar(x.tipo) &&
    esBooleano(x.acierto) &&
    esTexto(x.fecha) &&
    // Ausentes en intentos históricos (types.ts); el detector de sobreajuste
    // promedia la dificultad y el Panel separa por origen.
    opcional(x.dificultadNormalizada, esNumero) &&
    opcional(x.origenContenido, esOrigenContenido)
  );
}

function esCurriculumProgressValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esFsrsValido(x.fsrs) &&
    esNumero(x.demostracionesLimpias) &&
    esTexto(x.updatedAt) &&
    // Contadores del acierto (RF-6.5): ausentes en registros viejos. Si vienen,
    // vienen juntos, son enteros y no hay más aciertos que intentos. Un "3"
    // de texto entraba y después la suma lo concatenaba ("31"), y el modo a
    // ciegas leía un acierto inventado.
    ((x.intentos === undefined && x.aciertos === undefined) ||
      (esEnteroNoNegativo(x.intentos) && esEnteroNoNegativo(x.aciertos) && Number(x.aciertos) <= Number(x.intentos))) &&
    opcional(x.ultimaACiegas, esBooleano)
  );
}

function esCandidataAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esTexto(x.itemId) &&
    esBooleano(x.cambio) &&
    esResultadoCandidata(x.resultado) &&
    esTexto(x.fecha)
  );
}

/** Formato anterior a ADR-0015: se valida tal como se escribió, porque la
 * migración v18 lo convierte después de esta validación. */
function esCompromisoAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esTexto(x.itemId) &&
    esNumero(x.profundidad) &&
    esBooleano(x.correcta) &&
    opcional(x.primerErrorEn, (valor) => valor === null || esNumero(valor)) &&
    opcional(x.tiempoMs, esNumero) &&
    esTexto(x.fecha)
  );
}

function esCalculoAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esPresetCalculo(x.preset) &&
    esListaDe(x.ramas, (rama) => isObj(rama) && esListaDe(rama.linea, esTexto)) &&
    // El Panel ordena por fecha con `localeCompare`, y el registro de tiempo
    // entrenado se reconstruye de `tiempoMs`.
    esTexto(x.fecha) &&
    opcional(x.tiempoMs, esNumero) &&
    opcional(x.origen, (origen) => isObj(origen) && esTexto(origen.gameId) && esNumero(origen.ply))
  );
}

function esDobleSolucionAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esTexto(x.itemId) &&
    esResultadoDobleSolucion(x.resultado) &&
    esTexto(x.fecha)
  );
}

/** Formato anterior a ADR-0015 (el cálculo de la semana): igual que el
 * comprometido, se valida en su forma original y la migración v18 lo convierte. */
function esStoykoAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esTexto(x.itemId) &&
    // La conversión recorre las candidatas: si no son lista, la migración lanza.
    esListaDe(x.candidatas, (candidata) => isObj(candidata) && esTexto(candidata.jugada)) &&
    esBooleano(x.acierto) &&
    opcional(x.confianzaDeclarada, esNumero) &&
    opcional(x.tiempoMs, esNumero) &&
    esTexto(x.fecha)
  );
}

function esTriageAttemptValido(x: unknown): boolean {
  return (
    isObj(x) &&
    esId(x.id) &&
    esTexto(x.itemId) &&
    esDecisionCriterio(x.decisionUsuario) &&
    esDecisionCriterio(x.decisionCorrecta) &&
    esBooleano(x.correcta) &&
    esTexto(x.fecha) &&
    // Ninguna lectura lo usa (el informe mira fecha y acierto): exigirlo
    // arriesgaría rechazar registros del primer formato del ejercicio.
    opcional(x.tipo, esTipoRadar)
  );
}

/**
 * Validación por registro de cada tabla (RF-14.2), con el mensaje que ve el
 * usuario. Como la restauración reemplaza el estado local entero, un solo
 * registro corrupto rechaza el paquete en vez de escribirse sobre datos
 * buenos. Los ejercicios se nombran como los nombra la interfaz ("Cálculo",
 * "¿Calcular o ya alcanza?", "¿Hay algo mejor?", "Doble solución"), no con
 * sus identificadores internos ni con nombres retirados ("Stoyko", "Triage",
 * "cálculo comprometido"): el usuario tiene que poder reconocer qué parte de
 * sus datos falló.
 */
const VALIDACION_POR_REGISTRO: ReadonlyArray<readonly [Exclude<keyof ExportBundle, 'manifest' | 'profile'>, Predicado, string]> = [
  ['games', esGameRecordValido, 'Alguna partida del respaldo está corrupta o incompleta.'],
  ['errorCards', esErrorCardValida, 'Alguna tarjeta de la Cola del respaldo está corrupta o incompleta.'],
  ['calibrationRecords', esCalibrationRecordValido, 'Algún registro de calibración del respaldo está corrupto o incompleto.'],
  ['radarProgress', esRadarProgressValido, 'El progreso del Radar del respaldo está corrupto o incompleto.'],
  ['radarAttempts', esRadarAttemptValido, 'Alguna respuesta del Radar del respaldo está corrupta o incompleta.'],
  ['curriculumProgress', esCurriculumProgressValido, 'Algún progreso del currículo del respaldo está corrupto o incompleto.'],
  ['candidataAttempts', esCandidataAttemptValido, 'Alguna respuesta de "¿Hay algo mejor?" del respaldo está corrupta o incompleta.'],
  ['compromisoAttempts', esCompromisoAttemptValido, 'Algún intento de Cálculo del respaldo (formato anterior) está corrupto o incompleto.'],
  ['calculoAttempts', esCalculoAttemptValido, 'Algún intento de Cálculo del respaldo está corrupto o incompleto.'],
  ['dobleSolucionAttempts', esDobleSolucionAttemptValido, 'Algún intento de Doble solución del respaldo está corrupto o incompleto.'],
  ['stoykoAttempts', esStoykoAttemptValido, 'Algún intento de Cálculo del respaldo (formato anterior) está corrupto o incompleto.'],
  ['triageAttempts', esTriageAttemptValido, 'Algún ejercicio de "¿Calcular o ya alcanza?" del respaldo está corrupto o incompleto.'],
  ['sessions', esSessionRecordValido, 'Alguna sesión del respaldo está corrupta o incompleta.'],
  ['transferMeasurements', esTransferMeasurementValida, 'Alguna batería de transferencia del respaldo está corrupta o incompleta.'],
  ['n1Experiments', esN1ExperimentValido, 'Algún experimento n=1 del respaldo está corrupto o incompleto.'],
  ['dailyAssignments', esDailyAssignmentValida, 'Algún plan diario del respaldo está corrupto o incompleto.'],
  ['trainingEvents', esTrainingEventValido, 'Algún tramo de tiempo entrenado del respaldo está corrupto o incompleto.'],
];

/**
 * Valida la forma de un paquete importado antes de tocar la base de datos
 * (RF-14.2). Acepta cualquier esquema que `core/importMigrations.ts` sabe
 * llevar al actual, y valida los datos **tal como se escribieron**: la
 * migración corre después, sobre datos ya validados. Por eso los formatos
 * viejos (`compromisoAttempts`, `stoykoAttempts`) se validan con su propia
 * forma y los campos que llegaron en versiones posteriores se aceptan ausentes.
 */
export function validateImportBundle(raw: unknown): ImportResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'El archivo no contiene un paquete válido.' };
  const obj = raw as Record<string, unknown>;
  const manifest = obj.manifest as Partial<ExportManifest> | undefined;
  if (!manifest || typeof manifest.esquema !== 'number') {
    return { ok: false, error: 'Falta el manifiesto o no indica versión de esquema.' };
  }
  // Un esquema que no es entero no existe en ninguna versión: se dice que es
  // inválido antes de compararlo con el actual, si no un 20.5 recibía "actualizá
  // la app", que no lo arreglaría.
  if (manifest.esquema > SCHEMA_VERSION && Number.isInteger(manifest.esquema)) {
    return { ok: false, error: `El archivo es de una versión más nueva (esquema ${manifest.esquema}) que esta app (${SCHEMA_VERSION}). Actualizá la app antes de restaurar.` };
  }
  // Una versión que la cadena de migraciones no cubre (0, negativa, fraccional)
  // no se puede interpretar: escribirla sería adivinar en qué formato están los
  // datos. Ver core/importMigrations.ts.
  if (!esEsquemaMigrable(manifest.esquema)) {
    return { ok: false, error: `El manifiesto declara una versión de esquema inválida (${manifest.esquema}).` };
  }
  if (!Array.isArray(obj.games) || !Array.isArray(obj.errorCards) || !Array.isArray(obj.calibrationRecords)) {
    return { ok: false, error: 'El paquete no tiene la forma esperada (faltan partidas, tarjetas o calibración).' };
  }
  // Los archivos de Fase 1 anteriores a la persistencia del Radar no traen
  // este campo. Restaurarlos conserva todos sus datos y arranca el selector
  // con el estado inicial, en vez de rechazar un respaldo válido.
  if (obj.radarProgress !== undefined && !Array.isArray(obj.radarProgress)) {
    return { ok: false, error: 'El progreso del Radar no tiene la forma esperada.' };
  }
  if (obj.radarAttempts !== undefined && !Array.isArray(obj.radarAttempts)) {
    return { ok: false, error: 'El historial del Radar no tiene la forma esperada.' };
  }
  // Los respaldos de antes de Fase 3 no traen progreso del currículo (E6).
  if (obj.curriculumProgress !== undefined && !Array.isArray(obj.curriculumProgress)) {
    return { ok: false, error: 'El progreso del currículo no tiene la forma esperada.' };
  }
  // Ni perfil (E11): restaurarlos arranca con la banda por defecto, sin
  // diagnosticar, en vez de rechazar un respaldo válido.
  if (obj.profile !== undefined && !esProfileValido(obj.profile)) {
    return { ok: false, error: 'El perfil no tiene la forma esperada.' };
  }
  // Los respaldos de antes de Fase 4 no traen la regla de candidatas (RF-5.8).
  if (obj.candidataAttempts !== undefined && !Array.isArray(obj.candidataAttempts)) {
    return { ok: false, error: 'El historial de "¿Hay algo mejor?" no tiene la forma esperada.' };
  }
  // Tampoco cálculo comprometido (E7, RF-7.1), el formato anterior a ADR-0015.
  if (obj.compromisoAttempts !== undefined && !Array.isArray(obj.compromisoAttempts)) {
    return { ok: false, error: 'El historial de Cálculo (formato anterior) no tiene la forma esperada.' };
  }
  // Ni el formato unificado de cálculo declarado (ADR-0015, esquema v18): un
  // respaldo anterior no lo trae y se restaura igual — la migración lo
  // reconstruye desde los dos formatos viejos, que sí viajan en el paquete.
  if (obj.calculoAttempts !== undefined && !Array.isArray(obj.calculoAttempts)) {
    return { ok: false, error: 'El historial de Cálculo no tiene la forma esperada.' };
  }
  // Ni doble solución (RF-5.7).
  if (obj.dobleSolucionAttempts !== undefined && !Array.isArray(obj.dobleSolucionAttempts)) {
    return { ok: false, error: 'El historial de Doble solución no tiene la forma esperada.' };
  }
  // Ni el historial de Stoyko (E7) o Triage (E9), agregados en esquema v11.
  if (obj.stoykoAttempts !== undefined && !Array.isArray(obj.stoykoAttempts)) {
    return { ok: false, error: 'El historial de Cálculo (formato anterior) no tiene la forma esperada.' };
  }
  if (obj.triageAttempts !== undefined && !Array.isArray(obj.triageAttempts)) {
    return { ok: false, error: 'El historial de "¿Calcular o ya alcanza?" no tiene la forma esperada.' };
  }
  // Los respaldos anteriores a RF-12.1 no traen sesiones persistidas.
  if (obj.sessions !== undefined && !Array.isArray(obj.sessions)) {
    return { ok: false, error: 'El historial de sesiones no tiene la forma esperada.' };
  }
  if (obj.transferMeasurements !== undefined && !Array.isArray(obj.transferMeasurements)) {
    return { ok: false, error: 'Las baterías de transferencia no tienen la forma esperada.' };
  }
  if (obj.n1Experiments !== undefined && !Array.isArray(obj.n1Experiments)) {
    return { ok: false, error: 'Los experimentos n=1 no tienen la forma esperada.' };
  }
  // Los respaldos anteriores al plan diario persistente (esquema v17) no lo traen.
  if (obj.dailyAssignments !== undefined && !Array.isArray(obj.dailyAssignments)) {
    return { ok: false, error: 'Los planes diarios no tienen la forma esperada.' };
  }
  // Los respaldos anteriores al registro de tiempo entrenado (esquema v20) no
  // lo traen; la migración lo reconstruye de lo que sí midieron.
  if (obj.trainingEvents !== undefined && !Array.isArray(obj.trainingEvents)) {
    return { ok: false, error: 'El registro de tiempo entrenado no tiene la forma esperada.' };
  }
  // Todas las tablas, no solo las críticas: de las que solo se miraba que
  // fueran listas, un registro sin `id` hacía fallar la escritura y la
  // restauración terminaba en una excepción sin mensaje (B10).
  for (const [tabla, esValido, error] of VALIDACION_POR_REGISTRO) {
    if (!((obj[tabla] ?? []) as unknown[]).every((registro) => esValido(registro))) return { ok: false, error };
  }
  return {
    ok: true,
    bundle: {
      manifest: manifest as ExportManifest,
      games: obj.games as GameRecord[],
      errorCards: obj.errorCards as ErrorCard[],
      calibrationRecords: obj.calibrationRecords as CalibrationRecord[],
      radarProgress: (obj.radarProgress ?? []) as RadarProgress[],
      radarAttempts: (obj.radarAttempts ?? []) as RadarAttempt[],
      curriculumProgress: (obj.curriculumProgress ?? []) as CurriculumProgress[],
      profile: (obj.profile ?? DEFAULT_PROFILE) as Profile,
      candidataAttempts: (obj.candidataAttempts ?? []) as CandidataAttempt[],
      compromisoAttempts: (obj.compromisoAttempts ?? []) as CompromisoAttempt[],
      calculoAttempts: (obj.calculoAttempts ?? []) as CalculoAttempt[],
      dobleSolucionAttempts: (obj.dobleSolucionAttempts ?? []) as DobleSolucionAttempt[],
      stoykoAttempts: (obj.stoykoAttempts ?? []) as StoykoAttempt[],
      triageAttempts: (obj.triageAttempts ?? []) as TriageAttempt[],
      sessions: (obj.sessions ?? []) as SessionRecord[],
      transferMeasurements: (obj.transferMeasurements ?? []) as TransferMeasurement[],
      n1Experiments: (obj.n1Experiments ?? []) as N1Experiment[],
      dailyAssignments: (obj.dailyAssignments ?? []) as DailyAssignment[],
      trainingEvents: (obj.trainingEvents ?? []) as TrainingEvent[],
    },
  };
}
