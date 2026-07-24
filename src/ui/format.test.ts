import { describe, expect, it } from 'vitest';
import { formatDecimal, formatDuracion } from './format';

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
