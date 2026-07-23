// Partida lenta programada (RF-11.7, evidencia tier-S): jugar y analizar
// partidas lentas es el ejercicio de mayor valor, así que se vuelve un
// compromiso semanal visible en Hoy —no una sugerencia suelta—. Estado de la
// semana calendario local (lunes a domingo, igual que el plan de adherencia).
import type { GameRecord, Ritmo } from './types';

export type SlowGameWeekStatus = 'sin-jugar' | 'sin-analizar' | 'completa';

/** Ritmos que cuentan como "partida lenta" para el compromiso (se excluye bullet/blitz). */
const RITMOS_LENTOS: Ritmo[] = ['rapida', 'clasica', 'sin-reloj'];

function startOfLocalWeek(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/**
 * ¿Cómo viene la partida lenta de esta semana? Sin jugar ninguna, jugada pero
 * sin analizar (falta cerrar el círculo), o completa (jugada y analizada).
 */
export function partidaLentaSemanal(games: GameRecord[], now: Date = new Date()): SlowGameWeekStatus {
  const inicio = startOfLocalWeek(now).getTime();
  const hasta = now.getTime();
  const lentasDeLaSemana = games.filter((game) => {
    const t = new Date(game.fecha).getTime();
    return Number.isFinite(t) && t >= inicio && t <= hasta && RITMOS_LENTOS.includes(game.ritmo);
  });
  if (lentasDeLaSemana.length === 0) return 'sin-jugar';
  if (lentasDeLaSemana.some((game) => game.analizada)) return 'completa';
  return 'sin-analizar';
}
