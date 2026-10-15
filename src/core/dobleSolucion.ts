// Doble solución (RF-5.7, subtipo anti-Einstellung del Radar E5): sobre un
// ítem con `dobleSolucion`, encontrar la jugada superior puntúa igual que
// cualquier acierto del Radar; conformarse con la familiar (que también
// gana, pero es objetivamente peor) no genera una tarjeta de error — no fue
// un fallo — pero se registra aparte para medir la tasa de conformismo.
import type { RadarItem, ResultadoDobleSolucion } from './types';
import { aNotacion, type IdiomaNotacion } from './notacion';
import { analizarSolucion } from './radarExplicacion';

export function clasificarRespuestaDobleSolucion(item: RadarItem, jugadaUsuario: string): ResultadoDobleSolucion {
  if (jugadaUsuario === item.solucion[0]) return 'superior';
  if (item.dobleSolucion && jugadaUsuario === item.dobleSolucion.familiar) return 'familiar';
  return 'otra';
}

/** Proporción de respuestas "familiar" sobre el total de superior+familiar; null sin datos relevantes. */
export function tasaConformismo(resultados: ResultadoDobleSolucion[]): number | null {
  const relevantes = resultados.filter((r) => r === 'superior' || r === 'familiar');
  if (relevantes.length === 0) return null;
  return relevantes.filter((r) => r === 'familiar').length / relevantes.length;
}

/**
 * Feedback cuando el usuario se conformó con la familiar: no fue un error, pero
 * había algo mejor.
 *
 * La jugada superior se nombra en algebraica del idioma elegido (RNF-9). Antes
 * se imprimía `item.solucion[0]` tal cual, que es UCI ("d5c6"): el formato con
 * el que se le habla al motor, no notación de ajedrez, justo en el texto que
 * tiene que enseñar cuál era la jugada. Si la solución no se puede reproducir
 * desde el FEN, se omite la jugada antes que volver a mostrar UCI.
 */
export function feedbackConformismo(item: RadarItem, idioma: IdiomaNotacion): string {
  // analizarSolucion devuelve SAN inglés (dato): se traduce acá, al componer.
  const superior: string | undefined = analizarSolucion(item).lineaSan[0];
  const cual = superior === undefined ? '' : `: ${aNotacion(superior, idioma)}`;
  return `Tu jugada funciona, pero había una superior${cual}. No es un error — es la trampa del "ya vi algo que funciona" (Einstellung).`;
}
