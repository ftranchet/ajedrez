// Mecánica de archivo para E14: arma y lee el .zip (RF-14.1). El contenido
// (qué se exporta, cómo se valida) es lógica pura en core/exportData.ts;
// acá solo entra/sale un Uint8Array — el puerto entre dominio y IO.
import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate';
import { buildExportBundle, validateImportBundle, type ExportSourceData, type ImportResult } from '../../core/exportData';
import { errorCardRepo } from '../storage/errorCardRepo';
import { calibrationRepo } from '../storage/calibrationRepo';
import { gameRepo } from '../storage/gameRepo';
import { radarProgressRepo } from '../storage/radarProgressRepo';
import { radarAttemptRepo } from '../storage/radarAttemptRepo';
import { curriculumProgressRepo } from '../storage/curriculumProgressRepo';
import { profileRepo } from '../storage/profileRepo';
import { candidataAttemptRepo } from '../storage/candidataAttemptRepo';
import { db } from '../storage/db';

function pgnFileName(gameId: string): string {
  return `games/${gameId}.pgn`;
}

/** Arma el .zip completo (RF-14.1): manifiesto + JSON + PGN legible aparte. */
export async function exportAllData(): Promise<Uint8Array> {
  const data: ExportSourceData = {
    games: await gameRepo.list(),
    errorCards: await errorCardRepo.list(),
    calibrationRecords: await calibrationRepo.list(),
    radarProgress: await radarProgressRepo.list(),
    radarAttempts: await radarAttemptRepo.list(),
    curriculumProgress: await curriculumProgressRepo.list(),
    profile: await profileRepo.get(),
    candidataAttempts: await candidataAttemptRepo.list(),
  };
  const bundle = buildExportBundle(data);

  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(bundle.manifest, null, 2)),
    'games.json': strToU8(JSON.stringify(bundle.games, null, 2)),
    'errorCards.json': strToU8(JSON.stringify(bundle.errorCards, null, 2)),
    'calibrationRecords.json': strToU8(JSON.stringify(bundle.calibrationRecords, null, 2)),
    'radarProgress.json': strToU8(JSON.stringify(bundle.radarProgress, null, 2)),
    'radarAttempts.json': strToU8(JSON.stringify(bundle.radarAttempts, null, 2)),
    'curriculumProgress.json': strToU8(JSON.stringify(bundle.curriculumProgress, null, 2)),
    'profile.json': strToU8(JSON.stringify(bundle.profile, null, 2)),
    'candidataAttempts.json': strToU8(JSON.stringify(bundle.candidataAttempts, null, 2)),
  };
  // PGN legible por separado (RF-14.3/14.5): cualquier visor lo abre sin
  // depender de esta app, aunque el import solo lee games.json.
  for (const game of bundle.games) {
    files[pgnFileName(game.id)] = strToU8(game.pgn);
  }

  return zipSync(files, { level: 6 });
}

export type ImportOutcome = { ok: true; resumen: { partidas: number; tarjetas: number; calibraciones: number; respuestasRadar: number } } | { ok: false; error: string };

/** Restaura un .zip exportado previamente (RF-14.2), con migración validada. */
export async function importAllData(zipBytes: Uint8Array): Promise<ImportOutcome> {
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch {
    return { ok: false, error: 'El archivo no es un .zip válido de ELOmax.' };
  }

  const manifestRaw = unzipped['manifest.json'];
  const gamesRaw = unzipped['games.json'];
  const errorCardsRaw = unzipped['errorCards.json'];
  const calibrationRaw = unzipped['calibrationRecords.json'];
  const radarProgressRaw = unzipped['radarProgress.json'];
  const radarAttemptsRaw = unzipped['radarAttempts.json'];
  const curriculumProgressRaw = unzipped['curriculumProgress.json'];
  const profileRaw = unzipped['profile.json'];
  const candidataAttemptsRaw = unzipped['candidataAttempts.json'];
  if (!manifestRaw || !gamesRaw || !errorCardsRaw || !calibrationRaw) {
    return { ok: false, error: 'Faltan archivos dentro del .zip (¿es una exportación de ELOmax?).' };
  }

  let parsed: unknown;
  try {
    parsed = {
      manifest: JSON.parse(strFromU8(manifestRaw)),
      games: JSON.parse(strFromU8(gamesRaw)),
      errorCards: JSON.parse(strFromU8(errorCardsRaw)),
      calibrationRecords: JSON.parse(strFromU8(calibrationRaw)),
      // Los respaldos creados antes de esta mejora no tenían progreso del
      // Radar, del currículo, ni perfil; importarlos debe seguir siendo
      // posible (RF-14.2).
      radarProgress: radarProgressRaw ? JSON.parse(strFromU8(radarProgressRaw)) : [],
      radarAttempts: radarAttemptsRaw ? JSON.parse(strFromU8(radarAttemptsRaw)) : [],
      curriculumProgress: curriculumProgressRaw ? JSON.parse(strFromU8(curriculumProgressRaw)) : [],
      profile: profileRaw ? JSON.parse(strFromU8(profileRaw)) : undefined,
      // Los respaldos de antes de Fase 4 no traen la regla de candidatas (RF-5.8).
      candidataAttempts: candidataAttemptsRaw ? JSON.parse(strFromU8(candidataAttemptsRaw)) : [],
    };
  } catch {
    return { ok: false, error: 'Algún archivo dentro del .zip no es JSON válido.' };
  }

  const result: ImportResult = validateImportBundle(parsed);
  if (!result.ok) return { ok: false, error: result.error };

  const { bundle } = result;
  await db.transaction(
    'rw',
    [db.games, db.errorCards, db.calibrationRecords, db.radarProgress, db.radarAttempts, db.curriculumProgress, db.profile, db.candidataAttempts],
    async () => {
      if (bundle.games.length > 0) await db.games.bulkPut(bundle.games);
      if (bundle.errorCards.length > 0) await db.errorCards.bulkPut(bundle.errorCards);
      if (bundle.calibrationRecords.length > 0) await db.calibrationRecords.bulkPut(bundle.calibrationRecords);
      if (bundle.radarProgress.length > 0) await db.radarProgress.bulkPut(bundle.radarProgress);
      if (bundle.radarAttempts.length > 0) await db.radarAttempts.bulkPut(bundle.radarAttempts);
      if (bundle.curriculumProgress.length > 0) await db.curriculumProgress.bulkPut(bundle.curriculumProgress);
      await db.profile.put(bundle.profile);
      if (bundle.candidataAttempts.length > 0) await db.candidataAttempts.bulkPut(bundle.candidataAttempts);
    },
  );

  return {
    ok: true,
    resumen: {
      partidas: bundle.games.length,
      tarjetas: bundle.errorCards.length,
      calibraciones: bundle.calibrationRecords.length,
      respuestasRadar: bundle.radarAttempts.length,
    },
  };
}
