// Registro de tiempo entrenado (RF-13.4). La lógica de qué es un tramo válido
// vive en core/trainingEvents.ts; acá está solo la persistencia y el atajo que
// usan las pantallas para anotar lo que acaban de medir.
import type { ModalidadEntrenamiento, TrainingEvent } from '../../core/types';
import { buildTrainingEvent } from '../../core/trainingEvents';
import { db, type ElomaxDB } from './db';

export interface TrainingEventRepo {
  list(): Promise<TrainingEvent[]>;
  save(evento: TrainingEvent): Promise<void>;
}

export class DexieTrainingEventRepo implements TrainingEventRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<TrainingEvent[]> {
    return this.database.trainingEvents.orderBy('fecha').reverse().toArray();
  }

  /** `put` y no `add`: el id es determinista, así que reescribir el mismo tramo
   * lo deja igual en vez de duplicarlo (ver `trainingEventId`). */
  async save(evento: TrainingEvent): Promise<void> {
    await this.database.trainingEvents.put(evento);
  }
}

export const trainingEventRepo: TrainingEventRepo = new DexieTrainingEventRepo();

/**
 * Anota un tramo medido. Pensada para llamarse desde los stores al terminar una
 * actividad, sin `await` y sin manejo de error propio: **medir el tiempo nunca
 * puede romper la actividad que lo produjo**. Si la duración no es utilizable
 * (no se midió, salió negativa, o quedó absurda porque la pestaña estuvo
 * abierta toda la noche) no se escribe nada.
 */
export function registrarTiempoEntrenado(
  modalidad: ModalidadEntrenamiento,
  refId: string,
  ms: number,
  fecha: string = new Date().toISOString(),
): void {
  const evento = buildTrainingEvent(modalidad, refId, ms, fecha);
  if (!evento) return;
  void trainingEventRepo.save(evento).catch(() => undefined);
}
