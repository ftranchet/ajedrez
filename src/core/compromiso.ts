// Cálculo comprometido (E7, RF-7.1): el usuario declara su línea completa
// (su jugada, la respuesta que espera, su continuación — 3 a 7 plies) antes
// de que el tablero se mueva. Se puntúa la línea entera, no solo la primera
// jugada. Reutiliza el catálogo del Radar (ya verificado con puzzles de
// Lichess CC0): cualquier ítem con una solución de 3 a 7 plies ya es una
// línea forzada verificada, sin necesidad de contenido nuevo.
import type { RadarItem } from './types';

const PROFUNDIDAD_MIN = 3;
const PROFUNDIDAD_MAX = 7;

export function esAptoParaCompromiso(item: RadarItem): boolean {
  return item.solucion.length >= PROFUNDIDAD_MIN && item.solucion.length <= PROFUNDIDAD_MAX;
}

export function itemsParaCompromiso(pool: RadarItem[]): RadarItem[] {
  return pool.filter(esAptoParaCompromiso);
}

export interface ResultadoCompromiso {
  correcta: boolean;
  /** Índice (0-based) de la primera jugada de la línea que no coincide con la solución; null si toda la línea es correcta. */
  primerErrorEn: number | null;
}

/** Compara la línea completa declarada contra la solución verificada del ítem. */
export function evaluarLinea(item: RadarItem, lineaIngresada: string[]): ResultadoCompromiso {
  for (let i = 0; i < item.solucion.length; i++) {
    if (lineaIngresada[i] !== item.solucion[i]) {
      return { correcta: false, primerErrorEn: i };
    }
  }
  return { correcta: true, primerErrorEn: null };
}
