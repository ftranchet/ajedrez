// Fuerza del oponente local (RF-1.3): cómo se pide un nivel y cómo se elige la
// jugada cuando hay que bajar del piso del motor.
//
// **Historia de dos correcciones.** Primero los niveles usaban el `Skill Level`
// de Stockfish, que no es una curva de dificultad sino fuerza casi plena con
// errores aleatorios: el nivel 1 se sentía como el 5. Se pasó a
// `UCI_LimitStrength` + `UCI_Elo` con un mecanismo de imprecisión que elegía
// entre las cuatro mejores líneas del motor — y seguía sin alcanzar, porque
// **las cuatro mejores líneas de Stockfish son todas buenas**: elegir la
// segunda o la tercera no produce un rival débil, produce un rival un poco
// menos preciso. Encima el Elo que se mostraba en pantalla salía de una fórmula
// inventada, no de una medición, que es exactamente lo que este proyecto dice
// no hacer.
//
// Ahora la debilidad se controla con una **temperatura en centipeones** sobre
// una lista ancha de candidatas: cuanto más alta, más probable es que el motor
// juegue una jugada que pierde material. Es un parámetro con unidades, medible,
// y se calibra contra la métrica que la propia app usa para clasificar errores:
// el promedio de centipeones perdidos por jugada (`npm run measure:niveles`).
import type { EngineLevel } from './ports';

/** Rango que acepta `UCI_Elo` en Stockfish; fuera de él el motor ignora el valor. */
export const UCI_ELO_MIN = 1320;
export const UCI_ELO_MAX = 3190;

export function clampUciElo(elo: number): number {
  if (!Number.isFinite(elo)) return UCI_ELO_MIN;
  return Math.min(UCI_ELO_MAX, Math.max(UCI_ELO_MIN, Math.round(elo)));
}

/** Valor con el que se compara un mate contra una evaluación en centipeones. */
export const CP_MATE = 100_000;

export interface LineaCandidata {
  move: string;
  /** Centipeones desde la perspectiva de quien mueve; null si hay mate. */
  cp: number | null;
  /** Jugadas hasta el mate (positivo = a favor de quien mueve); null si no hay. */
  mateIn: number | null;
}

/** Puntaje comparable entre líneas, con el mate como extremo de la escala. */
export function puntajeComparable(linea: LineaCandidata): number {
  if (linea.mateIn !== null) return linea.mateIn > 0 ? CP_MATE : -CP_MATE;
  return linea.cp ?? 0;
}

/**
 * Elige qué línea juega el motor, muestreando entre las candidatas con peso
 * `exp(-pérdida / temperatura)`.
 *
 * Con temperatura 0 siempre juega la mejor. Con temperatura 100, una jugada que
 * pierde 100 centipeones tiene ~37% del peso de la mejor: sale seguido, pero no
 * siempre. Con 300, hasta una jugada que cuelga una pieza aparece de vez en
 * cuando — que es lo que hace un principiante y lo que el mecanismo anterior no
 * lograba nunca.
 *
 * La escala es la misma que usa `core/analysis.ts` para clasificar errores
 * (100 cp = "error", 200 = "error grave"), así que la temperatura se lee en la
 * misma unidad en la que el producto ya piensa.
 */
export function elegirJugadaPorTemperatura(
  lineas: LineaCandidata[],
  temperaturaCp: number,
  rng: () => number = Math.random,
): string | null {
  if (lineas.length === 0) return null;
  if (temperaturaCp <= 0 || lineas.length === 1) return lineas[0].move;

  const mejor = Math.max(...lineas.map(puntajeComparable));
  const pesos = lineas.map((linea) => Math.exp(-(mejor - puntajeComparable(linea)) / temperaturaCp));
  const total = pesos.reduce((suma, peso) => suma + peso, 0);
  if (!Number.isFinite(total) || total <= 0) return lineas[0].move;

  let dardo = rng() * total;
  for (let i = 0; i < lineas.length; i++) {
    dardo -= pesos[i];
    if (dardo <= 0) return lineas[i].move;
  }
  return lineas[lineas.length - 1].move;
}

/** Cuántas líneas hay que pedirle al motor para servir este nivel. */
export function multiPvParaNivel(level: Pick<EngineLevel, 'candidatas'>): number {
  return Math.max(1, level.candidatas ?? 1);
}
