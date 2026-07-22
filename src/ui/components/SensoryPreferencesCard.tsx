import { useState } from 'react';
import type { SensoryPreferences } from '../../core/types';
import { normalizeSensoryPreferences } from '../../core/sensory';
import {
  previewSoundFeedback,
  previewVibrationFeedback,
  soundFeedbackSupported,
  vibrationFeedbackSupported,
} from '../../services/sensory/feedback';
import { t } from '../i18n/es';
import { SectionHeading } from './SectionHeading';

type SensoryChannel = keyof SensoryPreferences;

export function SensoryPreferencesCard({
  preferences: rawPreferences,
  onSave,
}: {
  preferences: SensoryPreferences | undefined;
  onSave: (preferences: SensoryPreferences) => Promise<void>;
}) {
  const preferences = normalizeSensoryPreferences(rawPreferences);
  const [draft, setDraft] = useState(preferences);
  const [savingChannel, setSavingChannel] = useState<SensoryChannel | null>(null);
  const [error, setError] = useState(false);
  const soundSupported = soundFeedbackSupported();
  const vibrationSupported = vibrationFeedbackSupported();
  const saving = savingChannel !== null;
  const soundCanChange = soundSupported || draft.sonido;
  const vibrationCanChange = vibrationSupported || draft.vibracion;

  async function toggle(channel: SensoryChannel, checked: boolean) {
    if (savingChannel !== null) return;
    const previous = draft;
    const next = { ...draft, [channel]: checked };
    setDraft(next);
    setSavingChannel(channel);
    setError(false);

    // El preview debe ocurrir dentro del gesto para cumplir autoplay y la
    // activación exigida por algunos navegadores para vibrar.
    if (checked && channel === 'sonido') previewSoundFeedback();
    if (checked && channel === 'vibracion') previewVibrationFeedback();

    try {
      await onSave(next);
    } catch {
      setDraft(previous);
      setError(true);
    } finally {
      setSavingChannel(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.sensorial.titulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.sensorial.descripcion}</p>
      </div>

      <label className={`flex min-h-11 items-start gap-3 rounded-md border border-subtle bg-elevated p-3 ${soundCanChange ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
        <input
          type="checkbox"
          checked={draft.sonido}
          disabled={(!soundSupported && !draft.sonido) || (saving && savingChannel !== 'sonido')}
          aria-disabled={savingChannel === 'sonido' ? true : undefined}
          onChange={(event) => void toggle('sonido', event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-accent"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-primary">{t.sensorial.sonido}</span>
          <span className="text-xs text-secondary">{soundSupported ? t.sensorial.sonidoDetalle : t.sensorial.noDisponible}</span>
        </span>
      </label>

      <label className={`flex min-h-11 items-start gap-3 rounded-md border border-subtle bg-elevated p-3 ${vibrationCanChange ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
        <input
          type="checkbox"
          checked={draft.vibracion}
          disabled={(!vibrationSupported && !draft.vibracion) || (saving && savingChannel !== 'vibracion')}
          aria-disabled={savingChannel === 'vibracion' ? true : undefined}
          onChange={(event) => void toggle('vibracion', event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-accent"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-primary">{t.sensorial.vibracion}</span>
          <span className="text-xs text-secondary">{vibrationSupported ? t.sensorial.vibracionDetalle : t.sensorial.noDisponible}</span>
        </span>
      </label>

      <p className="m-0 text-xs text-tertiary">{t.sensorial.ayuda}</p>
      {saving && <p role="status" className="m-0 text-xs text-secondary">{t.sensorial.guardando}</p>}
      {error && (
        <p role="alert" className="m-0 rounded-md border border-error/35 bg-error-subtle p-2 text-sm text-primary">
          {t.sensorial.error}
        </p>
      )}
    </section>
  );
}
