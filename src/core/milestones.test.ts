import { describe, expect, it } from 'vitest';
import { hitosLogrados, HITOS_ORDEN, type MilestoneInputs } from './milestones';
import { newCurriculumProgress } from './curriculum';
import type {
  CalibrationRecord,
  DobleSolucionAttempt,
  GameAnalysis,
  GameRecord,
  TransferMeasurement,
} from './types';

function baseInputs(overrides: Partial<MilestoneInputs> = {}): MilestoneInputs {
  return {
    games: [],
    calibraciones: [],
    curriculumProgress: [],
    dobleSolucionAttempts: [],
    transferMeasurements: [],
    transferVersion: 'transfer-v1',
    ...overrides,
  };
}

function analizada(id: string, analizadaEn: string): GameRecord {
  const analisis: GameAnalysis = { jugadas: [], comparacionEvaluaciones: [], analizadaEn };
  return {
    id,
    pgn: '1. e4 e5 *',
    fuente: 'local',
    ritmo: 'sin-reloj',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: true,
    analisis,
    jugadorColor: 'w',
    fecha: analizadaEn,
  };
}

function doble(resultado: DobleSolucionAttempt['resultado'], fecha: string): DobleSolucionAttempt {
  return { id: crypto.randomUUID(), itemId: 'ds1', resultado, fecha };
}

function calibracionPerfecta(n: number): CalibrationRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    contexto: 'radar' as const,
    confianzaDeclarada: 100,
    acierto: true,
    fecha: '2026-07-01T00:00:00.000Z',
  }));
}

function toma(id: string, completedAt: string, correct: number, total: number): TransferMeasurement {
  return {
    id,
    datasetVersion: 'transfer-v1',
    startedAt: completedAt,
    completedAt,
    responses: Array.from({ length: total }, (_, i) => ({
      itemId: `t${i}`,
      move: 'e2e4',
      correct: i < correct,
      tiempoMs: 1000,
      fecha: completedAt,
    })),
  };
}

describe('hitosLogrados (RF-13.6)', () => {
  it('sin datos, no hay hitos', () => {
    expect(hitosLogrados(baseInputs())).toEqual([]);
  });

  it('reconoce la capacidad de analizar la propia partida, con fecha del análisis', () => {
    const hitos = hitosLogrados(baseInputs({ games: [analizada('g1', '2026-07-10T00:00:00.000Z')] }));
    expect(hitos).toEqual([{ id: 'primera-partida-analizada', fecha: '2026-07-10T00:00:00.000Z' }]);
  });

  it('reconoce un patrón automatizado (3 demostraciones limpias)', () => {
    const progress = { ...newCurriculumProgress('p1', new Date('2026-07-05')), demostracionesLimpias: 3, updatedAt: '2026-07-05T00:00:00.000Z' };
    const hitos = hitosLogrados(baseInputs({ curriculumProgress: [progress] }));
    expect(hitos.map((h) => h.id)).toEqual(['patron-automatizado']);
    expect(hitos[0].fecha).toBe('2026-07-05T00:00:00.000Z');
  });

  it('no reconoce un patrón sin la racha de automatización', () => {
    const progress = { ...newCurriculumProgress('p1'), demostracionesLimpias: 2 };
    expect(hitosLogrados(baseInputs({ curriculumProgress: [progress] }))).toEqual([]);
  });

  it('reconoce haber elegido la jugada superior (anti-Einstellung), no la familiar', () => {
    const soloFamiliar = hitosLogrados(baseInputs({ dobleSolucionAttempts: [doble('familiar', '2026-07-01T00:00:00.000Z')] }));
    expect(soloFamiliar).toEqual([]);
    const conSuperior = hitosLogrados(baseInputs({
      dobleSolucionAttempts: [doble('familiar', '2026-07-01T00:00:00.000Z'), doble('superior', '2026-07-03T00:00:00.000Z')],
    }));
    expect(conSuperior).toEqual([{ id: 'doble-solucion-superior', fecha: '2026-07-03T00:00:00.000Z' }]);
  });

  it('reconoce transferencia sostenida cuando una toma posterior supera a la primera', () => {
    const primera = toma('m1', '2026-05-01T00:00:00.000Z', 1, 3); // 33%
    const segunda = toma('m2', '2026-06-20T00:00:00.000Z', 2, 3); // 67%
    const hitos = hitosLogrados(baseInputs({ transferMeasurements: [primera, segunda] }));
    expect(hitos).toEqual([{ id: 'transferencia-sostenida', fecha: '2026-06-20T00:00:00.000Z' }]);
  });

  it('no reconoce transferencia si la única toma es la primera, ni si no mejoró', () => {
    const primera = toma('m1', '2026-05-01T00:00:00.000Z', 2, 3);
    expect(hitosLogrados(baseInputs({ transferMeasurements: [primera] }))).toEqual([]);
    const peor = toma('m2', '2026-06-20T00:00:00.000Z', 1, 3);
    expect(hitosLogrados(baseInputs({ transferMeasurements: [primera, peor] }))).toEqual([]);
  });

  it('reconoce calibración afinada solo con muestra suficiente y Brier bajo', () => {
    expect(hitosLogrados(baseInputs({ calibraciones: calibracionPerfecta(14) }))).toEqual([]); // muestra insuficiente
    const hitos = hitosLogrados(baseInputs({ calibraciones: calibracionPerfecta(15) }));
    expect(hitos.map((h) => h.id)).toEqual(['calibracion-afinada']);
  });

  it('devuelve los hitos en el orden canónico', () => {
    const hitos = hitosLogrados(baseInputs({
      games: [analizada('g1', '2026-07-10T00:00:00.000Z')],
      dobleSolucionAttempts: [doble('superior', '2026-07-03T00:00:00.000Z')],
      calibraciones: calibracionPerfecta(15),
    }));
    const ids = hitos.map((h) => h.id);
    expect(ids).toEqual(HITOS_ORDEN.filter((id) => ids.includes(id)));
    expect(ids).toEqual(['primera-partida-analizada', 'doble-solucion-superior', 'calibracion-afinada']);
  });
});
