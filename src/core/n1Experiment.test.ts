import { describe, expect, it } from 'vitest';
import type { GameRecord, N1Experiment, SessionRecord } from './types';
import { closeDueN1Phases, compareN1Conditions, currentN1Phase, n1DoseForWindow, startN1Experiment, type N1ExperimentData } from './n1Experiment';

const START = new Date('2026-01-01T12:00:00.000Z');
const emptyData: N1ExperimentData = { games: [], sessions: [], compromisoAttempts: [], stoykoAttempts: [] };

function game(id: string, day: number, errors: number): GameRecord {
  return {
    id,
    pgn: '1. e4 e5 *',
    fuente: 'manual',
    ritmo: 'clasica',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: true,
    jugadorColor: 'w',
    fecha: new Date(START.getTime() + day * 86_400_000).toISOString(),
    analisis: {
      jugadas: Array.from({ length: errors }, (_, ply) => ({
        ply, san: 'e4', fenAntes: 'startpos', ladoQueMueve: 'w', jugadaUsuario: 'e2e4', jugadaMotor: 'd2d4',
        cpAntes: 0, cpDespues: -200, cpPerdidos: 200, clasificacion: 'grave',
      })),
      comparacionEvaluaciones: [],
      analizadaEn: new Date(START.getTime() + day * 86_400_000).toISOString(),
    },
  };
}

describe('experimento n=1 ABAB (RF-12.4)', () => {
  it('crea cuatro fases de 14 días, línea base y modalidades alternadas', () => {
    const experiment = startN1Experiment(
      { modalidadA: 'radar', modalidadB: 'partidas-analisis', dosisSemanalA: 24, dosisSemanalB: 2 },
      emptyData,
      START,
      'n1',
    );
    expect(experiment.fases.map((phase) => [phase.id, phase.modalidad])).toEqual([
      ['A1', 'radar'], ['B1', 'partidas-analisis'], ['A2', 'radar'], ['B2', 'partidas-analisis'],
    ]);
    expect(new Date(experiment.fases[0].fin).getTime() - new Date(experiment.fases[0].inicio).getTime()).toBe(14 * 86_400_000);
    expect(experiment.lineaBase.erroresGravesPorPartida).toBeNull();
  });

  it('rechaza dos condiciones iguales o dosis inválidas', () => {
    expect(() => startN1Experiment({ modalidadA: 'radar', modalidadB: 'radar', dosisSemanalA: 1, dosisSemanalB: 1 }, emptyData, START)).toThrow();
    expect(() => startN1Experiment({ modalidadA: 'radar', modalidadB: 'calculo', dosisSemanalA: 0, dosisSemanalB: 1 }, emptyData, START)).toThrow();
  });

  it('mide la dosis con la unidad real de cada modalidad', () => {
    const session: SessionRecord = {
      id: 's1', fechaInicio: START.toISOString(), fechaFin: START.toISOString(), estado: 'completada',
      bloques: [{ tipo: 'radar', planificados: 8, completados: 7, estado: 'completado' }],
    };
    const data: N1ExperimentData = {
      games: [game('g1', 1, 2)],
      sessions: [session],
      compromisoAttempts: [{ id: 'c1', itemId: 'x', profundidad: 3, correcta: true, primerErrorEn: null, fecha: START.toISOString() }],
      stoykoAttempts: [{ id: 'st1', itemId: 'x', candidatas: [], acierto: true, confianzaDeclarada: 50, tiempoMs: 1, fecha: START.toISOString() }],
    };
    const end = new Date(START.getTime() + 14 * 86_400_000);
    expect(n1DoseForWindow('radar', data, START, end)).toBe(7);
    expect(n1DoseForWindow('calculo', data, START, end)).toBe(2);
    expect(n1DoseForWindow('partidas-analisis', data, START, end)).toBe(1);
  });

  it('cierra fases vencidas una sola vez y completa al día 56', () => {
    const initial = startN1Experiment(
      { modalidadA: 'radar', modalidadB: 'calculo', dosisSemanalA: 10, dosisSemanalB: 2 },
      emptyData,
      START,
      'n1',
    );
    const afterFirst = closeDueN1Phases(initial, emptyData, new Date(START.getTime() + 15 * 86_400_000));
    expect(afterFirst.fases[0].snapshot).toBeDefined();
    expect(currentN1Phase(afterFirst)?.id).toBe('B1');
    expect(closeDueN1Phases(afterFirst, emptyData, new Date(START.getTime() + 15 * 86_400_000))).toBe(afterFirst);

    const complete = closeDueN1Phases(afterFirst, emptyData, new Date(START.getTime() + 57 * 86_400_000));
    expect(complete.estado).toBe('completado');
    expect(complete.fases.every((phase) => phase.snapshot)).toBe(true);
  });

  it('compara A y B solo con al menos tres partidas por condición', () => {
    const base = startN1Experiment(
      { modalidadA: 'radar', modalidadB: 'partidas-analisis', dosisSemanalA: 10, dosisSemanalB: 2 },
      emptyData,
      START,
      'n1',
    );
    const snapshots = [
      { erroresGravesPorPartida: 1, partidasAnalizadas: 2, rating: null, dosisReal: 10, cerradaEn: START.toISOString() },
      { erroresGravesPorPartida: 2, partidasAnalizadas: 2, rating: null, dosisReal: 2, cerradaEn: START.toISOString() },
      { erroresGravesPorPartida: 1, partidasAnalizadas: 2, rating: null, dosisReal: 10, cerradaEn: START.toISOString() },
      { erroresGravesPorPartida: 3, partidasAnalizadas: 2, rating: null, dosisReal: 2, cerradaEn: START.toISOString() },
    ];
    const experiment: N1Experiment = { ...base, fases: base.fases.map((phase, index) => ({ ...phase, snapshot: snapshots[index] })) };
    expect(compareN1Conditions(experiment)).toMatchObject({ status: 'comparable', errorsA: 1, errorsB: 2.5, lowerErrors: 'A' });
  });
});
