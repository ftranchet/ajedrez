// Panel de verdad v1 (RF-12.1): media móvil de errores graves por partida
// analizada, a partir de datos que E3 ya produce. La "rating de partidas
// lentas" numérica que pide el PRD necesita un historial real (Lichess/
// Chess.com, bloqueado por red en este entorno — ver docs/roadmap.md) para
// calibrarse con sentido; mientras tanto se muestra la banda de Elo del
// diagnóstico (E11), categórica, en vez de inventar un número sin base.
import type { GameRecord } from './types';

const VENTANA_PARTIDAS = 10;

function erroresGraves(game: GameRecord): number {
  if (!game.analisis) return 0;
  return game.analisis.jugadas.filter((j) => j.clasificacion === 'grave' || j.clasificacion === 'error').length;
}

/**
 * Media móvil de errores graves/error por partida, sobre las últimas
 * `ventana` partidas analizadas (más recientes primero por `fecha`). Null
 * si todavía no hay ninguna analizada.
 */
export function erroresGravesPorPartidaMediaMovil(games: GameRecord[], ventana: number = VENTANA_PARTIDAS): number | null {
  const analizadas = games
    .filter((g) => g.analisis)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, ventana);
  if (analizadas.length === 0) return null;
  const total = analizadas.reduce((sum, g) => sum + erroresGraves(g), 0);
  return total / analizadas.length;
}
