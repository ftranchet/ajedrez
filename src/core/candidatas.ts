// Regla de candidatas (RF-5.8): en un subconjunto aleatorio de posiciones
// del Radar, tras la respuesta del usuario y antes de revelar, se pregunta
// "¿hay algo mejor?" y se permite cambiar la jugada. No mide si el usuario
// acertó de una — mide si, ante la duda, sabe reconocer cuándo conviene
// revisar y cuándo no.
import type { RadarItem } from './types';
import { clasificarRespuestaDobleSolucion } from './dobleSolucion';
import { esRespuestaCorrectaRadar } from './radar';

/** Mismo muestreo que la confianza declarada (RF-10.1): ~1 de cada 4-5, para no interrumpir cada posición. */
export function shouldSampleCandidata(rng: () => number = Math.random): boolean {
  return rng() < 1 / 4.5;
}

export type ResultadoCandidata = 'mejoro' | 'empeoro' | 'sin-cambio';

/** Mismo criterio de acierto que la resolución del Radar: en un ítem de doble
 * solución (RF-5.7) la familiar también acierta; en tranquilas, cualquier
 * jugada aceptable equivalente (RF-5.3). */
function esAcierto(item: RadarItem, jugada: string): boolean {
  if (item.dobleSolucion) return clasificarRespuestaDobleSolucion(item, jugada) !== 'otra';
  return esRespuestaCorrectaRadar(item, jugada);
}

/**
 * Compara la jugada original con la final tras la pregunta "¿hay algo
 * mejor?": si el acierto cambió de no a sí, mejoró; de sí a no, empeoró.
 * Si el acierto no cambió —incluso si la jugada sí cambió, por ejemplo entre
 * dos jugadas igualmente incorrectas, o entre la familiar y la superior de
 * un ítem de doble solución (ambas aciertos, RF-5.7)— cuenta como sin cambio.
 */
export function clasificarCambioCandidata(item: RadarItem, jugadaOriginal: string, jugadaFinal: string): ResultadoCandidata {
  const eraCorrecta = esAcierto(item, jugadaOriginal);
  const esCorrecta = esAcierto(item, jugadaFinal);
  if (eraCorrecta === esCorrecta) return 'sin-cambio';
  return esCorrecta ? 'mejoro' : 'empeoro';
}
