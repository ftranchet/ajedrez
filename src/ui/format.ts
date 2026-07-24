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

/** Duración legible de un ejercicio ("45 s", "3 min", "12 min"). Redondea a
 * minutos enteros salvo por debajo del minuto: la precisión al segundo sugiere
 * una carrera, y acá el tiempo es una señal de profundidad, no una marca. */
export function formatDuracion(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  if (segundos < 60) return `${segundos} s`;
  return `${Math.round(segundos / 60)} min`;
}
