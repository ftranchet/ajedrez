import { describe, expect, it } from 'vitest';
import {
  MAX_TRAMO_MS,
  buildTrainingEvent,
  esTrainingEventValido,
  eventosDesdeHistorial,
  eventosEnVentana,
  minutosDeEventos,
  minutosPorModalidad,
  trainingEventId,
} from './trainingEvents';
import type { CalculoAttempt, SessionRecord, TrainingEvent } from './types';

const MIN = 60_000;

function evento(over: Partial<TrainingEvent> = {}): TrainingEvent {
  return {
    id: 'sesion:x',
    modalidad: 'sesion',
    fecha: '2026-08-04T10:00:00.000Z',
    ms: 20 * MIN,
    ...over,
  };
}

describe('buildTrainingEvent', () => {
  it('mide en milisegundos y deja el id determinista', () => {
    const construido = buildTrainingEvent('final', 'patron-1:123', 8 * MIN, '2026-08-04T10:00:00.000Z');
    expect(construido).toEqual({
      id: 'final:patron-1:123',
      modalidad: 'final',
      fecha: '2026-08-04T10:00:00.000Z',
      ms: 8 * MIN,
      refId: 'patron-1:123',
    });
  });

  it('el mismo tramo escrito dos veces es el mismo registro, no dos', () => {
    // Es lo que protege de contar doble en un reintento o un remontaje de
    // StrictMode: el repositorio hace `put` sobre este id.
    expect(trainingEventId('sesion', 'ses-1')).toBe(trainingEventId('sesion', 'ses-1'));
    expect(trainingEventId('sesion', 'ses-1')).not.toBe(trainingEventId('calculo', 'ses-1'));
  });

  it('no inventa un tramo cuando no hubo medición', () => {
    expect(buildTrainingEvent('partida', 'g1', 0, '2026-08-04T10:00:00.000Z')).toBeNull();
    expect(buildTrainingEvent('partida', 'g1', -5, '2026-08-04T10:00:00.000Z')).toBeNull();
    expect(buildTrainingEvent('partida', 'g1', Number.NaN, '2026-08-04T10:00:00.000Z')).toBeNull();
  });

  it('descarta un tramo absurdo en vez de recortarlo', () => {
    // La pestaña abierta toda la noche sobre un final: no sabemos cuánto duró
    // de verdad, y una cifra inventada inflaría la semana entera.
    expect(buildTrainingEvent('final', 'f1', MAX_TRAMO_MS + 1, '2026-08-04T10:00:00.000Z')).toBeNull();
    expect(buildTrainingEvent('final', 'f1', MAX_TRAMO_MS, '2026-08-04T10:00:00.000Z')).not.toBeNull();
  });
});

describe('lecturas de carga', () => {
  it('suma los minutos de todas las modalidades, no solo de la sesión', () => {
    // El bug que originó todo esto: el plan semanal decía "3 de 15 min" porque
    // solo la sesión diaria medía tiempo.
    const eventos = [
      evento({ id: 'a', modalidad: 'sesion', ms: 3 * MIN }),
      evento({ id: 'b', modalidad: 'calculo', ms: 15 * MIN }),
      evento({ id: 'c', modalidad: 'final', ms: 8 * MIN }),
      evento({ id: 'd', modalidad: 'partida', ms: 45 * MIN }),
      evento({ id: 'e', modalidad: 'analisis', ms: 12 * MIN }),
    ];
    expect(minutosDeEventos(eventos)).toBe(83);
    expect(minutosPorModalidad(eventos)).toEqual({
      sesion: 3,
      calculo: 15,
      final: 8,
      partida: 45,
      analisis: 12,
    });
  });

  it('la ventana excluye lo de antes, lo de después y lo que aún no ocurrió', () => {
    const eventos = [
      evento({ id: 'antes', fecha: '2026-08-02T10:00:00.000Z' }),
      evento({ id: 'dentro', fecha: '2026-08-04T10:00:00.000Z' }),
      evento({ id: 'futuro', fecha: '2026-08-05T10:00:00.000Z' }),
    ];
    const dentro = eventosEnVentana(
      eventos,
      new Date('2026-08-03T00:00:00.000Z'),
      new Date('2026-08-10T00:00:00.000Z'),
      new Date('2026-08-04T23:00:00.000Z'),
    );
    expect(dentro.map((e) => e.id)).toEqual(['dentro']);
  });

  it('una fecha inválida no rompe la suma', () => {
    const dentro = eventosEnVentana(
      [evento({ id: 'roto', fecha: 'no es una fecha' })],
      new Date('2026-08-03T00:00:00.000Z'),
      new Date('2026-08-10T00:00:00.000Z'),
    );
    expect(dentro).toEqual([]);
  });
});

describe('eventosDesdeHistorial', () => {
  const sesion: SessionRecord = {
    id: 'ses-1',
    fechaInicio: '2026-08-03T10:00:00.000Z',
    fechaFin: '2026-08-03T10:25:00.000Z',
    estado: 'completada',
    duracionMs: 25 * MIN,
    bloques: [],
  };
  const calculo: CalculoAttempt = {
    id: 'calc-1',
    preset: 'abierto',
    ramas: [],
    tiempoMs: 15 * MIN,
    fecha: '2026-08-03T18:00:00.000Z',
  };

  it('recupera el tiempo que ya estaba medido antes de que existiera el registro', () => {
    const eventos = eventosDesdeHistorial({ sessions: [sesion], calculoAttempts: [calculo] });
    expect(eventos.map((e) => [e.modalidad, e.ms])).toEqual([
      ['sesion', 25 * MIN],
      ['calculo', 15 * MIN],
    ]);
    // Fechado al final del tramo: es lo que lo ubica en su semana.
    expect(eventos[0]!.fecha).toBe('2026-08-03T10:25:00.000Z');
  });

  it('una sesión abandonada también aporta su tiempo', () => {
    const abandonada: SessionRecord = { ...sesion, id: 'ses-2', estado: 'abandonada' };
    expect(eventosDesdeHistorial({ sessions: [abandonada] })).toHaveLength(1);
  });

  it('una sesión sin duración medida no aporta nada', () => {
    const enCurso: SessionRecord = { id: 'ses-3', fechaInicio: sesion.fechaInicio, estado: 'en_curso', bloques: [] };
    expect(eventosDesdeHistorial({ sessions: [enCurso] })).toEqual([]);
  });

  it('correrla dos veces produce los mismos ids: la migración es idempotente', () => {
    const unaVez = eventosDesdeHistorial({ sessions: [sesion], calculoAttempts: [calculo] });
    const otraVez = eventosDesdeHistorial({ sessions: [sesion], calculoAttempts: [calculo] });
    expect(otraVez.map((e) => e.id)).toEqual(unaVez.map((e) => e.id));
  });
});

describe('esTrainingEventValido', () => {
  it('acepta un evento bien formado', () => {
    expect(esTrainingEventValido(evento())).toBe(true);
  });

  it('rechaza lo que un respaldo corrupto podría traer', () => {
    expect(esTrainingEventValido(null)).toBe(false);
    expect(esTrainingEventValido({ ...evento(), modalidad: 'inventada' })).toBe(false);
    expect(esTrainingEventValido({ ...evento(), fecha: 'ayer' })).toBe(false);
    expect(esTrainingEventValido({ ...evento(), ms: 0 })).toBe(false);
    expect(esTrainingEventValido({ ...evento(), ms: MAX_TRAMO_MS + 1 })).toBe(false);
    expect(esTrainingEventValido({ ...evento(), id: '' })).toBe(false);
  });
});
