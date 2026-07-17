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

    const zip = await exportAllData();
    expect(zip.byteLength).toBeGreaterThan(0);

    // "Otro dispositivo": base vacía.
    await db.games.clear();
    await db.errorCards.clear();
    await db.calibrationRecords.clear();
    await db.radarProgress.clear();
    await db.radarAttempts.clear();
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
  });

  it('rechaza un archivo que no es un zip de ELOmax', async () => {
    const outcome = await importAllData(new TextEncoder().encode('esto no es un zip'));
    expect(outcome.ok).toBe(false);
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
