// Oponentes humano-realistas: bots Maia de Lichess (E1/RF-1.4, ADR-0004).
//
// Maia es la única familia de modelos con errores humano-plausibles
// documentados: no juega perfecto y de golpe regala, que es lo que hace
// Stockfish capado. Por eso el PRD la quiere como rival de sparring y como
// defensora en la conversión de ventajas.
//
// Este archivo es dominio puro: qué bots hay, cuál corresponde a cada banda y
// cómo se interpreta el estado de una partida de Lichess. El adaptador HTTP
// vive en `services/lichess/` (CONTRIBUTING regla 4: core no hace fetch).
import type { BandaElo, Color, Resultado } from './types';

export interface BotMaia {
  /** Usuario del bot en Lichess. */
  usuario: string;
  /** Elo aproximado del modelo, según el proyecto Maia. */
  elo: number;
}

/** Los tres modelos publicados como bots (ADR-0004): ~1100 / 1500 / 1900. */
export const BOTS_MAIA: BotMaia[] = [
  { usuario: 'maia1', elo: 1100 },
  { usuario: 'maia5', elo: 1500 },
  { usuario: 'maia9', elo: 1900 },
];

/**
 * Bot sugerido para una banda del diagnóstico. Se apunta a un rival parejo o
 * apenas superior: la evidencia del proyecto pide partidas que se puedan
 * analizar, no palizas en ninguna de las dos direcciones.
 */
export function botParaBanda(banda: BandaElo): BotMaia {
  if (banda === 'principiante' || banda === 'elemental') return BOTS_MAIA[0];
  if (banda === 'intermedio') return BOTS_MAIA[1];
  return BOTS_MAIA[2];
}

/**
 * Control de tiempo del desafío.
 *
 * ELOmax se juega sin reloj (E9), pero **Lichess exige uno**: su interfaz de
 * programación acepta partidas con reloj o por correspondencia, no sin tiempo.
 * La opción por defecto es la más larga que sigue entrando en una sentada, para
 * que la partida se pueda analizar enseguida —que es el punto del ciclo— sin
 * convertirla en una carrera. La incoherencia es de la plataforma, no del
 * producto, y la interfaz lo dice en vez de esconderlo.
 */
export interface ControlDeTiempo {
  /** Minutos iniciales por jugador. */
  minutos: number;
  /** Incremento en segundos por jugada. */
  incremento: number;
}

export const CONTROL_LENTO: ControlDeTiempo = { minutos: 30, incremento: 20 };

/** Los estados de Lichess que significan "la partida sigue". */
const ESTADOS_EN_CURSO = new Set(['created', 'started']);

export function partidaEnCurso(status: string): boolean {
  return ESTADOS_EN_CURSO.has(status);
}

/** Color que juega el usuario, a partir del `gameFull` de la interfaz de Lichess. */
export function colorDelUsuario(
  jugadores: { white?: { id?: string }; black?: { id?: string } },
  usuario: string,
): Color | null {
  const id = usuario.toLowerCase();
  if (jugadores.white?.id?.toLowerCase() === id) return 'w';
  if (jugadores.black?.id?.toLowerCase() === id) return 'b';
  return null;
}

/**
 * ¿Le toca mover al usuario? Se deduce de la cantidad de jugadas del estado:
 * par significa que mueven las blancas. Lichess manda la lista entera en cada
 * actualización, así que esta es la fuente de verdad y no hace falta llevar un
 * turno propio que se pueda desincronizar.
 */
export function esTurnoDelUsuario(movesUci: string, color: Color): boolean {
  const jugadas = movesUci.trim() === '' ? 0 : movesUci.trim().split(/\s+/).length;
  return (jugadas % 2 === 0) === (color === 'w');
}

/** Lista de jugadas UCI del estado de Lichess, que las manda en una sola cadena. */
export function jugadasDeEstado(movesUci: string): string[] {
  return movesUci.trim() === '' ? [] : movesUci.trim().split(/\s+/);
}

/** Traduce el desenlace de Lichess al resultado en notación PGN. */
export function resultadoDesdeLichess(status: string, winner?: 'white' | 'black'): Resultado {
  if (partidaEnCurso(status)) return '*';
  if (winner === 'white') return '1-0';
  if (winner === 'black') return '0-1';
  // draw, stalemate, timeout sin ganador, aborted… Lichess solo manda `winner`
  // cuando hay uno; sin él, la partida no la ganó nadie.
  return status === 'aborted' ? '*' : '1/2-1/2';
}

/**
 * Motivos por los que una partida contra Maia puede no arrancar. Se enumeran
 * para poder explicarlos: "no se pudo" a secas deja al usuario sin saber si el
 * problema es su token, el bot o su conexión — y con un rival que corre en un
 * servidor ajeno, "el bot está ocupado" es un desenlace normal, no un error.
 */
export type FalloMaia =
  | 'sin-token'
  | 'token-invalido'
  | 'sin-permisos'
  | 'bot-no-disponible'
  | 'limite-de-tasa'
  | 'sin-conexion'
  | 'desconocido';

/** Traduce el código de estado de una respuesta a un motivo explicable. */
export function falloDesdeEstadoHttp(status: number): FalloMaia {
  if (status === 401) return 'token-invalido';
  if (status === 403) return 'sin-permisos';
  if (status === 404) return 'bot-no-disponible';
  if (status === 429) return 'limite-de-tasa';
  return 'desconocido';
}
