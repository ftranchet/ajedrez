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
