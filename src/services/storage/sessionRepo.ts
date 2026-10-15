import type { SessionRecord } from '../../core/types';
import { cerrarSesionColgada } from '../../core/session';
import { db } from './db';
import { registrarTiempoEntrenado } from './trainingEventRepo';

export const sessionRepo = {
  async list(): Promise<SessionRecord[]> {
    return db.sessions.orderBy('fechaInicio').reverse().toArray();
  },
  async save(record: SessionRecord): Promise<void> {
    await db.sessions.put(record);
  },
  /**
   * Cierra las sesiones que quedaron `en_curso` antes de empezar otra, igual
   * que `loadSummary`: cortadas en el último instante observado y con su tramo
   * anotado en el tiempo entrenado (RF-13.4). Con la hora actual, una sesión
   * colgada desde ayer sumaba las horas que estuvo abierta, y sin el tramo sus
   * minutos no contaban en ninguna lectura de carga (B16).
   */
  async abandonInProgress(exceptId?: string): Promise<void> {
    const records = await db.sessions.where('estado').equals('en_curso').toArray();
    await Promise.all(
      records
        .filter((record) => record.id !== exceptId)
        .map(cerrarSesionColgada)
        .map(async (record) => {
          await db.sessions.put(record);
          await registrarTiempoEntrenado('sesion', record.id, record.duracionMs ?? 0, record.fechaFin ?? record.fechaInicio);
        }),
    );
  },
};
