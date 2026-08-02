// Anotaciones del usuario sobre el tablero: flechas y círculos que se dibujan
// para pensar (RF-5.10). Son las marcas de "si voy acá, responde allá" que
// cualquiera hace con el dedo sobre un tablero real, y que en Lichess y
// chess.com se hacen con el botón derecho.
//
// Este módulo es solo la regla de qué pasa al dibujar una marca que ya existe.
// Replica la semántica de chessground —volver a dibujar la misma flecha la
// borra, y hacerlo con otro color la repinta— para que el camino táctil, que
// se implementa a mano porque chessground solo escucha el mouse, se comporte
// exactamente igual que el del botón derecho. Dos gestos con la misma
// intención tienen que dar el mismo resultado.
//
// Es dominio puro: no sabe de chessground ni del DOM.

/** Colores disponibles, en el orden en que los ofrece el selector táctil. */
export const COLORES_ANOTACION = ['green', 'red', 'blue', 'yellow'] as const;

export type ColorAnotacion = (typeof COLORES_ANOTACION)[number];

/**
 * Una marca. Sin `dest` es un círculo sobre `orig`; con `dest`, una flecha de
 * `orig` a `dest`. Es la forma que espera chessground (`DrawShape`), acotada a
 * lo que la app usa.
 */
export interface Anotacion {
  orig: string;
  dest?: string;
  brush: ColorAnotacion;
}

const misma = (a: Anotacion, b: Anotacion): boolean => a.orig === b.orig && a.dest === b.dest;

/**
 * Aplica una marca nueva sobre las existentes:
 *
 * - si no había ninguna igual, se agrega;
 * - si había una igual **del mismo color**, se borra (volver a marcar lo mismo
 *   es la forma natural de deshacer, sin botón de por medio);
 * - si había una igual **de otro color**, se repinta con el nuevo.
 */
export function alternarAnotacion(shapes: readonly Anotacion[], nueva: Anotacion): Anotacion[] {
  const existente = shapes.find((s) => misma(s, nueva));
  const resto = shapes.filter((s) => !misma(s, nueva));
  if (existente && existente.brush === nueva.brush) return resto;
  return [...resto, nueva];
}
