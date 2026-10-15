import { CP_MATE } from '../core/engineLevels';
import { t } from './i18n/es';

const decimalFormatters = new Map<number, Intl.NumberFormat>();

/** Formato numérico visible de la interfaz rioplatense. Fija la cantidad de
 * decimales para que una métrica conserve ancho y usa coma en vez del punto
 * técnico de JavaScript. */
export function formatDecimal(value: number, digits: number): string {
  let formatter = decimalFormatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-AR', {
      useGrouping: false,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    decimalFormatters.set(digits, formatter);
  }
  return formatter.format(value);
}

/**
 * ¿Esta evaluación es un mate? El análisis lo codifica como ±`CP_MATE`
 * centipeones (`gameAnalyzer.ts`): un centinela para ordenar y saber quién
 * gana, no una cantidad de peones. Se compara contra `CP_MATE` y no contra
 * `CP_TOPE` porque +15 es una ventaja enorme pero real, y llamarla mate sería
 * afirmar algo que el motor no dijo.
 */
export function esMate(cp: number): boolean {
  return Math.abs(cp) >= CP_MATE;
}

/**
 * Una evaluación, como la lee un ajedrecista: **peones con un decimal y signo**.
 *
 * El centipeón es la unidad del motor, no la del usuario — "perdiste 250
 * centipeones" obliga a dividir por cien mentalmente para llegar a algo que se
 * siente ("dos peones y medio"). La convención de toda la literatura y de
 * cualquier interfaz de análisis es el peón con un decimal, y el signo dice de
 * quién es la ventaja: `+1,2` a favor de quien se toma como referencia, `−0,8`
 * en contra, `0,0` igualada. Se usa el menos tipográfico (−), el mismo de los
 * símbolos de evaluación de la app, no el guion del teclado.
 *
 * El mate se nombra con las mismas dos palabras que el signo ("mate a favor",
 * "mate en contra"): dividido por cien, el centinela salía como "+1000,0", una
 * ventaja que no existe en ningún tablero (auditoría 2026-10-15, B7).
 */
export function formatVentaja(cp: number): string {
  if (esMate(cp)) return cp > 0 ? t.evaluacion.mateAFavor : t.evaluacion.mateEnContra;
  const peones = cp / 100;
  // -0,04 formatea como "0,0": sin esto saldría "−0,0", que no significa nada.
  const redondeado = Math.round(peones * 10) / 10;
  if (redondeado === 0) return formatDecimal(0, 1);
  const signo = redondeado > 0 ? '+' : '−';
  return `${signo}${formatDecimal(Math.abs(redondeado), 1)}`;
}

/**
 * Lo que **costó** una jugada, en peones. Va sin signo a propósito: es una
 * magnitud, no una evaluación. "Perdiste −2,5" es una doble negación, y el
 * lector tiene que deshacerla para entender que perdió dos peones y medio.
 */
export function formatPeones(cp: number): string {
  return formatDecimal(Math.abs(cp) / 100, 1);
}

/**
 * Lo que una jugada hizo con la ventaja de quien movió: la plantilla `costo`
 * dice el salto ("pasó de {antes} a {despues}") y lo que costó en {peones}.
 *
 * Con un mate en cualquiera de los dos extremos se usa `mate`, que no lleva
 * costo. `cpPerdidos` sale de la escala acotada a ±`CP_TOPE`, donde el mate
 * vale diez peones: "pasó de mate a favor a +5,0 — te costó 5,0 peones" o "de
 * +2,0 a mate en contra — te costó 12,0 peones" son cifras de esa convención,
 * que el lector no puede reconstruir a partir del salto que ve. Con el mate
 * nombrado, el salto ya dice qué se perdió.
 */
export function fraseSaltoVentaja(
  plantillas: { costo: string; mate: string },
  salto: { ventajaAntes: number; ventajaDespues: number; cpPerdidos: number },
): string {
  const plantilla = esMate(salto.ventajaAntes) || esMate(salto.ventajaDespues) ? plantillas.mate : plantillas.costo;
  return plantilla
    .replace('{antes}', formatVentaja(salto.ventajaAntes))
    .replace('{despues}', formatVentaja(salto.ventajaDespues))
    .replace('{peones}', formatPeones(salto.cpPerdidos));
}

/** Duración legible de un ejercicio ("45 s", "3 min", "12 min"). Redondea a
 * minutos enteros salvo por debajo del minuto: la precisión al segundo sugiere
 * una carrera, y acá el tiempo es una señal de profundidad, no una marca. */
export function formatDuracion(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  if (segundos < 60) return `${segundos} s`;
  return `${Math.round(segundos / 60)} min`;
}
