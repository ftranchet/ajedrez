// Partida lenta programada (RF-11.7, evidencia tier-S): jugar y analizar
// partidas lentas es el ejercicio de mayor valor, así que se vuelve un
// compromiso semanal visible en Hoy —no una sugerencia suelta—. Estado de la
// semana calendario local (lunes a domingo, igual que el plan de adherencia).
import type { GameRecord, Ritmo } from './types';
import { plyCountFromPgn } from './game';

export type SlowGameWeekStatus = 'sin-jugar' | 'sin-analizar' | 'completa';

/** Ritmos que cuentan como "partida lenta" para el compromiso (se excluye bullet/blitz). */
const RITMOS_LENTOS: Ritmo[] = ['rapida', 'clasica', 'sin-reloj'];

/**
 * El compromiso semanal es una partida que el usuario **decide** jugar. Las dos
 * partidas del diagnóstico inicial (RF-11.4) se juegan sin reloj y con el mismo
 * motor de partidas que la pantalla Jugar, así que entraban acá y daban el
 * compromiso por cumplido apenas terminaba el diagnóstico: Hoy anunciaba "tu
 * partida lenta de la semana ya está jugada" (o directamente "jugada y
 * analizada", si el usuario analizaba una de ellas desde el Panel) sin que el
 * usuario hubiera jugado ninguna partida propia. Siguen siendo partidas suyas y
 * cuentan para las métricas de verdad; lo que no hacen es cumplir el
 * compromiso en su lugar.
 */
/**
 * Jugadas mínimas para que una partida cuente como "partida lenta". Rendirse en
 * la jugada 4 produce una partida real —y se guarda como derrota, con razón—,
 * pero no es el ejercicio que el compromiso semanal pide. Diez jugadas por lado
 * es un piso bajo: cualquier partida que valga la pena analizar lo supera.
 */
const JUGADAS_MINIMAS_COMPROMISO = 20;

function cuentaParaElCompromiso(game: GameRecord): boolean {
  return (
    game.contexto === undefined &&
    RITMOS_LENTOS.includes(game.ritmo) &&
    plyCountFromPgn(game.pgn) >= JUGADAS_MINIMAS_COMPROMISO
  );
}

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
    return Number.isFinite(t) && t >= inicio && t <= hasta && cuentaParaElCompromiso(game);
  });
  if (lentasDeLaSemana.length === 0) return 'sin-jugar';
  if (lentasDeLaSemana.some((game) => game.analizada)) return 'completa';
  return 'sin-analizar';
}
