// Fuerza del oponente local (RF-1.3): cómo se pide un nivel y cómo se elige la
// jugada cuando hay que bajar del piso del motor.
//
// **Por qué existe este archivo.** Los niveles se implementaban con el `Skill
// Level` de Stockfish (0–20), y eso no es una curva de dificultad: Skill Level
// juega casi a fuerza plena y le inyecta errores aleatorios, con un piso de
// ~1350 Elo. Sumado a presupuestos de 250–1000 ms —que ya limitan la
// profundidad por sí solos—, la diferencia entre el nivel más bajo y el más
// alto quedaba dentro del ruido: el nivel 1 se sentía como el 5 y a veces peor,
// porque a veces el 5 tenía la suerte de errar y el 1 no. Nadie lo había
// medido nunca; los nombres ("da sus primeros pasos") eran una promesa que el
// config no cumplía.
//
// Ahora se usa el mecanismo que Stockfish expone para esto: `UCI_LimitStrength`
// + `UCI_Elo`, que el motor calibra contra su propia escala. Su piso duro es
// 1320, por debajo del cual la persona objetivo del PRD (900–1900) todavía
// necesita rival, así que los niveles más bajos agregan **imprecisión
// declarada**: a veces juegan la segunda o tercera mejor línea en vez de la
// primera. Es la misma idea que Skill Level, pero con un parámetro que se puede
// medir y ajustar (`scripts/measure-engine-levels.mjs`).
import type { EngineLevel } from './ports';

/** Rango que acepta `UCI_Elo` en Stockfish; fuera de él el motor ignora el valor. */
export const UCI_ELO_MIN = 1320;
export const UCI_ELO_MAX = 3190;

export function clampUciElo(elo: number): number {
  if (!Number.isFinite(elo)) return UCI_ELO_MIN;
  return Math.min(UCI_ELO_MAX, Math.max(UCI_ELO_MIN, Math.round(elo)));
}

/** Cuántas líneas se piden cuando el nivel juega con imprecisión. */
export const CANDIDATAS_IMPRECISION = 4;

/**
 * Elige qué línea juega el motor. Con `imprecision` en 0 siempre juega la
 * mejor; con 0,4 juega una de las alternativas cuatro de cada diez veces.
 *
 * Se elige entre las alternativas del propio motor y no entre jugadas legales
 * al azar a propósito: un rival que de golpe cuelga una dama no enseña nada y
 * no se parece a nadie. Las líneas 2 a 4 de Stockfish son jugadas plausibles
 * pero peores, que es como se equivoca alguien de carne y hueso.
 */
export function elegirJugadaConImprecision(
  jugadas: string[],
  imprecision: number,
  rng: () => number = Math.random,
): string | null {
  if (jugadas.length === 0) return null;
  const alternativas = jugadas.slice(1);
  if (imprecision <= 0 || alternativas.length === 0) return jugadas[0];
  if (rng() >= Math.min(1, imprecision)) return jugadas[0];
  const indice = Math.min(alternativas.length - 1, Math.floor(rng() * alternativas.length));
  return alternativas[indice];
}

/** Cuántas líneas hay que pedirle al motor para servir este nivel. */
export function multiPvParaNivel(level: Pick<EngineLevel, 'imprecision'>): number {
  return (level.imprecision ?? 0) > 0 ? CANDIDATAS_IMPRECISION : 1;
}

/**
 * Elo aproximado que representa un nivel, para poder nombrarlo con un número
 * en vez de un adjetivo. Cuando hay imprecisión, el nivel juega por debajo del
 * Elo que se le pide al motor, así que se descuenta: es una estimación, y la
 * interfaz debe decir que lo es.
 */
export function eloAproximado(level: Pick<EngineLevel, 'uciElo' | 'imprecision'>): number {
  const penalizacion = Math.round((level.imprecision ?? 0) * 900);
  return Math.max(400, clampUciElo(level.uciElo) - penalizacion);
}
