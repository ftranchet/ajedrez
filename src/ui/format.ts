import { CP_MATE } from '../core/engineLevels';
import type { LecturaMomentoCritico } from '../core/analysis';
import type { VentajaDesperdiciada } from '../core/conversion';
import type { Color } from '../core/types';
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

/** Décimos de peón tal como los redondea `formatVentaja`. */
const decimosVisibles = (cp: number): number => Math.round((cp / 100) * 10);

/**
 * Lo que una jugada hizo con la ventaja de quien movió: la plantilla `costo`
 * dice el salto ("pasó de {antes} a {despues}") y lo que costó en {peones}.
 *
 * El costo se calcula con los mismos números que se muestran, no con
 * `cpPerdidos`. `cpPerdidos` sale de la escala acotada a ±`CP_TOPE` (diez
 * peones), que sirve para clasificar y ordenar, pero deja de cuadrar con el
 * salto apenas un extremo pasa de diez: "costó 11,0 peones: pasó de +12,4 a
 * −1,0" pide al lector una cuenta que da 13,4. Se resta en décimos ya
 * redondeados para que también el redondeo cierre. El costo va sin signo: es
 * una magnitud, y "perdiste −2,5" sería una doble negación.
 *
 * Con un mate en cualquiera de los dos extremos se usa `mate`, que no lleva
 * costo: el mate no tiene valor en peones, y nombrado ya dice qué se perdió.
 */
export function fraseSaltoVentaja(
  plantillas: { costo: string; mate: string },
  salto: { ventajaAntes: number; ventajaDespues: number },
): string {
  const plantilla = esMate(salto.ventajaAntes) || esMate(salto.ventajaDespues) ? plantillas.mate : plantillas.costo;
  const costoDecimos = Math.max(0, decimosVisibles(salto.ventajaAntes) - decimosVisibles(salto.ventajaDespues));
  return plantilla
    .replace('{antes}', formatVentaja(salto.ventajaAntes))
    .replace('{despues}', formatVentaja(salto.ventajaDespues))
    .replace('{peones}', formatDecimal(costoDecimos / 10, 1));
}

/**
 * La frase del salto en la lectura del momento crítico, contada desde el lado
 * que corresponde.
 *
 * El vuelco de la partida puede ser una jugada del rival, y `lectura` trae las
 * ventajas desde el lado de quien movió: dichas como propias, "pasó de mate a
 * favor a −5,0" le hacía creer al usuario que él había tenido el mate que en
 * realidad desperdició su rival. Si la jugada fue del rival se dice así, con
 * la evaluación desde el lado del usuario y sin costo. Si no se sabe con qué
 * color jugó (partidas viejas), se nombra el bando y se aclara que la
 * evaluación es desde su lado.
 */
export function fraseLecturaMomento(lectura: LecturaMomentoCritico, jugadorColor: Color | undefined): string {
  const salto = fraseSaltoVentaja({ costo: t.analisis.momentoLecturaCosto, mate: t.analisis.momentoLecturaMate }, lectura);
  if (jugadorColor === undefined) {
    const lado = lectura.ladoQueMueve === 'w' ? t.analisis.ladoBlancas : t.analisis.ladoNegras;
    return `${t.analisis.momentoLecturaLado.replace('{lado}', lado)} ${salto}`;
  }
  if (lectura.ladoQueMueve === jugadorColor) return salto;
  return t.analisis.momentoLecturaRival
    .replace('{antes}', formatVentaja(-lectura.ventajaAntes))
    .replace('{despues}', formatVentaja(-lectura.ventajaDespues));
}

/**
 * La ventaja desperdiciada, en una línea. Un mate desperdiciado es justo la
 * ventaja más clara que se puede tirar, y su centinela dividido por cien salía
 * como "Ventaja de +1000,0" (RNF-10): el mate se nombra en vez de contarse.
 */
export function textoVentajaDesperdiciada(ventaja: Pick<VentajaDesperdiciada, 'ply' | 'ventajaCp'>): string {
  const jugada = String(Math.floor(ventaja.ply / 2) + 1);
  if (esMate(ventaja.ventajaCp)) return t.conversion.listaMate.replace('{jugada}', jugada);
  return t.conversion.listaVentaja.replace('{ventaja}', formatDecimal(ventaja.ventajaCp / 100, 1)).replace('{jugada}', jugada);
}

/** Duración legible de un ejercicio ("45 s", "3 min", "12 min"). Redondea a
 * minutos enteros salvo por debajo del minuto: la precisión al segundo sugiere
 * una carrera, y acá el tiempo es una señal de profundidad, no una marca. */
export function formatDuracion(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  if (segundos < 60) return `${segundos} s`;
  return `${Math.round(segundos / 60)} min`;
}
