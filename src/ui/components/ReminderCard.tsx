// Recordatorio diario opcional (RF-13.3): tarjeta de ajuste en Hoy. Apagado por
// defecto; activarlo pide el permiso de notificaciones (gesto del usuario) y
// agenda una notificación local con la Notification Triggers API. Donde el
// navegador no la soporta, la tarjeta lo dice con honestidad en vez de prometer
// un recordatorio que no va a llegar.
import { useEffect, useState } from 'react';
import type { ReminderConfig } from '../../core/types';
import { normalizeReminder } from '../../core/reminder';
import {
  remindersSupported,
  requestReminderPermission,
  syncReminder,
} from '../../services/notifications/reminder';
import { t } from '../i18n/es';
import { SectionHeading } from './SectionHeading';

function notifTexts() {
  return { titulo: t.adherencia.recordatorioNotifTitulo, cuerpo: t.adherencia.recordatorioNotifCuerpo };
}

export function ReminderCard({
  config: rawConfig,
  onSave,
}: {
  config: ReminderConfig | undefined;
  onSave: (config: ReminderConfig) => Promise<void>;
}) {
  const config = normalizeReminder(rawConfig);
  const soportado = remindersSupported();
  const [hora, setHora] = useState(config.hora);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Re-agenda el próximo disparo en cada apertura (la hora de hoy o la de mañana).
  useEffect(() => {
    if (soportado && config.activo) void syncReminder(config, notifTexts());
    // Solo al montar: reprogramar el recordatorio vigente al abrir la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply(next: ReminderConfig) {
    setSaving(true);
    setMensaje(null);
    try {
      await onSave(next);
      await syncReminder(next, notifTexts());
    } finally {
      setSaving(false);
    }
  }

  async function activar() {
    const permiso = await requestReminderPermission();
    if (permiso !== 'granted') {
      setMensaje(t.adherencia.recordatorioPermisoDenegado);
      return;
    }
    await apply({ activo: true, hora });
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.adherencia.recordatorioTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">
          {config.activo ? t.adherencia.recordatorioEncendido.replace('{hora}', config.hora) : t.adherencia.recordatorioApagado}
        </p>
      </div>

      {!soportado ? (
        <p className="m-0 text-sm text-tertiary">{t.adherencia.recordatorioNoSoportado}</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-secondary">
            {t.adherencia.recordatorioHora}
            <input
              type="time"
              value={hora}
              onChange={(event) => setHora(event.target.value)}
              className="min-h-11 rounded-md border border-subtle bg-elevated px-3 font-mono text-primary focus-visible:border-accent"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {config.activo ? (
              <>
                <button type="button" onClick={() => void apply({ activo: true, hora })} disabled={saving || hora === config.hora} className="btn-secondary">
                  {t.adherencia.recordatorioGuardar}
                </button>
                <button type="button" onClick={() => void apply({ activo: false, hora })} disabled={saving} className="min-h-11 px-3 text-sm font-semibold text-secondary hover:text-primary">
                  {t.adherencia.recordatorioDesactivar}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => void activar()} disabled={saving} className="btn-secondary">
                {t.adherencia.recordatorioActivar}
              </button>
            )}
          </div>
          <p className="m-0 text-xs text-tertiary">{t.adherencia.recordatorioAyuda}</p>
          {mensaje && <p className="m-0 text-sm text-secondary">{mensaje}</p>}
        </>
      )}
    </section>
  );
}
