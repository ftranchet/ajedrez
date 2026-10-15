// Descarga del respaldo completo como .zip (E14, RF-14.1). Lee la base directo
// con `exportAllData`, sin pasar por ningún store: la usa el límite de error de
// la app (R1), que tiene que poder sacar los datos aunque el estado en memoria
// sea justamente lo que se rompió.
import { exportAllData } from '../services/export/exportImport';
import { dailyAssignmentId } from '../core/dailyAssignment';

/**
 * Cuánto vive la URL del blob después del click. Revocarla en el mismo tick
 * puede cancelar la descarga en algunos navegadores (B18); FileSaver.js espera
 * 40 s por la misma razón.
 */
export const REVOCAR_URL_TRAS_MS = 40_000;

/** Con el día local: con el UTC, un respaldo de las 22:00 en UTC−3 salía fechado mañana. */
export function nombreDelRespaldo(now: Date = new Date()): string {
  return `elomax-export-${dailyAssignmentId(now)}.zip`;
}

/** Arma el .zip y lo baja. Si falla, rechaza: el llamador decide qué decir. */
export async function descargarRespaldo(): Promise<void> {
  const zip = await exportAllData();
  const buffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreDelRespaldo();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOCAR_URL_TRAS_MS);
}
