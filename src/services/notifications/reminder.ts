// Recordatorio diario de la PWA (RF-13.3). Programa una notificación local con
// la Notification Triggers API del service worker — el único modo de agendar
// una notificación a futuro sin un servidor de push, coherente con local-first.
// Es mejora progresiva: donde el navegador no soporta la API, no se promete un
// recordatorio (la interfaz lo aclara). Nunca lanza: cualquier fallo de permiso
// o de la API se traga para no romper el flujo de la app.
import type { ReminderConfig } from '../../core/types';
import { nextReminderAt } from '../../core/reminder';

const TAG = 'elomax-recordatorio-diario';

export interface ReminderTexts {
  titulo: string;
  cuerpo: string;
}

interface TriggerCtor {
  new (timestamp: number): unknown;
}

// Extensiones de la Notification Triggers API que todavía no están en lib.dom.
type ExtendedGetOptions = GetNotificationOptions & { includeTriggered?: boolean };
type ExtendedNotificationOptions = NotificationOptions & { showTrigger?: unknown };

function timestampTrigger(): TriggerCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { TimestampTrigger?: TriggerCtor }).TimestampTrigger;
}

/** ¿El navegador soporta agendar recordatorios locales a futuro? (Notification Triggers). */
export function remindersSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    timestampTrigger() !== undefined
  );
}

/** Estado actual del permiso de notificaciones, sin pedirlo. */
export function reminderPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Pide el permiso de notificaciones (lo dispara la acción del usuario al activar). */
export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Sincroniza el recordatorio agendado con la config actual: cancela el pendiente
 * y, si está activo y con permiso concedido, agenda el próximo disparo. Idempotente
 * y silencioso ante errores.
 */
export async function syncReminder(config: ReminderConfig, texts: ReminderTexts, now: Date = new Date()): Promise<void> {
  if (!remindersSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    // Cancelar cualquier recordatorio ya agendado antes de reprogramar.
    const pendientes = await registration.getNotifications({ tag: TAG, includeTriggered: false } as ExtendedGetOptions);
    for (const notificacion of pendientes) notificacion.close();

    if (!config.activo || Notification.permission !== 'granted') return;
    const next = nextReminderAt(config, now);
    const Trigger = timestampTrigger();
    if (!next || !Trigger) return;

    await registration.showNotification(texts.titulo, {
      tag: TAG,
      body: texts.cuerpo,
      showTrigger: new Trigger(next.getTime()),
    } as ExtendedNotificationOptions);
  } catch {
    // Permiso denegado, API no disponible o SW no listo: sin recordatorio, sin ruido.
  }
}
