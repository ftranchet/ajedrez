import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { db } from '../services/storage/db';
import { DEFAULT_PROFILE } from '../services/storage/profileRepo';
import { descargarRespaldo, nombreDelRespaldo, REVOCAR_URL_TRAS_MS } from './descargarRespaldo';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('descargarRespaldo', () => {
  it('nombra el archivo con el día local, no con el UTC', () => {
    expect(nombreDelRespaldo(new Date(2026, 6, 17, 23, 30))).toBe('elomax-export-2026-07-17.zip');
  });

  // El límite de error (R1) la usa cuando el resto de la app está roto: este
  // test no carga ningún store, solo la base.
  it('baja el respaldo leído de la base y revoca la URL recién después', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await db.profile.put({ ...DEFAULT_PROFILE, bandaElo: 'avanzado' });
    const enlace = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => enlace) });
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((objeto) => {
      blob = objeto as Blob;
      return 'blob:respaldo';
    });
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await descargarRespaldo();

    expect(enlace.click).toHaveBeenCalledOnce();
    expect(enlace.href).toBe('blob:respaldo');
    expect(enlace.download).toMatch(/^elomax-export-\d{4}-\d{2}-\d{2}\.zip$/);
    const archivos = unzipSync(new Uint8Array(await blob!.arrayBuffer()));
    expect(JSON.parse(strFromU8(archivos['profile.json']))).toMatchObject({ bandaElo: 'avanzado' });
    // Revocarla en el mismo tick puede cancelar la descarga (B18).
    expect(revocar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOCAR_URL_TRAS_MS);
    expect(revocar).toHaveBeenCalledWith('blob:respaldo');
  });
});
