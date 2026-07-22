// Hitos (RF-13.6): logros ligados a una capacidad demostrada o a evidencia
// nueva, cada uno con su significado en la interfaz — nunca XP, monedas,
// cofres ni rankings. No se persiste ningún estado de recompensa (mismo
// criterio que ADR-0013 para la racha): los hitos se derivan de los datos del
// usuario cada vez. Por eso se eligen señales mayormente monótonas —una vez
// demostrada la capacidad, no se "pierde" el hito por una mala semana—; las
// pocas que son evidencia del momento (mejora de errores, calibración) reflejan
// el estado actual con honestidad, sin fingir permanencia.
import type {
  CalibrationRecord,
  CurriculumProgress,
  DobleSolucionAttempt,
  GameRecord,
  TransferMeasurement,
} from './types';
import { brierScore } from './calibration';
import { isAutomatizado } from './curriculum';
import { mejoraErroresGraves } from './panel';
import { transferResults } from './transfer';

export type HitoId =
  | 'primera-partida-analizada'
  | 'patron-automatizado'
  | 'doble-solucion-superior'
  | 'transferencia-sostenida'
  | 'mejora-errores-graves'
  | 'calibracion-afinada';

export interface Hito {
  id: HitoId;
  /** ISO 8601 cuando el logro se puede fechar con precisión; ausente si no. */
  fecha?: string;
}

/** Orden canónico de exhibición: capacidades primero, evidencia del momento después. */
export const HITOS_ORDEN: HitoId[] = [
  'primera-partida-analizada',
  'patron-automatizado',
  'doble-solucion-superior',
  'transferencia-sostenida',
  'mejora-errores-graves',
  'calibracion-afinada',
];

// La calibración pide una muestra mínima para no premiar un Brier bajo de suerte.
const CALIBRACION_MIN_REGISTROS = 15;
const CALIBRACION_BRIER_MAX = 0.18;

export interface MilestoneInputs {
  games: GameRecord[];
  calibraciones: CalibrationRecord[];
  curriculumProgress: CurriculumProgress[];
  dobleSolucionAttempts: DobleSolucionAttempt[];
  transferMeasurements: TransferMeasurement[];
  transferVersion?: string;
  now?: Date;
}

function primerISO(fechas: Array<string | undefined>): string | undefined {
  const validas = fechas.filter((f): f is string => typeof f === 'string' && f.length > 0).sort();
  return validas[0];
}

/**
 * Hitos alcanzados por el usuario, en orden canónico (RF-13.6). Cada elemento
 * incluye la fecha del logro cuando se puede fechar. No devuelve los no
 * alcanzados: la interfaz muestra capacidades demostradas, no una lista de
 * misiones pendientes.
 */
export function hitosLogrados(inputs: MilestoneInputs): Hito[] {
  const { games, calibraciones, curriculumProgress, dobleSolucionAttempts, transferMeasurements, transferVersion, now } = inputs;
  const logros = new Map<HitoId, Hito>();

  // Capacidad: analizar las propias partidas en dos fases (E3).
  const analizadas = games.filter((g) => g.analisis !== undefined);
  if (analizadas.length > 0) {
    const fecha = primerISO(analizadas.map((g) => g.analisis?.analizadaEn));
    logros.set('primera-partida-analizada', { id: 'primera-partida-analizada', ...(fecha ? { fecha } : {}) });
  }

  // Capacidad: automatizar un patrón del currículo (RF-6.3).
  const automatizados = curriculumProgress.filter(isAutomatizado);
  if (automatizados.length > 0) {
    const fecha = primerISO(automatizados.map((p) => p.updatedAt));
    logros.set('patron-automatizado', { id: 'patron-automatizado', ...(fecha ? { fecha } : {}) });
  }

  // Capacidad: romper el efecto Einstellung eligiendo la jugada superior (RF-5.7).
  const superiores = dobleSolucionAttempts.filter((a) => a.resultado === 'superior');
  if (superiores.length > 0) {
    const fecha = primerISO(superiores.map((a) => a.fecha));
    logros.set('doble-solucion-superior', { id: 'doble-solucion-superior', ...(fecha ? { fecha } : {}) });
  }

  // Evidencia (monótona): alguna toma posterior de la batería superó a la primera (RF-12.2).
  const results = transferResults(transferMeasurements, transferVersion); // más antigua primero
  const primera = results[0];
  if (primera) {
    const superadoras = results.slice(1).filter((r) => r.percentage > primera.percentage);
    if (superadoras.length > 0) {
      const fecha = primerISO(superadoras.map((r) => r.completedAt));
      logros.set('transferencia-sostenida', { id: 'transferencia-sostenida', ...(fecha ? { fecha } : {}) });
    }
  }

  // Evidencia del momento: los errores graves por partida bajaron de forma sostenida (RF-13.2).
  if (mejoraErroresGraves(games, now) !== null) {
    logros.set('mejora-errores-graves', { id: 'mejora-errores-graves' });
  }

  // Capacidad/evidencia: juicio calibrado (Brier bajo con muestra suficiente, RF-10.2).
  const brier = brierScore(calibraciones);
  if (calibraciones.length >= CALIBRACION_MIN_REGISTROS && brier !== null && brier <= CALIBRACION_BRIER_MAX) {
    logros.set('calibracion-afinada', { id: 'calibracion-afinada' });
  }

  return HITOS_ORDEN.filter((id) => logros.has(id)).map((id) => logros.get(id) as Hito);
}
