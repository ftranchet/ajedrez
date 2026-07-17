// Dexie sobre IndexedDB con migraciones versionadas (ADR-0001, RNF-5).
// Toda versión que cambie el modelo de datos agrega un bloque version(n)
// nuevo con su upgrade; nunca se edita una versión ya publicada.
import Dexie, { type Table } from 'dexie';
import type { CalibrationRecord, ErrorCard, GameRecord, RadarItem } from '../../core/types';

export const DB_NAME = 'elomax';
/** Versión de esquema expuesta en el manifiesto de exportación (RF-14.1/14.2). */
export const SCHEMA_VERSION = 3;

export class ElomaxDB extends Dexie {
  games!: Table<GameRecord, string>;
  errorCards!: Table<ErrorCard, string>;
  radarItems!: Table<RadarItem, string>;
  calibrationRecords!: Table<CalibrationRecord, string>;

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

    // v3 — Fase 1 (E4/E5/E10): Cola Universal de errores, catálogo del
    // Radar y registros de calibración. Puramente aditivo: `games` no
    // cambia, no hace falta transformar datos existentes.
    this.version(3).stores({
      games: 'id, fecha, fuente',
      errorCards: 'id, fsrs.due, origen, categoria',
      radarItems: 'id, tipo, rating',
      calibrationRecords: 'id, contexto, fecha',
    });
  }
}

export const db = new ElomaxDB();
