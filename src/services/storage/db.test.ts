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
});
