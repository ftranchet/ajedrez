// Prueba el criterio de salida de Fase 1: "una exportación hecha en un
// dispositivo restaura el estado completo en otro". Acá lo simulamos
// exportando de una base, vaciándola (simula "otro dispositivo" vacío) e
// importando de vuelta.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAllData, importAllData } from './exportImport';
import { db } from '../storage/db';
import { buildGameRecord } from '../../core/game';
import { buildErrorCard } from '../../core/errorCard';

beforeEach(async () => {
  await db.games.clear();
  await db.errorCards.clear();
  await db.calibrationRecords.clear();
  await db.radarProgress.clear();
  await db.radarAttempts.clear();
  await db.curriculumProgress.clear();
  await db.profile.clear();
  await db.candidataAttempts.clear();
  await db.compromisoAttempts.clear();
  await db.dobleSolucionAttempts.clear();
  await db.stoykoAttempts.clear();
  await db.triageAttempts.clear();
  await db.sessions.clear();
  await db.transferMeasurements.clear();
});

describe('exportAllData / importAllData', () => {
  it('exporta y restaura partidas, tarjetas y calibración completas', async () => {
    const game = buildGameRecord({
      pgn: '1. e4 e5 *',
      resultado: '*',
      tiemposPorJugadaMs: [1000],
      fuente: 'local',
      ritmo: 'sin-reloj',
    });
    await db.games.put(game);

    const card = buildErrorCard({
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 2',
      ladoAMover: 'b',
      jugadaUsuario: 'g8f6',
      jugadaCorrecta: 'd7d6',
      categoria: 'tactico',
      origen: 'radar',
    });
    await db.errorCards.put(card);

    await db.calibrationRecords.put({
      id: 'c1',
      contexto: 'radar',
      confianzaDeclarada: 80,
      acierto: true,
      fecha: new Date().toISOString(),
    });
    await db.radarProgress.put({
      id: 'principal',
      historialTipos: ['tranquila'],
      historialIds: ['radar-1'],
      ratingCentro: 1160,
      aciertosRecientes: [true, false],
      updatedAt: new Date().toISOString(),
    });
    await db.radarAttempts.put({
      id: 'r1',
      itemId: 'radar-1',
      tipo: 'tranquila',
      rating: 1200,
      acierto: true,
      fecha: new Date().toISOString(),
    });
    await db.curriculumProgress.put({
      id: 'patron-mate-pasillo-1',
      fsrs: {
        due: new Date().toISOString(),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 1,
        lapses: 0,
        learningSteps: 0,
        state: 'learning',
        lastReview: new Date().toISOString(),
      },
      demostracionesLimpias: 1,
      updatedAt: new Date().toISOString(),
    });
    await db.profile.put({ id: 'principal', bandaElo: 'avanzado', diagnosticoCompletadoEn: new Date().toISOString() });
    await db.candidataAttempts.put({ id: 'cand-1', itemId: 'radar-1', cambio: true, resultado: 'mejoro', fecha: new Date().toISOString() });
    await db.compromisoAttempts.put({ id: 'comp-1', itemId: 'radar-1', profundidad: 3, correcta: true, primerErrorEn: null, fecha: new Date().toISOString() });
    await db.dobleSolucionAttempts.put({ id: 'ds-1', itemId: 'radar-1', resultado: 'familiar', fecha: new Date().toISOString() });
    await db.stoykoAttempts.put({ id: 'st-1', itemId: 'stoyko-01', candidatas: [{ jugada: 'e2e4', evaluacion: '=' }], acierto: true, confianzaDeclarada: 70, tiempoMs: 12000, fecha: new Date().toISOString() });
    await db.triageAttempts.put({ id: 'tr-1', itemId: 'radar-1', tipo: 'ofensiva', decisionUsuario: 'calcular', decisionCorrecta: 'calcular', correcta: true, tiempoMs: 900, fecha: new Date().toISOString() });
    await db.sessions.put({
      id: 'ses-1',
      fechaInicio: '2026-07-19T10:00:00.000Z',
      fechaFin: '2026-07-19T10:15:00.000Z',
      estado: 'completada',
      duracionMs: 900_000,
      bloques: [{ tipo: 'radar', planificados: 8, completados: 8, estado: 'completado' }],
    });
    await db.transferMeasurements.put({
      id: 'transfer-1',
      datasetVersion: 'transfer-v1',
      startedAt: '2026-07-19T11:00:00.000Z',
      completedAt: null,
      responses: [{ itemId: 'transfer-01', move: 'e2e4', correct: true, tiempoMs: 5000, fecha: '2026-07-19T11:00:05.000Z' }],
    });

    const zip = await exportAllData();
    expect(zip.byteLength).toBeGreaterThan(0);

    // "Otro dispositivo": base vacía.
    await db.games.clear();
    await db.errorCards.clear();
    await db.calibrationRecords.clear();
    await db.radarProgress.clear();
    await db.radarAttempts.clear();
    await db.curriculumProgress.clear();
    await db.profile.clear();
    await db.candidataAttempts.clear();
    await db.compromisoAttempts.clear();
    await db.dobleSolucionAttempts.clear();
    await db.stoykoAttempts.clear();
    await db.triageAttempts.clear();
    await db.sessions.clear();
    await db.transferMeasurements.clear();
    expect(await db.games.count()).toBe(0);

    const outcome = await importAllData(zip);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.resumen).toEqual({ partidas: 1, tarjetas: 1, calibraciones: 1, respuestasRadar: 1 });

    const restoredGame = await db.games.get(game.id);
    expect(restoredGame).toEqual(game);
    const restoredCard = await db.errorCards.get(card.id);
    expect(restoredCard).toEqual(card);
    const restoredCalibration = await db.calibrationRecords.get('c1');
    expect(restoredCalibration?.confianzaDeclarada).toBe(80);
    expect((await db.radarProgress.get('principal'))?.ratingCentro).toBe(1160);
    expect((await db.radarAttempts.get('r1'))?.acierto).toBe(true);
    expect((await db.curriculumProgress.get('patron-mate-pasillo-1'))?.demostracionesLimpias).toBe(1);
    expect((await db.profile.get('principal'))?.bandaElo).toBe('avanzado');
    expect((await db.candidataAttempts.get('cand-1'))?.resultado).toBe('mejoro');
    expect((await db.compromisoAttempts.get('comp-1'))?.correcta).toBe(true);
    expect((await db.dobleSolucionAttempts.get('ds-1'))?.resultado).toBe('familiar');
    expect((await db.stoykoAttempts.get('st-1'))?.candidatas[0].jugada).toBe('e2e4');
    expect((await db.stoykoAttempts.get('st-1'))?.tiempoMs).toBe(12000);
    expect((await db.triageAttempts.get('tr-1'))?.correcta).toBe(true);
    expect((await db.sessions.get('ses-1'))?.duracionMs).toBe(900_000);
    expect((await db.transferMeasurements.get('transfer-1'))?.responses).toHaveLength(1);
  });

  it('rechaza un archivo que no es un zip de ELOmax', async () => {
    const outcome = await importAllData(new TextEncoder().encode('esto no es un zip'));
    expect(outcome.ok).toBe(false);
  });

  it('restaurar REEMPLAZA, no fusiona: los registros locales ausentes del respaldo desaparecen (RF-14.2)', async () => {
    // Respaldo con una sola partida.
    const enElRespaldo = buildGameRecord({ pgn: '1. e4 *', resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(enElRespaldo);
    const zip = await exportAllData();

    // El dispositivo destino ya tiene datos propios distintos.
    await db.games.clear();
    const soloLocal = buildGameRecord({ pgn: '1. d4 *', resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(soloLocal);
    await db.errorCards.put(
      buildErrorCard({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', ladoAMover: 'w', jugadaUsuario: 'a1a2', jugadaCorrecta: 'a1b1', categoria: 'tactico', origen: 'radar' }),
    );

    const outcome = await importAllData(zip);
    expect(outcome.ok).toBe(true);
    // La partida local, ausente del respaldo, ya no está: el estado quedó
    // idéntico al del respaldo, no fusionado con lo que había.
    expect(await db.games.get(soloLocal.id)).toBeUndefined();
    expect(await db.games.get(enElRespaldo.id)).toBeDefined();
    expect(await db.games.count()).toBe(1);
    // Una tabla vacía en el respaldo vacía la local (antes bulkPut no podía).
    expect(await db.errorCards.count()).toBe(0);
  });

  it('importar dos veces el mismo respaldo deja el mismo estado (idempotente)', async () => {
    const game = buildGameRecord({ pgn: '1. e4 e5 *', resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);
    const zip = await exportAllData();

    await importAllData(zip);
    await importAllData(zip);
    expect(await db.games.count()).toBe(1);
  });

  it('rechaza un respaldo con una partida corrupta sin tocar los datos existentes', async () => {
    const bueno = buildGameRecord({ pgn: '1. e4 *', resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(bueno);

    // Armar a mano un zip con una partida sin `pgn` (corrupta).
    const { zipSync, strToU8 } = await import('fflate');
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ esquema: 10, exportadoEn: new Date().toISOString(), app: 'elomax' })),
      'games.json': strToU8(JSON.stringify([{ id: 'x', fuente: 'local', ritmo: 'sin-reloj', resultado: '*', analizada: false, fecha: '2026-01-01' }])),
      'errorCards.json': strToU8('[]'),
      'calibrationRecords.json': strToU8('[]'),
    });

    const outcome = await importAllData(zip);
    expect(outcome.ok).toBe(false);
    // El dato bueno preexistente sigue intacto: la validación corre antes de
    // tocar Dexie, así que un respaldo corrupto no borra nada.
    expect(await db.games.get(bueno.id)).toBeDefined();
  });

  it('rechaza un archivo comprimido descomunal antes de descomprimirlo', async () => {
    // > 100 MB de entrada: se corta sin intentar unzipSync (evita el spike de memoria).
    const enorme = new Uint8Array(101 * 1024 * 1024);
    const outcome = await importAllData(enorme);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain('demasiado grande');
  });

  it('exporta el PGN de cada partida como archivo legible aparte (RF-14.3/14.5)', async () => {
    const { unzipSync, strFromU8 } = await import('fflate');
    const game = buildGameRecord({
      pgn: '1. d4 d5 *',
      resultado: '*',
      tiemposPorJugadaMs: [],
      fuente: 'local',
      ritmo: 'sin-reloj',
    });
    await db.games.put(game);
    const zip = await exportAllData();
    const files = unzipSync(zip);
    expect(strFromU8(files[`games/${game.id}.pgn`])).toBe('1. d4 d5 *');
  });
});
