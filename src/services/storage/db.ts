// Dexie sobre IndexedDB con migraciones versionadas (ADR-0001, RNF-5).
// Toda versión que cambie el modelo de datos agrega un bloque version(n)
// nuevo con su upgrade; nunca se edita una versión ya publicada.
import Dexie, { type Table } from 'dexie';
import type { GameRecord } from '../../core/types';

export const DB_NAME = 'elomax';

export class ElomaxDB extends Dexie {
  games!: Table<GameRecord, string>;

  constructor(name: string = DB_NAME) {
    super(name);

    // v1 — esquema inicial: partidas con índice por fecha.
    this.version(1).stores({
      games: 'id, fecha',
    });

    // v2 — migración de prueba (Fase 0): agrega el índice `fuente` y
    // rellena el campo en registros v1 que no lo tenían. Demuestra que el
    // mecanismo de upgrade funciona antes de que haya datos reales en juego.
    this.version(2)
      .stores({
        games: 'id, fecha, fuente',
      })
      .upgrade(async (tx) => {
        await tx
          .table('games')
          .toCollection()
          .modify((g: Partial<GameRecord>) => {
            if (g.fuente === undefined) g.fuente = 'local';
            if (g.analizada === undefined) g.analizada = false;
          });
      });
  }
}

export const db = new ElomaxDB();
