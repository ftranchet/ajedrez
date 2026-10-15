import { describe, expect, it } from 'vitest';
import { hitosLogrados, HITOS_ORDEN, type MilestoneInputs } from './milestones';
import { brechaCalibracion, brierScore } from './calibration';
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

/** `n` registros que declaran `confianza`; los primeros `aciertos` aciertan. */
function registrosCalibracion(n: number, confianza: number, aciertos: number): CalibrationRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    contexto: 'radar' as const,
    confianzaDeclarada: confianza,
    acierto: i < aciertos,
    fecha: '2026-07-01T00:00:00.000Z',
  }));
}

function ids(inputs: Partial<MilestoneInputs>): string[] {
  return hitosLogrados(baseInputs(inputs)).map((h) => h.id);
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

  describe('juicio calibrado: brecha de calibración, no Brier (RF-10.3)', () => {
    it('lo reconoce en quien está calibrado al 70% que sostiene el Radar, aunque su Brier sea 0,21', () => {
      // Regresión B8: con el umbral de Brier (≤ 0,18) este usuario, calibrado
      // a la perfección en el material para el que se diseñó la app, nunca lo veía.
      const calibrado = registrosCalibracion(30, 70, 21);
      expect(brierScore(calibrado)).toBeCloseTo(0.21, 10);
      expect(ids({ calibraciones: calibrado })).toEqual(['calibracion-afinada']);
    });

    it('no lo reconoce en quien declara 90% y acierta la mitad', () => {
      expect(ids({ calibraciones: registrosCalibracion(30, 90, 15) })).toEqual([]);
    });

    it('no lo reconoce por acertar mucho si la confianza no lo anticipaba', () => {
      // Declara 80% y acierta todo: Brier 0,04 lo otorgaba, pero la confianza
      // queda 20 puntos por debajo del acierto.
      expect(ids({ calibraciones: registrosCalibracion(30, 80, 30) })).toEqual([]);
    });

    it('pide al menos 15 registros', () => {
      const quince = registrosCalibracion(15, 60, 9); // brecha 0
      expect(ids({ calibraciones: quince })).toEqual(['calibracion-afinada']);
      // El mismo usuario con un registro menos (8 de 14, brecha ~3): muestra insuficiente.
      expect(ids({ calibraciones: quince.slice(1) })).toEqual([]);
    });

    it('en el umbral: una brecha de 10 puntos lo alcanza; una de 11, no', () => {
      // 20 registros con 75% de acierto: declarar 85 deja la brecha justo en 10.
      const enUmbral = registrosCalibracion(20, 85, 15);
      expect(brechaCalibracion(enUmbral)).toBe(10);
      expect(ids({ calibraciones: enUmbral })).toEqual(['calibracion-afinada']);
      expect(ids({ calibraciones: registrosCalibracion(20, 86, 15) })).toEqual([]);
    });
  });

  it('devuelve los hitos en el orden canónico', () => {
    const hitos = hitosLogrados(baseInputs({
      games: [analizada('g1', '2026-07-10T00:00:00.000Z')],
      dobleSolucionAttempts: [doble('superior', '2026-07-03T00:00:00.000Z')],
      calibraciones: registrosCalibracion(15, 100, 15),
    }));
    const ids = hitos.map((h) => h.id);
    expect(ids).toEqual(HITOS_ORDEN.filter((id) => ids.includes(id)));
    expect(ids).toEqual(['primera-partida-analizada', 'doble-solucion-superior', 'calibracion-afinada']);
  });
});
