// Regla de candidatas (RF-5.8): en un subconjunto aleatorio de posiciones
// del Radar, tras la respuesta del usuario y antes de revelar, se pregunta
// "¿hay algo mejor?" y se permite cambiar la jugada. No mide si el usuario
// acertó de una — mide si, ante la duda, sabe reconocer cuándo conviene
// revisar y cuándo no.
import type { RadarItem } from './types';

/** Mismo muestreo que la confianza declarada (RF-10.1): ~1 de cada 4-5, para no interrumpir cada posición. */
export function shouldSampleCandidata(rng: () => number = Math.random): boolean {
  return rng() < 1 / 4.5;
}

export type ResultadoCandidata = 'mejoro' | 'empeoro' | 'sin-cambio';

/**
 * Compara la jugada original con la final tras la pregunta "¿hay algo
 * mejor?": si el acierto cambió de no a sí, mejoró; de sí a no, empeoró.
 * Si el acierto no cambió —incluso si la jugada sí cambió, por ejemplo entre
 * dos jugadas igualmente incorrectas— cuenta como sin cambio.
 */
export function clasificarCambioCandidata(item: RadarItem, jugadaOriginal: string, jugadaFinal: string): ResultadoCandidata {
  const eraCorrecta = jugadaOriginal === item.solucion[0];
  const esCorrecta = jugadaFinal === item.solucion[0];
  if (eraCorrecta === esCorrecta) return 'sin-cambio';
  return esCorrecta ? 'mejoro' : 'empeoro';
}
