// Recordatorio diario opcional (RF-13.3): configuración pura del recordatorio
// local de la PWA. El dominio no conoce la API de notificaciones ni el service
// worker (eso vive en services/notifications) — solo valida la config y calcula
// cuándo debe dispararse el próximo recordatorio. Apagado por defecto.
import type { ReminderConfig } from './types';

export type { ReminderConfig };

export const DEFAULT_REMINDER: ReminderConfig = { activo: false, hora: '19:00' };

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidReminder(value: unknown): value is ReminderConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<ReminderConfig>;
  return typeof config.activo === 'boolean' && typeof config.hora === 'string' && HORA_RE.test(config.hora);
}

export function normalizeReminder(value: unknown): ReminderConfig {
  return isValidReminder(value) ? { activo: value.activo, hora: value.hora } : { ...DEFAULT_REMINDER };
}

function parseHora(hora: string): { h: number; m: number } | null {
  const match = HORA_RE.exec(hora);
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

/**
 * Próximo instante en que debe dispararse el recordatorio (RF-13.3): la hora
 * configurada de hoy si todavía no pasó, o la de mañana si ya pasó. Null si el
 * recordatorio está apagado o la hora es inválida. Se usa para programar la
 * notificación local; se recalcula en cada apertura de la app.
 */
export function nextReminderAt(config: ReminderConfig, now: Date = new Date()): Date | null {
  if (!config.activo) return null;
  const parsed = parseHora(config.hora);
  if (!parsed) return null;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parsed.h, parsed.m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}
