import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDER, isValidReminder, nextReminderAt, normalizeReminder } from './reminder';

describe('reminder config (RF-13.3)', () => {
  it('está apagado por defecto', () => {
    expect(DEFAULT_REMINDER.activo).toBe(false);
  });

  it('valida la forma y la hora HH:MM', () => {
    expect(isValidReminder({ activo: true, hora: '19:00' })).toBe(true);
    expect(isValidReminder({ activo: false, hora: '07:30' })).toBe(true);
    expect(isValidReminder({ activo: true, hora: '24:00' })).toBe(false);
    expect(isValidReminder({ activo: true, hora: '9:00' })).toBe(false);
    expect(isValidReminder({ activo: true, hora: '19:60' })).toBe(false);
    expect(isValidReminder({ activo: 'sí', hora: '19:00' })).toBe(false);
    expect(isValidReminder(null)).toBe(false);
  });

  it('normaliza valores inválidos o ausentes al apagado por defecto', () => {
    expect(normalizeReminder(undefined)).toEqual(DEFAULT_REMINDER);
    expect(normalizeReminder({ activo: true, hora: 'nope' })).toEqual(DEFAULT_REMINDER);
    expect(normalizeReminder({ activo: true, hora: '06:15' })).toEqual({ activo: true, hora: '06:15' });
  });
});

describe('nextReminderAt', () => {
  it('apagado o inválido, no hay próximo disparo', () => {
    expect(nextReminderAt({ activo: false, hora: '19:00' }, new Date(2026, 6, 22, 10))).toBeNull();
    expect(nextReminderAt({ activo: true, hora: 'nope' }, new Date(2026, 6, 22, 10))).toBeNull();
  });

  it('si la hora de hoy todavía no pasó, programa para hoy', () => {
    const next = nextReminderAt({ activo: true, hora: '19:00' }, new Date(2026, 6, 22, 10));
    expect(next).toEqual(new Date(2026, 6, 22, 19, 0, 0, 0));
  });

  it('si la hora de hoy ya pasó, programa para mañana', () => {
    const next = nextReminderAt({ activo: true, hora: '19:00' }, new Date(2026, 6, 22, 20));
    expect(next).toEqual(new Date(2026, 6, 23, 19, 0, 0, 0));
  });

  it('en el borde exacto de la hora, programa para el día siguiente', () => {
    const next = nextReminderAt({ activo: true, hora: '19:00' }, new Date(2026, 6, 22, 19, 0, 0, 0));
    expect(next).toEqual(new Date(2026, 6, 23, 19, 0, 0, 0));
  });
});
