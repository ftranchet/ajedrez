// Ritmo y relojes de un PGN importado (RF-2.2, RF-2.4, RF-7.2).
//
// Las partidas jugadas en la app ya no se cronometran (RF-1.5): los tiempos
// por jugada solo pueden venir de un reloj real, y los PGN de Lichess y
// Chess.com suelen traerlo escrito. El encabezado `TimeControl` dice el
// ritmo, y el comentario `[%clk h:mm:ss]` de cada jugada dice cuánto le
// quedaba al que movió. De ahí sale lo que tardó cada jugada, que es lo que
// necesita el ejercicio de cálculo para caer en "donde consumiste más tiempo"
// (RF-7.2).
//
// Dominio puro: recibe texto, devuelve números.
import type { Ritmo } from './types';

export interface TimeControlLeido {
  ritmo: Ritmo;
  /**
   * Incremento por jugada en milisegundos, solo cuando el ritmo es un único
   * tramo a finish (`base` o `base+incremento`, el formato de Lichess y
   * Chess.com). Es el único caso en que "reloj anterior − reloj actual +
   * incremento" es lo que tardó la jugada: con jugadas por período
   * (`40/5400:1800`, `1/86400` de las diarias) el reloj se recarga y la resta
   * da cualquier cosa. Null ahí y cuando no hay reloj.
   */
  incrementoMs: number | null;
}

// Umbrales de Lichess sobre la duración estimada `base + 40 × incremento`, en
// segundos: hasta 179 bullet (incluye ultrabullet), hasta 479 blitz, hasta
// 1499 rápida. De ahí para arriba es clásica; la correspondencia de Lichess
// (desde 21600) no tiene categoría propia acá y también es lenta.
const LIMITE_BULLET_S = 180;
const LIMITE_BLITZ_S = 480;
const LIMITE_RAPIDA_S = 1500;
const JUGADAS_ESTIMADAS = 40;

function ritmoPorDuracion(segundos: number): Ritmo {
  if (segundos < LIMITE_BULLET_S) return 'bullet';
  if (segundos < LIMITE_BLITZ_S) return 'blitz';
  if (segundos < LIMITE_RAPIDA_S) return 'rapida';
  return 'clasica';
}

// Un tramo del estándar PGN: `[jugadas/]segundos[+incremento]`.
const TRAMO = /^(?:(\d+)\/)?(\d+(?:\.\d+)?)(?:\+(\d+(?:\.\d+)?))?$/;

/**
 * Lee el encabezado `TimeControl`. `-` es "sin control de tiempo" según el
 * estándar; `?`, el reloj de arena (`*180`) o cualquier otra cosa devuelven
 * null: mejor no prellenar que adivinar. Con varios tramos (`40/7200:3600`) el
 * ritmo sale del primero, que es el que define la partida.
 */
export function leerTimeControl(raw: string | undefined): TimeControlLeido | null {
  const valor = raw?.trim();
  if (!valor) return null;
  if (valor === '-') return { ritmo: 'sin-reloj', incrementoMs: null };
  const tramos = valor.split(':');
  const primero = tramos[0].match(TRAMO);
  if (!primero || !tramos.slice(1).every((tramo) => TRAMO.test(tramo))) return null;
  const [, jugadas, base, incremento] = primero;
  const baseS = Number(base);
  const incrementoS = incremento === undefined ? 0 : Number(incremento);
  // `0+1` existe en Lichess (base cero, un segundo por jugada); `0` solo, no.
  if (baseS + incrementoS <= 0) return null;
  const aFinish = jugadas === undefined && tramos.length === 1;
  return {
    ritmo: ritmoPorDuracion(baseS + JUGADAS_ESTIMADAS * incrementoS),
    incrementoMs: aFinish ? Math.round(incrementoS * 1000) : null,
  };
}

const RELOJ = /\[%clk\s+(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)\s*\]/;

/** Milisegundos que marca el `[%clk h:mm:ss]` de un comentario, o null si no trae. */
export function leerReloj(comentario: string): number | null {
  const match = comentario.match(RELOJ);
  if (!match) return null;
  const [, horas, minutos, segundos] = match;
  return Math.round(((Number(horas) * 60 + Number(minutos)) * 60 + Number(segundos)) * 1000);
}

/**
 * Lo que tardó cada media jugada, con el índice de `MoveAnalysisEntry.ply`
 * (desde 0): reloj anterior del mismo bando − reloj actual + incremento.
 *
 * 0 es "sin dato": la primera jugada de cada bando no tiene reloj previo
 * contra el cual restar, una jugada sin `[%clk]` tampoco, y una resta negativa
 * (el rival le regaló tiempo) no dice cuánto pensó. Si ninguna jugada queda
 * con dato, devuelve `[]`, igual que una partida sin relojes.
 */
export function tiemposDesdeRelojes(relojesMs: readonly (number | null)[], incrementoMs: number): number[] {
  const tiempos = relojesMs.map((actual, ply) => {
    const anterior = ply >= 2 ? relojesMs[ply - 2] : null;
    if (actual === null || anterior === null || anterior === undefined) return 0;
    return Math.max(0, anterior - actual + incrementoMs);
  });
  return tiempos.some((tiempo) => tiempo > 0) ? tiempos : [];
}
