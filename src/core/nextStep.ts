// "Para seguir mejorando" (RF-11.7, evidencia tier-S): el bucle partidas →
// análisis es la palanca de mayor valor documentada, y "Tu sesión de hoy" debe
// hacerlo explícito en vez de dejarlo a la fuerza de voluntad. Esta función pura
// decide el próximo paso real a partir de las partidas del usuario, para
// conectar Hoy con Jugar/Análisis.
import type { GameRecord } from './types';
import { plyCountFromPgn } from './game';

export type NextStepKind = 'jugar-primera' | 'analizar' | 'jugar' | 'al-dia';

export interface NextStepRecomendacion {
  kind: NextStepKind;
  /** Días desde la última partida (solo cuando kind === 'jugar'). */
  dias?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DIAS_SIN_JUGAR = 3;

/**
 * Prioridad: sin partidas → jugar la primera; hay una sin analizar → analizarla
 * (ahí salen los repasos); pasaron varios días sin jugar lento → volver a jugar;
 * si no, al día (seguir el círculo).
 */
export function recomendarProximoPaso(games: GameRecord[], now: Date = new Date()): NextStepRecomendacion {
  if (games.length === 0) return { kind: 'jugar-primera' };

  const haySinAnalizar = games.some((g) => !g.analizada && plyCountFromPgn(g.pgn) > 0);
  if (haySinAnalizar) return { kind: 'analizar' };

  const fechas = games.map((g) => new Date(g.fecha).getTime()).filter((t) => Number.isFinite(t));
  if (fechas.length > 0) {
    const dias = Math.floor((now.getTime() - Math.max(...fechas)) / DAY_MS);
    if (dias >= DIAS_SIN_JUGAR) return { kind: 'jugar', dias };
  }
  return { kind: 'al-dia' };
}
