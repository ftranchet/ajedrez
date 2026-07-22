import { describe, expect, it } from 'vitest';
import { formatDecimal } from './format';

describe('formato numérico de interfaz', () => {
  it('usa coma rioplatense y conserva la precisión solicitada', () => {
    expect(formatDecimal(1.2, 2)).toBe('1,20');
    expect(formatDecimal(0.875, 1)).toBe('0,9');
  });
});
