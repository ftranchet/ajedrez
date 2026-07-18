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
  };
}

export type ImportResult = { ok: true; bundle: ExportBundle } | { ok: false; error: string };

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
    },
  };
}
