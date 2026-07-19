// Experimento n=1 (RF-12.4): diseño ABAB fijo, línea base, dosis observada y
// comparación descriptiva. Dominio puro; la persistencia vive en services/.
import type {
  CompromisoAttempt,
  GameRecord,
  N1Experiment,
  N1ExperimentPhase,
  N1Modality,
  N1OutcomeSnapshot,
  N1PhaseSnapshot,
  SessionRecord,
  StoykoAttempt,
} from './types';
import { erroresGravesUsuario } from './panel';

const DAY_MS = 24 * 60 * 60 * 1000;
export const N1_PHASE_DAYS = 14;
export const N1_TOTAL_DAYS = N1_PHASE_DAYS * 4;
export const N1_MIN_GAMES_PER_CONDITION = 3;

export interface N1ExperimentData {
  games: GameRecord[];
  sessions: SessionRecord[];
  compromisoAttempts: CompromisoAttempt[];
  stoykoAttempts: StoykoAttempt[];
}

export interface StartN1ExperimentArgs {
  modalidadA: N1Modality;
  modalidadB: N1Modality;
  dosisSemanalA: number;
  dosisSemanalB: number;
}

function timestampInRange(iso: string, start: number, end: number): boolean {
  const timestamp = new Date(iso).getTime();
  return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
}

function latestRealRating(games: GameRecord[], end: number): number | null {
  const latest = games
    .filter((game) =>
      (game.ritmo === 'rapida' || game.ritmo === 'clasica') &&
      game.ratingUsuario !== undefined &&
      new Date(game.fecha).getTime() <= end,
    )
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
  return latest?.ratingUsuario ?? null;
}

export function n1OutcomeForWindow(games: GameRecord[], start: Date, end: Date): N1OutcomeSnapshot {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const errors = games
    .filter((game) => timestampInRange(game.fecha, startMs, endMs))
    .map(erroresGravesUsuario)
    .filter((value): value is number => value !== null);
  return {
    erroresGravesPorPartida: errors.length > 0 ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    partidasAnalizadas: errors.length,
    rating: latestRealRating(games, endMs),
  };
}

export function n1DoseForWindow(
  modalidad: N1Modality,
  data: N1ExperimentData,
  start: Date,
  end: Date,
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (modalidad === 'radar') {
    return data.sessions
      .filter((record) => record.estado === 'completada' && timestampInRange(record.fechaInicio, startMs, endMs))
      .reduce(
        (sum, record) => sum + record.bloques
          .filter((block) => block.tipo === 'radar')
          .reduce((blockSum, block) => blockSum + block.completados, 0),
        0,
      );
  }
  if (modalidad === 'calculo') {
    return data.compromisoAttempts.filter((attempt) => timestampInRange(attempt.fecha, startMs, endMs)).length +
      data.stoykoAttempts.filter((attempt) => timestampInRange(attempt.fecha, startMs, endMs)).length;
  }
  return data.games.filter(
    (game) => game.analisis?.analizadaEn && timestampInRange(game.analisis.analizadaEn, startMs, endMs),
  ).length;
}

function buildPhases(args: StartN1ExperimentArgs, now: Date): N1ExperimentPhase[] {
  const definitions = [
    ['A1', 'A', args.modalidadA],
    ['B1', 'B', args.modalidadB],
    ['A2', 'A', args.modalidadA],
    ['B2', 'B', args.modalidadB],
  ] as const;
  return definitions.map(([id, condicion, modalidad], index) => ({
    id,
    condicion,
    modalidad,
    inicio: new Date(now.getTime() + index * N1_PHASE_DAYS * DAY_MS).toISOString(),
    fin: new Date(now.getTime() + (index + 1) * N1_PHASE_DAYS * DAY_MS).toISOString(),
  }));
}

export function startN1Experiment(
  args: StartN1ExperimentArgs,
  data: N1ExperimentData,
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
): N1Experiment {
  if (args.modalidadA === args.modalidadB) throw new Error('Las condiciones A y B deben usar modalidades distintas.');
  if (![args.dosisSemanalA, args.dosisSemanalB].every((dose) => Number.isInteger(dose) && dose >= 1 && dose <= 100)) {
    throw new Error('La dosis semanal debe ser un entero entre 1 y 100.');
  }
  const baselineStart = new Date(now.getTime() - 30 * DAY_MS);
  return {
    id,
    estado: 'activo',
    creadoEn: now.toISOString(),
    ...args,
    lineaBase: { ...n1OutcomeForWindow(data.games, baselineStart, now), registradaEn: now.toISOString() },
    fases: buildPhases(args, now),
  };
}

export function summarizeN1Phase(phase: N1ExperimentPhase, data: N1ExperimentData, closedAt: Date): N1PhaseSnapshot {
  const start = new Date(phase.inicio);
  const end = new Date(phase.fin);
  return {
    ...n1OutcomeForWindow(data.games, start, end),
    dosisReal: n1DoseForWindow(phase.modalidad, data, start, end),
    cerradaEn: closedAt.toISOString(),
  };
}

/** Cierra de forma idempotente todas las fases cuyo fin ya pasó. */
export function closeDueN1Phases(
  experiment: N1Experiment,
  data: N1ExperimentData,
  now: Date = new Date(),
): N1Experiment {
  if (experiment.estado === 'completado') return experiment;
  let changed = false;
  const fases = experiment.fases.map((phase) => {
    if (phase.snapshot || new Date(phase.fin).getTime() > now.getTime()) return phase;
    changed = true;
    return { ...phase, snapshot: summarizeN1Phase(phase, data, now) };
  });
  if (!changed) return experiment;
  const completed = fases.every((phase) => phase.snapshot !== undefined);
  return {
    ...experiment,
    fases,
    estado: completed ? 'completado' : 'activo',
    ...(completed ? { completadoEn: now.toISOString() } : {}),
  };
}

export function currentN1Phase(experiment: N1Experiment): N1ExperimentPhase | null {
  return experiment.fases.find((phase) => phase.snapshot === undefined) ?? null;
}

export function targetDoseForPhase(experiment: N1Experiment, phase: N1ExperimentPhase): number {
  return (phase.condicion === 'A' ? experiment.dosisSemanalA : experiment.dosisSemanalB) * 2;
}

export type N1Comparison =
  | { status: 'insufficient'; gamesA: number; gamesB: number }
  | { status: 'comparable'; gamesA: number; gamesB: number; errorsA: number; errorsB: number; lowerErrors: 'A' | 'B' | 'igual' };

/** Comparación descriptiva agregada A vs. B; nunca declara causalidad. */
export function compareN1Conditions(experiment: N1Experiment): N1Comparison {
  const aggregate = (condition: 'A' | 'B') => {
    const snapshots = experiment.fases
      .filter((phase) => phase.condicion === condition)
      .map((phase) => phase.snapshot)
      .filter((snapshot): snapshot is N1PhaseSnapshot => snapshot !== undefined && snapshot.erroresGravesPorPartida !== null);
    const games = snapshots.reduce((sum, snapshot) => sum + snapshot.partidasAnalizadas, 0);
    const totalErrors = snapshots.reduce(
      (sum, snapshot) => sum + (snapshot.erroresGravesPorPartida as number) * snapshot.partidasAnalizadas,
      0,
    );
    return { games, errors: games > 0 ? totalErrors / games : null };
  };
  const a = aggregate('A');
  const b = aggregate('B');
  if (a.games < N1_MIN_GAMES_PER_CONDITION || b.games < N1_MIN_GAMES_PER_CONDITION || a.errors === null || b.errors === null) {
    return { status: 'insufficient', gamesA: a.games, gamesB: b.games };
  }
  const lowerErrors = Math.abs(a.errors - b.errors) < 0.05 ? 'igual' : a.errors < b.errors ? 'A' : 'B';
  return { status: 'comparable', gamesA: a.games, gamesB: b.games, errorsA: a.errors, errorsB: b.errors, lowerErrors };
}
