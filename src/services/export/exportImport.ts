// Mecánica de archivo para E14: arma y lee el .zip (RF-14.1). El contenido
// (qué se exporta, cómo se valida) es lógica pura en core/exportData.ts;
// acá solo entra/sale un Uint8Array — el puerto entre dominio y IO.
import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate';
import { buildExportBundle, validateImportBundle, type ExportSourceData, type ImportResult } from '../../core/exportData';
import { migrarDatosImportados } from '../../core/importMigrations';
import { clearLocalNamespace } from '../storage/localNamespace';
import { cancelReminder } from '../notifications/reminder';
import { errorCardRepo } from '../storage/errorCardRepo';
import { calibrationRepo } from '../storage/calibrationRepo';
import { gameRepo } from '../storage/gameRepo';
import { radarProgressRepo } from '../storage/radarProgressRepo';
import { radarAttemptRepo } from '../storage/radarAttemptRepo';
import { curriculumProgressRepo } from '../storage/curriculumProgressRepo';
import { profileRepo } from '../storage/profileRepo';
import { candidataAttemptRepo } from '../storage/candidataAttemptRepo';
import { compromisoAttemptRepo } from '../storage/compromisoAttemptRepo';
import { calculoAttemptRepo } from '../storage/calculoAttemptRepo';
import { dobleSolucionAttemptRepo } from '../storage/dobleSolucionAttemptRepo';
import { stoykoAttemptRepo } from '../storage/stoykoAttemptRepo';
import { triageAttemptRepo } from '../storage/triageAttemptRepo';
import { sessionRepo } from '../storage/sessionRepo';
import { transferMeasurementRepo } from '../storage/transferMeasurementRepo';
import { n1ExperimentRepo } from '../storage/n1ExperimentRepo';
import { dailyAssignmentRepo } from '../storage/dailyAssignmentRepo';
import { db } from '../storage/db';

/**
 * Nombre del PGN dentro del .zip, saneado.
 *
 * Los IDs propios son UUID, pero un `id` importado puede ser cualquier string:
 * uno como `../../fuera` se reexportaba como una entrada con traversal. ELOmax
 * nunca extrae el .zip al disco —el import lee `games.json`—, así que no es un
 * agujero *de esta app*; lo sería del descompresor de quien abra el archivo, y
 * ese archivo lo genera ELOmax. Se sanea acá y no en el import porque el
 * nombre lo elige la exportación.
 *
 * Colisiones: dos IDs que sanean igual (`a/b` y `a_b`) se desambiguan con el
 * índice, para que ningún PGN pise a otro dentro del zip.
 */
function pgnFileName(gameId: string, indice: number): string {
  // El punto tampoco sobrevive: sin puntos no hay `..` posible, ni siquiera
  // dentro de un segmento, y un id nunca necesitó puntos.
  const seguro = gameId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `games/${indice}-${seguro.slice(0, 80) || 'partida'}.pgn`;
}

/** Tablas con datos del usuario: todo lo exportable/borrable. Los catálogos
 * reseedables (radarItems/curriculumItems/stoykoItems y su meta) quedan afuera
 * a propósito —son contenido, no datos personales, y se repueblan solos—. */
function userDataTables() {
  return [
    db.games,
    db.errorCards,
    db.calibrationRecords,
    db.radarProgress,
    db.radarAttempts,
    db.curriculumProgress,
    db.profile,
    db.candidataAttempts,
    db.compromisoAttempts,
    db.calculoAttempts,
    db.dobleSolucionAttempts,
    db.stoykoAttempts,
    db.triageAttempts,
    db.sessions,
    db.transferMeasurements,
    db.n1Experiments,
    db.dailyAssignments,
  ];
}

/**
 * Borra TODOS los datos del usuario (E14): perfil, partidas, tarjetas de
 * error, progreso, intentos, sesiones y mediciones en IndexedDB, **más** el
 * namespace local del dispositivo —tema, notación, modo a ciegas y el token de
 * Lichess— y el recordatorio agendado. Deja la app como recién instalada; los
 * catálogos reseedables se repueblan solos. Es irreversible; la confirmación
 * vive en la UI.
 *
 * El token entra en el borrado aunque nunca entre en la exportación: son dos
 * promesas distintas. La exportación no lo lleva para que un respaldo no sea
 * una credencial suelta; el borrado sí lo toca porque "eliminar todos mis
 * datos" y dejar la sesión de Lichess viva es exactamente lo que el usuario no
 * espera. Desconectar la cuenta del lado de Lichess sigue siendo cosa suya: la
 * app puede olvidar el token, no revocarlo.
 */
export async function deleteAllUserData(): Promise<void> {
  const tables = userDataTables();
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
  });
  clearLocalNamespace();
  // Sin esto seguía llegando la notificación diaria de una rutina ya borrada.
  await cancelReminder();
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
    compromisoAttempts: await compromisoAttemptRepo.list(),
    calculoAttempts: await calculoAttemptRepo.list(),
    dobleSolucionAttempts: await dobleSolucionAttemptRepo.list(),
    stoykoAttempts: await stoykoAttemptRepo.list(),
    triageAttempts: await triageAttemptRepo.list(),
    sessions: await sessionRepo.list(),
    transferMeasurements: await transferMeasurementRepo.list(),
    n1Experiments: await n1ExperimentRepo.list(),
    dailyAssignments: await dailyAssignmentRepo.list(),
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
    'compromisoAttempts.json': strToU8(JSON.stringify(bundle.compromisoAttempts, null, 2)),
    'calculoAttempts.json': strToU8(JSON.stringify(bundle.calculoAttempts, null, 2)),
    'dobleSolucionAttempts.json': strToU8(JSON.stringify(bundle.dobleSolucionAttempts, null, 2)),
    'stoykoAttempts.json': strToU8(JSON.stringify(bundle.stoykoAttempts, null, 2)),
    'triageAttempts.json': strToU8(JSON.stringify(bundle.triageAttempts, null, 2)),
    'sessions.json': strToU8(JSON.stringify(bundle.sessions, null, 2)),
    'transferMeasurements.json': strToU8(JSON.stringify(bundle.transferMeasurements, null, 2)),
    'n1Experiments.json': strToU8(JSON.stringify(bundle.n1Experiments, null, 2)),
    'dailyAssignments.json': strToU8(JSON.stringify(bundle.dailyAssignments, null, 2)),
  };
  // PGN legible por separado (RF-14.3/14.5): cualquier visor lo abre sin
  // depender de esta app, aunque el import solo lee games.json.
  bundle.games.forEach((game, indice) => {
    files[pgnFileName(game.id, indice)] = strToU8(game.pgn);
  });

  return zipSync(files, { level: 6 });
}

export type ImportOutcome =
  | {
      ok: true;
      resumen: {
        partidas: number;
        tarjetas: number;
        calibraciones: number;
        respuestasRadar: number;
        /** Esquema del respaldo, tal como venía en su manifiesto. */
        esquemaOrigen: number;
        /** Versiones de migración aplicadas al restaurar; vacío si estaba al día. */
        migraciones: number[];
      };
    }
  | { ok: false; error: string };

// Topes de tamaño para no descomprimir un archivo enorme o un "zip bomb" en
// memoria (unzipSync descomprime todo de una). Una exportación real de ELOmax
// —local-first, los datos de una sola persona— pesa a lo sumo unos pocos MB;
// estos topes son holgados y solo cortan lo patológico o malicioso.
const MAX_ZIP_INPUT_BYTES = 100 * 1024 * 1024; // 100 MB comprimidos de entrada
const MAX_UNCOMPRESSED_BYTES = 400 * 1024 * 1024; // 400 MB descomprimidos en total

/** Restaura un .zip exportado previamente (RF-14.2): reemplaza el estado local
 * completo, con validación y topes de tamaño. */
export async function importAllData(zipBytes: Uint8Array): Promise<ImportOutcome> {
  if (zipBytes.length > MAX_ZIP_INPUT_BYTES) {
    return { ok: false, error: 'El archivo es demasiado grande para ser una exportación de ELOmax.' };
  }
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(zipBytes);
  } catch {
    return { ok: false, error: 'El archivo no es un .zip válido de ELOmax.' };
  }
  const totalDescomprimido = Object.values(unzipped).reduce((sum, bytes) => sum + bytes.length, 0);
  if (totalDescomprimido > MAX_UNCOMPRESSED_BYTES) {
    return { ok: false, error: 'El contenido del archivo es demasiado grande para restaurarse.' };
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
  const compromisoAttemptsRaw = unzipped['compromisoAttempts.json'];
  const calculoAttemptsRaw = unzipped['calculoAttempts.json'];
  const dobleSolucionAttemptsRaw = unzipped['dobleSolucionAttempts.json'];
  const stoykoAttemptsRaw = unzipped['stoykoAttempts.json'];
  const triageAttemptsRaw = unzipped['triageAttempts.json'];
  const sessionsRaw = unzipped['sessions.json'];
  const transferMeasurementsRaw = unzipped['transferMeasurements.json'];
  const n1ExperimentsRaw = unzipped['n1Experiments.json'];
  const dailyAssignmentsRaw = unzipped['dailyAssignments.json'];
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
      // Ni cálculo comprometido (E7, RF-7.1).
      compromisoAttempts: compromisoAttemptsRaw ? JSON.parse(strFromU8(compromisoAttemptsRaw)) : [],
      calculoAttempts: calculoAttemptsRaw ? JSON.parse(strFromU8(calculoAttemptsRaw)) : [],
      // Ni doble solución (RF-5.7).
      dobleSolucionAttempts: dobleSolucionAttemptsRaw ? JSON.parse(strFromU8(dobleSolucionAttemptsRaw)) : [],
      // Ni el historial de Stoyko (E7) o Triage (E9), agregados en esquema v11.
      stoykoAttempts: stoykoAttemptsRaw ? JSON.parse(strFromU8(stoykoAttemptsRaw)) : [],
      triageAttempts: triageAttemptsRaw ? JSON.parse(strFromU8(triageAttemptsRaw)) : [],
      sessions: sessionsRaw ? JSON.parse(strFromU8(sessionsRaw)) : [],
      transferMeasurements: transferMeasurementsRaw ? JSON.parse(strFromU8(transferMeasurementsRaw)) : [],
      n1Experiments: n1ExperimentsRaw ? JSON.parse(strFromU8(n1ExperimentsRaw)) : [],
      // Los respaldos anteriores al plan diario persistente (esquema v17) no lo traen.
      dailyAssignments: dailyAssignmentsRaw ? JSON.parse(strFromU8(dailyAssignmentsRaw)) : [],
    };
  } catch {
    return { ok: false, error: 'Algún archivo dentro del .zip no es JSON válido.' };
  }

  const result: ImportResult = validateImportBundle(parsed);
  if (!result.ok) return { ok: false, error: result.error };

  // Un respaldo viejo se migra ANTES de escribir. Las migraciones de Dexie no
  // corren al restaurar —solo cuando cambia la versión de IndexedDB—, así que
  // sin este paso los datos entraban crudos en la base actual: intentos de
  // cálculo invisibles para el Panel, pérdidas de centipeones imposibles y
  // partidas del diagnóstico contadas como entrenamiento propio.
  const { bundle: validado } = result;
  // La reconstrucción de los intentos de cálculo viejos necesita el catálogo
  // del Radar, que no viaja en el respaldo por ser contenido reseedable. Se lee
  // el local; si todavía no está sembrado, la conversión deja las ramas vacías
  // en vez de inventarlas.
  const solucionPorItem = new Map(
    (await db.radarItems.toArray()).map((item) => [item.id, item.solucion] as const),
  );
  const { datos: bundle, aplicadas } = migrarDatosImportados(validado, validado.manifest.esquema, {
    solucionPorItem,
  });
  // Restauración = REEMPLAZO, no fusión (RF-14.2, "restauración total"): se
  // vacía cada tabla de datos personales antes de escribir el respaldo, todo
  // dentro de una transacción. Sin esto, `bulkPut` fusionaba —registros
  // locales que no estaban en el respaldo sobrevivían, una colección vacía
  // en el respaldo no podía vaciar la local, e importar dos veces mezclaba
  // historiales—, así que restaurar en el dispositivo B no dejaba a B igual
  // a A. Los catálogos (radarItems/curriculumItems/stoykoItems) NO se tocan:
  // son contenido reseedable, no datos del usuario, y se repueblan solos.
  await db.transaction(
    'rw',
    userDataTables(),
    async () => {
      await Promise.all(userDataTables().map((table) => table.clear()));
      if (bundle.games.length > 0) await db.games.bulkPut(bundle.games);
      if (bundle.errorCards.length > 0) await db.errorCards.bulkPut(bundle.errorCards);
      if (bundle.calibrationRecords.length > 0) await db.calibrationRecords.bulkPut(bundle.calibrationRecords);
      if (bundle.radarProgress.length > 0) await db.radarProgress.bulkPut(bundle.radarProgress);
      if (bundle.radarAttempts.length > 0) await db.radarAttempts.bulkPut(bundle.radarAttempts);
      if (bundle.curriculumProgress.length > 0) await db.curriculumProgress.bulkPut(bundle.curriculumProgress);
      await db.profile.put(bundle.profile);
      if (bundle.candidataAttempts.length > 0) await db.candidataAttempts.bulkPut(bundle.candidataAttempts);
      if (bundle.compromisoAttempts.length > 0) await db.compromisoAttempts.bulkPut(bundle.compromisoAttempts);
      if (bundle.calculoAttempts.length > 0) await db.calculoAttempts.bulkPut(bundle.calculoAttempts);
      if (bundle.dobleSolucionAttempts.length > 0) await db.dobleSolucionAttempts.bulkPut(bundle.dobleSolucionAttempts);
      if (bundle.stoykoAttempts.length > 0) await db.stoykoAttempts.bulkPut(bundle.stoykoAttempts);
      if (bundle.triageAttempts.length > 0) await db.triageAttempts.bulkPut(bundle.triageAttempts);
      if (bundle.sessions.length > 0) await db.sessions.bulkPut(bundle.sessions);
      if (bundle.transferMeasurements.length > 0) await db.transferMeasurements.bulkPut(bundle.transferMeasurements);
      if (bundle.n1Experiments.length > 0) await db.n1Experiments.bulkPut(bundle.n1Experiments);
      if (bundle.dailyAssignments.length > 0) await db.dailyAssignments.bulkPut(bundle.dailyAssignments);
    },
  );

  return {
    ok: true,
    resumen: {
      partidas: bundle.games.length,
      tarjetas: bundle.errorCards.length,
      calibraciones: bundle.calibrationRecords.length,
      respuestasRadar: bundle.radarAttempts.length,
      esquemaOrigen: validado.manifest.esquema,
      migraciones: aplicadas,
    },
  };
}
