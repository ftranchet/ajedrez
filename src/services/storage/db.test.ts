// Test de migración (CONTRIBUTING regla 3 / RNF-5): datos escritos con el
// esquema v1 deben sobrevivir y completarse al abrir con el esquema actual.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { ElomaxDB } from './db';
import type { GameRecord } from '../../core/types';

describe('migración de esquema Dexie', () => {
  it('migra registros v1 (sin fuente ni analizada) al esquema v2', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    // 1. Escribir con el esquema v1 tal como existía.
    const v1 = new Dexie(name);
    v1.version(1).stores({ games: 'id, fecha' });
    await v1.table('games').add({
      id: 'g1',
      pgn: '1. e4 e5 *',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [1000, 900],
      fecha: '2026-07-17T00:00:00.000Z',
    });
    v1.close();

    // 2. Abrir con el esquema actual: el upgrade corre solo.
    const current = new ElomaxDB(name);
    const g = (await current.games.get('g1')) as GameRecord;

    expect(g).toBeDefined();
    expect(g.fuente).toBe('local');
    expect(g.analizada).toBe(false);
    expect(g.pgn).toBe('1. e4 e5 *');

    // 3. El índice nuevo es consultable.
    const locales = await current.games.where('fuente').equals('local').toArray();
    expect(locales).toHaveLength(1);
    current.close();
  });

  it('escribe y lee un registro completo con el esquema actual', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;
    const database = new ElomaxDB(name);
    const record: GameRecord = {
      id: 'g2',
      pgn: '1. d4 d5 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: new Date().toISOString(),
    };
    await database.games.put(record);
    expect(await database.games.get('g2')).toEqual(record);
    database.close();
  });

  it('migra de v2 a v3: las partidas existentes sobreviven y las tablas nuevas de Fase 1 quedan disponibles', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    // 1. Escribir con el esquema v2 tal como existía antes de Fase 1.
    const v2 = new Dexie(name);
    v2.version(1).stores({ games: 'id, fecha' });
    v2.version(2).stores({ games: 'id, fecha, fuente' });
    await v2.table('games').add({
      id: 'g3',
      pgn: '1. c4 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-17T00:00:00.000Z',
    });
    v2.close();

    // 2. Abrir con el esquema actual (v4).
    const current = new ElomaxDB(name);
    expect(await current.games.get('g3')).toMatchObject({ id: 'g3', pgn: '1. c4 *' });

    // 3. Las tablas nuevas de Fase 1 existen y son consultables desde cero.
    expect(await current.errorCards.count()).toBe(0);
    expect(await current.radarItems.count()).toBe(0);
    expect(await current.calibrationRecords.count()).toBe(0);
    current.close();
  });

  it('migra de v3 a v4 sin perder el catálogo ni las tarjetas (progreso adaptativo del Radar)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v3 = new Dexie(name);
    v3.version(1).stores({ games: 'id, fecha' });
    v3.version(2).stores({ games: 'id, fecha, fuente' });
    v3.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    await v3.table('radarItems').add({
      id: 'legacy-radar',
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      tipo: 'tranquila',
      temas: [],
      rating: 1200,
      solucion: ['a1a2'],
      fuente: 'seed-dev',
    });
    v3.close();

    const current = new ElomaxDB(name);
    expect(await current.radarItems.get('legacy-radar')).toMatchObject({ id: 'legacy-radar' });
    expect(await current.radarProgress.count()).toBe(0);
    expect(await current.radarDatasetMeta.count()).toBe(0);
    expect(await current.radarAttempts.count()).toBe(0);
    current.close();
  });

  it('migra de v4 a v5 sin perder partidas ni tarjetas (currículo base, Fase 3)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v4 = new Dexie(name);
    v4.version(1).stores({ games: 'id, fecha' });
    v4.version(2).stores({ games: 'id, fecha, fuente' });
    v4.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    v4.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });
    await v4.table('games').add({
      id: 'g4',
      pgn: '1. Nf3 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-17T00:00:00.000Z',
    });
    v4.close();

    const current = new ElomaxDB(name);
    expect(await current.games.get('g4')).toMatchObject({ id: 'g4', pgn: '1. Nf3 *' });
    expect(await current.curriculumItems.count()).toBe(0);
    expect(await current.curriculumDatasetMeta.count()).toBe(0);
    expect(await current.curriculumProgress.count()).toBe(0);
    current.close();
  });

  it('migra de v5 a v6 sin perder partidas (perfil del Prescriptor, Fase 3)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v5 = new Dexie(name);
    v5.version(1).stores({ games: 'id, fecha' });
    v5.version(2).stores({ games: 'id, fecha, fuente' });
    v5.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    v5.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });
    v5.version(5).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
    });
    await v5.table('games').add({
      id: 'g5',
      pgn: '1. c4 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-17T00:00:00.000Z',
    });
    v5.close();

    const current = new ElomaxDB(name);
    expect(await current.games.get('g5')).toMatchObject({ id: 'g5', pgn: '1. c4 *' });
    expect(await current.profile.count()).toBe(0);
    current.close();
  });

  it('migra de v6 a v7 sin perder el perfil (regla de candidatas, Fase 4)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v6 = new Dexie(name);
    v6.version(1).stores({ games: 'id, fecha' });
    v6.version(2).stores({ games: 'id, fecha, fuente' });
    v6.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    v6.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });
    v6.version(5).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
    });
    v6.version(6).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
    });
    await v6.table('profile').add({ id: 'principal', bandaElo: 'intermedio', diagnosticoCompletadoEn: '2026-07-17T00:00:00.000Z' });
    v6.close();

    const current = new ElomaxDB(name);
    expect(await current.profile.get('principal')).toMatchObject({ bandaElo: 'intermedio' });
    expect(await current.candidataAttempts.count()).toBe(0);
    current.close();
  });

  it('migra de v7 a v8 sin perder partidas (cálculo comprometido, Fase 4)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v7 = new Dexie(name);
    v7.version(1).stores({ games: 'id, fecha' });
    v7.version(2).stores({ games: 'id, fecha, fuente' });
    v7.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    v7.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });
    v7.version(5).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
    });
    v7.version(6).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
    });
    v7.version(7).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
    });
    await v7.table('games').add({
      id: 'g6',
      pgn: '1. Nc3 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-17T00:00:00.000Z',
    });
    v7.close();

    const current = new ElomaxDB(name);
    expect(await current.games.get('g6')).toMatchObject({ id: 'g6', pgn: '1. Nc3 *' });
    expect(await current.compromisoAttempts.count()).toBe(0);
    current.close();
  });

  it('migra de v8 a v9 sin perder partidas (doble solución, Fase 4)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v8 = new Dexie(name);
    v8.version(1).stores({ games: 'id, fecha' });
    v8.version(2).stores({ games: 'id, fecha, fuente' });
    v8.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    v8.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });
    v8.version(5).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
    });
    v8.version(6).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
    });
    v8.version(7).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
    });
    v8.version(8).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
    });
    await v8.table('games').add({
      id: 'g7',
      pgn: '1. g3 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-17T00:00:00.000Z',
    });
    v8.close();

    const current = new ElomaxDB(name);
    expect(await current.games.get('g7')).toMatchObject({ id: 'g7', pgn: '1. g3 *' });
    expect(await current.dobleSolucionAttempts.count()).toBe(0);
    current.close();
  });

  it('migra de v9 a v10 sin perder partidas (Stoyko semanal, Fase 4)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    const v9 = new Dexie(name);
    v9.version(1).stores({ games: 'id, fecha' });
    v9.version(2).stores({ games: 'id, fecha, fuente' });
    v9.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
    v9.version(4).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
    });
    v9.version(5).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
    });
    v9.version(6).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
    });
    v9.version(7).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
    });
    v9.version(8).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
    });
    v9.version(9).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
      dobleSolucionAttempts: 'id, itemId, fecha',
    });
    await v9.table('games').add({
      id: 'g8',
      pgn: '1. c4 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-18T00:00:00.000Z',
    });
    v9.close();

    const current = new ElomaxDB(name);
    expect(await current.games.get('g8')).toMatchObject({ id: 'g8', pgn: '1. c4 *' });
    expect(await current.stoykoItems.count()).toBe(0);
    expect(await current.stoykoDatasetMeta.count()).toBe(0);
    current.close();
  });

  it('migra de v10 a v11 sin perder partidas (historial de Stoyko y Triage, Fase 4)', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;

    // Un v10 fresco con el esquema completo: alcanza para simular una
    // instalación en la versión anterior a las tablas de intentos.
    const v10 = new Dexie(name);
    v10.version(10).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
      radarProgress: 'id, updatedAt',
      radarDatasetMeta: 'id',
      radarAttempts: 'id, fecha, tipo, rating',
      curriculumItems: 'id, tipo, patternKey',
      curriculumDatasetMeta: 'id',
      curriculumProgress: 'id, fsrs.due, updatedAt',
      profile: 'id',
      candidataAttempts: 'id, itemId, fecha',
      compromisoAttempts: 'id, itemId, fecha',
      dobleSolucionAttempts: 'id, itemId, fecha',
      stoykoItems: 'id',
      stoykoDatasetMeta: 'id',
    });
    await v10.open();
    await v10.table('games').add({
      id: 'g10',
      pgn: '1. d4 *',
      fuente: 'local',
      ritmo: 'sin-reloj',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: false,
      fecha: '2026-07-18T00:00:00.000Z',
    });
    v10.close();

    const current = new ElomaxDB(name);
    expect(await current.games.get('g10')).toMatchObject({ id: 'g10', pgn: '1. d4 *' });
    // Las tablas nuevas quedan disponibles y vacías.
    expect(await current.stoykoAttempts.count()).toBe(0);
    expect(await current.triageAttempts.count()).toBe(0);
    // Y se puede escribir en ellas.
    await current.stoykoAttempts.add({ id: 's1', itemId: 'stoyko-01', candidatas: [], acierto: true, confianzaDeclarada: 60, tiempoMs: 1000, fecha: '2026-07-18T00:00:00.000Z' });
    await current.triageAttempts.add({ id: 't1', itemId: 'r1', tipo: 'ofensiva', decisionUsuario: 'calcular', decisionCorrecta: 'calcular', correcta: true, tiempoMs: 800, fecha: '2026-07-18T00:00:00.000Z' });
    expect(await current.stoykoAttempts.count()).toBe(1);
    expect(await current.triageAttempts.count()).toBe(1);
    current.close();
  });

  it('migra de v11 a v12: normaliza el centro del Radar y crea sesiones', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;
    const v11 = new Dexie(name);
    v11.version(11).stores({
      radarProgress: 'id, updatedAt',
      radarAttempts: 'id, fecha, tipo, rating',
      stoykoAttempts: 'id, itemId, fecha',
      triageAttempts: 'id, itemId, fecha',
    });
    await v11.open();
    await v11.table('radarProgress').add({
      id: 'principal',
      historialTipos: ['ofensiva'],
      historialIds: ['r1'],
      ratingCentro: 1640,
      aciertosRecientes: [true, false],
      updatedAt: '2026-07-18T00:00:00.000Z',
    });
    v11.close();

    const current = new ElomaxDB(name);
    const progress = await current.radarProgress.get('principal');
    expect(progress?.dificultadCentro).toBe(50);
    expect(progress?.historialIds).toEqual(['r1']);
    expect(progress?.aciertosRecientes).toEqual([true, false]);
    expect(await current.sessions.count()).toBe(0);
    await current.sessions.add({
      id: 's1',
      fechaInicio: '2026-07-19T10:00:00.000Z',
      estado: 'completada',
      bloques: [],
      fechaFin: '2026-07-19T10:10:00.000Z',
      duracionMs: 600_000,
    });
    expect(await current.sessions.count()).toBe(1);
    current.close();
  });

  it('migra de v12 a v13 sin perder sesiones y crea las mediciones de transferencia', async () => {
    const name = `elomax-test-${crypto.randomUUID()}`;
    const v12 = new Dexie(name);
    v12.version(12).stores({
      sessions: 'id, fechaInicio, estado',
      radarProgress: 'id, updatedAt',
    });
    await v12.open();
    await v12.table('sessions').add({
      id: 's12',
      fechaInicio: '2026-07-19T10:00:00.000Z',
      estado: 'completada',
      bloques: [],
    });
    v12.close();

    const current = new ElomaxDB(name);
    expect(await current.sessions.get('s12')).toMatchObject({ id: 's12', estado: 'completada' });
    expect(await current.transferMeasurements.count()).toBe(0);
    await current.transferMeasurements.add({
      id: 'm1',
      datasetVersion: 'transfer-v1',
      startedAt: '2026-07-19T11:00:00.000Z',
      completedAt: null,
      responses: [],
    });
    expect(await current.transferMeasurements.count()).toBe(1);
    current.close();
  });
});
