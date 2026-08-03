// Registro único de tiempo entrenado (RF-13.4).
//
// **El problema que corrige.** "Minutos entrenados" se leía sumando
// `SessionRecord.duracionMs`, así que solo existía el tiempo de la sesión
// diaria. Las otras cuatro actividades que el Prescriptor pide —el cálculo de
// la semana, los finales teóricos, la partida lenta y su análisis— no medían
// nada: las partidas guardaban `tiemposPorJugadaMs: []` y los finales no
// guardaban duración en ninguna parte. Un usuario que hacía todo el plan veía
// "3 de 15 min" y concluía, con razón, que la app no estaba contando.
//
// **La decisión.** Un solo registro de tramos medidos, escrito por cada
// actividad al terminar, del que salen todas las lecturas de carga. Las
// alternativas eran peores: sumar tabla por tabla obliga a cada lectura a
// conocer todas las fuentes (y a inventar duraciones donde no las hay), y
// estimar minutos a partir de la cantidad de ítems convierte una medición en
// una conjetura, que es exactamente lo que el producto dice no hacer.
//
// **Lo que NO entra.** Solo tiempo medido. Un final que no cronometró su
// duración no escribe un evento con los 8 minutos que el Prescriptor estima:
// preferimos informar de menos y que el número signifique algo. Tampoco entran
// la batería de transferencia ni las conversiones, que son mediciones y no
// entrenamiento.
import type { CalculoAttempt, ModalidadEntrenamiento, SessionRecord, TrainingEvent } from './types';

/**
 * Cota superior de un tramo: 4 horas. Un cronómetro que arrancó y nunca se
 * cerró bien —la pestaña quedó abierta toda la noche sobre un final— produciría
 * un tramo absurdo que inflaría la semana entera. Se descarta en vez de
 * recortarse: no sabemos cuánto duró de verdad, y una cifra inventada en el
 * medio es peor que la ausencia.
 */
export const MAX_TRAMO_MS = 4 * 60 * 60 * 1000;

/**
 * Id determinista. Dos escrituras del mismo tramo —un reintento, un remontaje
 * en StrictMode, una migración que vuelve a correr— colapsan en el mismo
 * registro en vez de duplicar minutos.
 */
export function trainingEventId(modalidad: ModalidadEntrenamiento, refId: string): string {
  return `${modalidad}:${refId}`;
}

/**
 * Construye el evento, o `null` si la duración no es utilizable (no medida,
 * cero, negativa o absurda). Devolver `null` en vez de tirar deja que el
 * llamador simplemente no escriba nada: no medir un tramo no puede romper la
 * actividad que lo produjo.
 */
export function buildTrainingEvent(
  modalidad: ModalidadEntrenamiento,
  refId: string,
  ms: number,
  fecha: string,
): TrainingEvent | null {
  if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_TRAMO_MS) return null;
  return { id: trainingEventId(modalidad, refId), modalidad, fecha, ms: Math.round(ms), refId };
}

/** Eventos dentro de [inicio, fin), sin pasar de `tope`. */
export function eventosEnVentana(
  eventos: TrainingEvent[],
  inicio: Date,
  fin: Date,
  tope: Date = fin,
): TrainingEvent[] {
  return eventos.filter((evento) => {
    const t = new Date(evento.fecha).getTime();
    return Number.isFinite(t) && t >= inicio.getTime() && t < fin.getTime() && t <= tope.getTime();
  });
}

/** Minutos redondeados de un conjunto de eventos. */
export function minutosDeEventos(eventos: TrainingEvent[]): number {
  return Math.round(eventos.reduce((total, evento) => total + Math.max(0, evento.ms), 0) / 60_000);
}

/** Minutos por modalidad, para poder decir de dónde salió el total. */
export function minutosPorModalidad(eventos: TrainingEvent[]): Record<ModalidadEntrenamiento, number> {
  const acumulado: Record<ModalidadEntrenamiento, number> = {
    sesion: 0,
    calculo: 0,
    final: 0,
    partida: 0,
    analisis: 0,
  };
  for (const evento of eventos) acumulado[evento.modalidad] += Math.max(0, evento.ms);
  return Object.fromEntries(
    Object.entries(acumulado).map(([modalidad, ms]) => [modalidad, Math.round(ms / 60_000)]),
  ) as Record<ModalidadEntrenamiento, number>;
}

/**
 * Eventos reconstruidos a partir de lo que ya estaba guardado antes de que
 * existiera este registro: las sesiones con duración medida y los intentos de
 * cálculo, que siempre cronometraron en silencio. La usan la migración de la
 * base (v20) y la de los respaldos importados, para que el historial no
 * aparezca vacío el día que se estrena la funcionalidad.
 *
 * Los finales, partidas y análisis anteriores no se pueden reconstruir: nunca
 * midieron nada. Su tiempo viejo se pierde y el nuevo se registra desde ahora.
 */
export function eventosDesdeHistorial(fuentes: {
  sessions?: SessionRecord[];
  calculoAttempts?: CalculoAttempt[];
}): TrainingEvent[] {
  const eventos: TrainingEvent[] = [];
  for (const record of fuentes.sessions ?? []) {
    const evento = buildTrainingEvent(
      'sesion',
      record.id,
      record.duracionMs ?? 0,
      record.fechaFin ?? record.fechaInicio,
    );
    if (evento) eventos.push(evento);
  }
  for (const intento of fuentes.calculoAttempts ?? []) {
    const evento = buildTrainingEvent('calculo', intento.id, intento.tiempoMs ?? 0, intento.fecha);
    if (evento) eventos.push(evento);
  }
  return eventos;
}

/** ¿Es un evento de entrenamiento bien formado? Para validar un respaldo. */
export function esTrainingEventValido(value: unknown): value is TrainingEvent {
  if (typeof value !== 'object' || value === null) return false;
  const evento = value as Partial<TrainingEvent>;
  const modalidades: ModalidadEntrenamiento[] = ['sesion', 'calculo', 'final', 'partida', 'analisis'];
  return (
    typeof evento.id === 'string' &&
    evento.id !== '' &&
    typeof evento.modalidad === 'string' &&
    modalidades.includes(evento.modalidad) &&
    typeof evento.fecha === 'string' &&
    Number.isFinite(new Date(evento.fecha).getTime()) &&
    typeof evento.ms === 'number' &&
    Number.isFinite(evento.ms) &&
    evento.ms > 0 &&
    evento.ms <= MAX_TRAMO_MS &&
    (evento.refId === undefined || typeof evento.refId === 'string')
  );
}
