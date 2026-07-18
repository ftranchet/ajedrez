import { describe, expect, it } from 'vitest';
import { buildExportBundle, validateImportBundle } from './exportData';
import { DEFAULT_PROFILE } from './prescriptor';
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
  dobleSolucionAttempts: [],
  stoykoAttempts: [],
  triageAttempts: [],
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
    }
  });
});
