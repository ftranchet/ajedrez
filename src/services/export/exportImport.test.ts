// Prueba el criterio de salida de Fase 1: "una exportación hecha en un
// dispositivo restaura el estado completo en otro". Acá lo simulamos
// exportando de una base, vaciándola (simula "otro dispositivo" vacío) e
// importando de vuelta.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAllUserData, exportAllData, importAllData } from './exportImport';
import { db } from '../storage/db';
import { buildGameRecord } from '../../core/game';
import { buildErrorCard } from '../../core/errorCard';
import { startN1Experiment } from '../../core/n1Experiment';
import { SCHEMA_VERSION } from '../../core/schemaVersion';

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
  await db.n1Experiments.clear();
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
    await db.n1Experiments.put(startN1Experiment(
      { modalidadA: 'radar', modalidadB: 'calculo', dosisSemanalA: 24, dosisSemanalB: 3 },
      { games: [game], sessions: [], calculoAttempts: [] },
      new Date('2026-07-19T12:00:00.000Z'),
      'n1-1',
    ));

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
    await db.n1Experiments.clear();
    expect(await db.games.count()).toBe(0);

    const outcome = await importAllData(zip);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.resumen).toEqual({
      partidas: 1,
      tarjetas: 1,
      calibraciones: 1,
      respuestasRadar: 1,
      esquemaOrigen: SCHEMA_VERSION,
      // Un respaldo recién exportado ya está al día: no corre ninguna migración.
      migraciones: [],
    });

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
    expect((await db.n1Experiments.get('n1-1'))?.fases).toHaveLength(4);
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

  it('deleteAllUserData borra los datos del usuario pero conserva los catálogos reseedables', async () => {
    const game = buildGameRecord({ pgn: '1. e4 e5 *', resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);
    await db.profile.put({ id: 'principal', bandaElo: 'avanzado', diagnosticoCompletadoEn: new Date().toISOString() });
    await db.curriculumProgress.put({
      id: 'patron-mate-pasillo-1',
      fsrs: { due: '2026-01-01T00:00:00.000Z', stability: 5, difficulty: 5, elapsedDays: 0, scheduledDays: 0, reps: 1, lapses: 0, learningSteps: 0, state: 'review', lastReview: '2026-01-01T00:00:00.000Z' },
      demostracionesLimpias: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    // Un catálogo reseedable (contenido, no dato del usuario) que NO debe borrarse.
    await db.radarItems.put({ id: 'radar-seed-1', fen: '8/8/8/8/8/8/8/8 w - - 0 1', tipo: 'envenenada', temas: [], rating: 1200, solucion: ['a1a2'], fuente: 'seed-dev' });

    await deleteAllUserData();

    expect(await db.games.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
    expect(await db.curriculumProgress.count()).toBe(0);
    // El catálogo sigue intacto.
    expect(await db.radarItems.get('radar-seed-1')).toBeDefined();
  });

  it('deleteAllUserData también borra el token de Lichess y las preferencias locales', async () => {
    // El agujero de privacidad que cierra: el borrado vaciaba solo IndexedDB,
    // así que tras "Eliminar todos mis datos" y recargar, la app seguía
    // conectada a Lichess con el bearer token intacto en localStorage.
    const almacen = new Map<string, string>([
      ['elomax-lichess-token', 'lip_secreto'],
      ['elomax-theme', 'dark'],
      ['elomax-notacion', 'en'],
      ['elomax-blind-training', 'off'],
      ['otra-app', 'no se toca'],
    ]);
    vi.stubGlobal('localStorage', {
      get length() {
        return almacen.size;
      },
      key: (i: number) => [...almacen.keys()][i] ?? null,
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => almacen.set(k, v),
      removeItem: (k: string) => almacen.delete(k),
    });

    await deleteAllUserData();

    expect(almacen.get('elomax-lichess-token')).toBeUndefined();
    expect([...almacen.keys()].filter((k) => k.startsWith('elomax-'))).toEqual([]);
    // Lo de otras apps en el mismo origen no es asunto de ELOmax.
    expect(almacen.get('otra-app')).toBe('no se toca');
    vi.unstubAllGlobals();
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

  it('restaura un respaldo v17 migrándolo: el historial de cálculo no desaparece', async () => {
    // Regresión de punta a punta del agujero de migraciones: las migraciones
    // de Dexie solo corren cuando cambia la versión de IndexedDB, y restaurar
    // no la cambia. Un respaldo v17 entraba crudo en la base v19 y sus
    // intentos quedaban en las tablas viejas, invisibles para el Panel, que
    // lee `calculoAttempts`.
    const { zipSync, strToU8 } = await import('fflate');
    // El catálogo local aporta la solución para reconstruir los plies.
    await db.radarItems.put({
      id: 'radar-1',
      fen: 'r4rk1/pp2Bppp/2n1b3/q1pp4/8/P1Q2NP1/1PP1PP1P/2KR3R b - - 1 15',
      tipo: 'ofensiva',
      temas: [],
      rating: 1412,
      solucion: ['a5c3', 'b2c3', 'c6e7'],
      fuente: 'lichess-cc0',
    });
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ esquema: 17, exportadoEn: '2026-02-01T00:00:00.000Z', app: 'elomax' })),
      'games.json': strToU8('[]'),
      'errorCards.json': strToU8('[]'),
      'calibrationRecords.json': strToU8('[]'),
      'compromisoAttempts.json': strToU8(
        JSON.stringify([
          { id: 'comp-viejo', itemId: 'radar-1', profundidad: 3, correcta: false, primerErrorEn: 2, fecha: '2026-01-05T10:00:00.000Z' },
        ]),
      ),
      'stoykoAttempts.json': strToU8(
        JSON.stringify([
          { id: 'st-viejo', itemId: 'stoyko-01', candidatas: [{ jugada: 'e2e4', evaluacion: '=' }], acierto: true, confianzaDeclarada: 60, tiempoMs: 30_000, fecha: '2026-01-06T10:00:00.000Z' },
        ]),
      ),
    });

    const outcome = await importAllData(zip);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.resumen.esquemaOrigen).toBe(17);
    expect(outcome.resumen.migraciones).toEqual([18, 19]);

    // Lo que el Panel lee: los dos intentos, ya convertidos.
    const unificados = await db.calculoAttempts.toArray();
    expect(unificados.map((a) => a.id).sort()).toEqual(['comp-viejo', 'st-viejo']);
    expect(unificados.find((a) => a.id === 'comp-viejo')!.ramas[0]!.linea).toEqual(['a5c3', 'b2c3']);
    // Y el original tampoco se pierde.
    expect(await db.compromisoAttempts.count()).toBe(1);
  });

  it('rechaza un manifiesto con una versión de esquema que ninguna migración cubre', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ esquema: 0, exportadoEn: new Date().toISOString(), app: 'elomax' })),
      'games.json': strToU8('[]'),
      'errorCards.json': strToU8('[]'),
      'calibrationRecords.json': strToU8('[]'),
    });
    const outcome = await importAllData(zip);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toContain('inválida');
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
    const pgns = Object.keys(files).filter((nombre) => nombre.endsWith('.pgn'));
    expect(pgns).toHaveLength(1);
    expect(pgns[0]).toContain(game.id);
    expect(strFromU8(files[pgns[0]!])).toBe('1. d4 d5 *');
  });

  it('un id de partida con traversal no genera una entrada fuera de games/', async () => {
    // Los ids propios son UUID, pero uno importado puede ser cualquier string.
    // ELOmax no extrae el zip al disco, pero sí lo genera: no puede emitir un
    // archivo que ataque al descompresor de quien lo abra.
    const { unzipSync } = await import('fflate');
    const game = buildGameRecord({ pgn: '1. e4 *', resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put({ ...game, id: '../../../etc/passwd' });

    const nombres = Object.keys(unzipSync(await exportAllData()));
    expect(nombres.every((nombre) => !nombre.includes('..'))).toBe(true);
    expect(nombres.filter((n) => n.endsWith('.pgn')).every((n) => n.startsWith('games/'))).toBe(true);
  });
});
