// Exportación e importación de datos (E14): lógica pura de armado y
// validación del paquete. La mecánica de archivo (.zip) vive en
// services/export — acá no hay File, Blob ni fetch (CONTRIBUTING regla 4).
import type {
  CalibrationRecord,
  CandidataAttempt,
  CompromisoAttempt,
  CurriculumProgress,
  DobleSolucionAttempt,
  ErrorCard,
  GameRecord,
  Profile,
  RadarAttempt,
  RadarProgress,
  StoykoAttempt,
  TriageAttempt,
} from './types';
import { SCHEMA_VERSION } from '../services/storage/db';
import { DEFAULT_PROFILE } from './prescriptor';

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
  dobleSolucionAttempts: DobleSolucionAttempt[];
  stoykoAttempts: StoykoAttempt[];
  triageAttempts: TriageAttempt[];
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
  dobleSolucionAttempts: DobleSolucionAttempt[];
  stoykoAttempts: StoykoAttempt[];
  triageAttempts: TriageAttempt[];
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
    dobleSolucionAttempts: data.dobleSolucionAttempts,
    stoykoAttempts: data.stoykoAttempts,
    triageAttempts: data.triageAttempts,
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

function esGameRecordValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.pgn === 'string' &&
    typeof x.fecha === 'string' &&
    typeof x.fuente === 'string' &&
    typeof x.ritmo === 'string' &&
    typeof x.resultado === 'string' &&
    typeof x.analizada === 'boolean' &&
    Array.isArray(x.tiemposPorJugadaMs)
  );
}

function esFsrsValido(x: unknown): boolean {
  return isObj(x) && typeof x.due === 'string' && typeof x.reps === 'number' && typeof x.lapses === 'number';
}

function esErrorCardValida(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.fen === 'string' &&
    (x.ladoAMover === 'w' || x.ladoAMover === 'b') &&
    typeof x.jugadaUsuario === 'string' &&
    typeof x.jugadaCorrecta === 'string' &&
    typeof x.categoria === 'string' &&
    typeof x.origen === 'string' &&
    typeof x.creadaEn === 'string' &&
    esFsrsValido(x.fsrs)
  );
}

function esCalibrationRecordValido(x: unknown): boolean {
  if (!isObj(x)) return false;
  return (
    typeof x.id === 'string' &&
    typeof x.contexto === 'string' &&
    typeof x.confianzaDeclarada === 'number' &&
    typeof x.acierto === 'boolean' &&
    typeof x.fecha === 'string'
  );
}

/**
 * Valida la forma de un paquete importado antes de tocar la base de datos
 * (RF-14.2). No migra todavía versiones de esquema anteriores a la actual:
 * con un solo esquema publicado hasta ahora, el único caso a futuro es
 * `esquema < SCHEMA_VERSION`, que queda como punto de extensión documentado.
 */
export function validateImportBundle(raw: unknown): ImportResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'El archivo no contiene un paquete válido.' };
  const obj = raw as Record<string, unknown>;
  const manifest = obj.manifest as Partial<ExportManifest> | undefined;
  if (!manifest || typeof manifest.esquema !== 'number') {
    return { ok: false, error: 'Falta el manifiesto o no indica versión de esquema.' };
  }
  if (manifest.esquema > SCHEMA_VERSION) {
    return { ok: false, error: `El archivo es de una versión más nueva (esquema ${manifest.esquema}) que esta app (${SCHEMA_VERSION}). Actualizá la app antes de restaurar.` };
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
  if (obj.profile !== undefined && (typeof obj.profile !== 'object' || obj.profile === null)) {
    return { ok: false, error: 'El perfil no tiene la forma esperada.' };
  }
  // Los respaldos de antes de Fase 4 no traen la regla de candidatas (RF-5.8).
  if (obj.candidataAttempts !== undefined && !Array.isArray(obj.candidataAttempts)) {
    return { ok: false, error: 'El historial de la regla de candidatas no tiene la forma esperada.' };
  }
  // Tampoco cálculo comprometido (E7, RF-7.1).
  if (obj.compromisoAttempts !== undefined && !Array.isArray(obj.compromisoAttempts)) {
    return { ok: false, error: 'El historial de cálculo comprometido no tiene la forma esperada.' };
  }
  // Ni doble solución (RF-5.7).
  if (obj.dobleSolucionAttempts !== undefined && !Array.isArray(obj.dobleSolucionAttempts)) {
    return { ok: false, error: 'El historial de doble solución no tiene la forma esperada.' };
  }
  // Ni el historial de Stoyko (E7) o Triage (E9), agregados en esquema v11.
  if (obj.stoykoAttempts !== undefined && !Array.isArray(obj.stoykoAttempts)) {
    return { ok: false, error: 'El historial de Stoyko no tiene la forma esperada.' };
  }
  if (obj.triageAttempts !== undefined && !Array.isArray(obj.triageAttempts)) {
    return { ok: false, error: 'El historial de Triage no tiene la forma esperada.' };
  }
  // Validación por-registro de las entidades críticas (RF-14.2): como la
  // restauración reemplaza el estado local entero, un solo registro corrupto
  // rechaza el paquete en vez de escribirse sobre datos buenos.
  if (!(obj.games as unknown[]).every(esGameRecordValido)) {
    return { ok: false, error: 'Alguna partida del respaldo está corrupta o incompleta.' };
  }
  if (!(obj.errorCards as unknown[]).every(esErrorCardValida)) {
    return { ok: false, error: 'Alguna tarjeta de la Cola del respaldo está corrupta o incompleta.' };
  }
  if (!(obj.calibrationRecords as unknown[]).every(esCalibrationRecordValido)) {
    return { ok: false, error: 'Algún registro de calibración del respaldo está corrupto o incompleto.' };
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
      dobleSolucionAttempts: (obj.dobleSolucionAttempts ?? []) as DobleSolucionAttempt[],
      stoykoAttempts: (obj.stoykoAttempts ?? []) as StoykoAttempt[],
      triageAttempts: (obj.triageAttempts ?? []) as TriageAttempt[],
    },
  };
}
