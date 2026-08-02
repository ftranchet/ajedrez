import { describe, expect, it } from 'vitest';
import { formatDecimal, formatDuracion, formatPeones, formatVentaja } from './format';

describe('formato numérico de interfaz', () => {
  it('usa coma rioplatense y conserva la precisión solicitada', () => {
    expect(formatDecimal(1.2, 2)).toBe('1,20');
    expect(formatDecimal(0.875, 1)).toBe('0,9');
  });
});

describe('formatDuracion', () => {
  it('por debajo del minuto muestra segundos', () => {
    expect(formatDuracion(45_000)).toBe('45 s');
    expect(formatDuracion(0)).toBe('0 s');
  });

  it('desde un minuto redondea a minutos: el tiempo es profundidad, no una marca', () => {
    expect(formatDuracion(60_000)).toBe('1 min');
    expect(formatDuracion(720_000)).toBe('12 min');
    expect(formatDuracion(100_000)).toBe('2 min'); // 1 min 40 s redondea a 2
  });

  it('no produce duraciones negativas', () => {
    expect(formatDuracion(-1000)).toBe('0 s');
  });
});

describe('formatVentaja', () => {
  it('muestra peones con un decimal y el signo de quién está mejor', () => {
    expect(formatVentaja(120)).toBe('+1,2');
    expect(formatVentaja(-80)).toBe('−0,8');
  });

  it('la igualdad es 0,0 y nunca "−0,0"', () => {
    expect(formatVentaja(0)).toBe('0,0');
    expect(formatVentaja(-4)).toBe('0,0');
    expect(formatVentaja(4)).toBe('0,0');
  });

  it('usa el menos tipográfico, el mismo de los símbolos de evaluación', () => {
    expect(formatVentaja(-250)).toBe('−2,5');
    expect(formatVentaja(-250)).not.toContain('-');
  });
});

describe('formatPeones', () => {
  // Lo que costó una jugada es una magnitud: "perdiste −2,5" es doble negación.
  it('no lleva signo: es cuánto costó, no una evaluación', () => {
    expect(formatPeones(250)).toBe('2,5');
    expect(formatPeones(-250)).toBe('2,5');
    expect(formatPeones(0)).toBe('0,0');
  });
});
