import { useState } from 'react';
import type { PlanSemanal, Profile, SessionRecord } from '../../core/types';
import {
  isValidWeeklyPlan,
  normalizeWeeklyPlan,
  WEEKLY_PLAN_PRESETS,
  weeklyPlanPreset,
  weeklyPlanProgress,
  type WeeklyPlanPreset,
} from '../../core/adherence';
import { t } from '../i18n/es';
import { SectionHeading } from './SectionHeading';

export function WeeklyPlanCard({
  records,
  profile,
  editable = false,
  onSave,
}: {
  records: SessionRecord[];
  profile: Profile;
  editable?: boolean;
  onSave?: (plan: PlanSemanal) => Promise<void>;
}) {
  const savedPlan = normalizeWeeklyPlan(profile.planSemanal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanSemanal>(savedPlan);
  const [saving, setSaving] = useState(false);
  const progress = weeklyPlanProgress(records, savedPlan);

  const remainingText = progress.cumplido
    ? t.adherencia.planCumplido
    : progress.sesionesCompletadas === 0
      ? t.adherencia.planPrimeraSesion
      : progress.sesionesRestantes === 1
        ? t.adherencia.planFaltaUna
        : t.adherencia.planFaltan.replace('{n}', String(progress.sesionesRestantes));

  async function save() {
    if (!onSave || !isValidWeeklyPlan(draft)) return;
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`flex flex-col gap-3 rounded-lg border p-4 ${progress.cumplido ? 'border-success/35 bg-success-subtle' : 'border-subtle bg-surface'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionHeading>{t.adherencia.titulo}</SectionHeading>
          <p className="m-0 mt-1 text-sm text-secondary">{t.adherencia.periodo}</p>
        </div>
        {editable && !editing && (
          <button type="button" onClick={() => { setDraft(savedPlan); setEditing(true); }} className="text-sm font-semibold text-secondary underline-offset-4 hover:text-primary hover:underline">
            {t.adherencia.ajustar}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <strong className="font-display text-2xl font-medium text-primary">
            {t.adherencia.sesiones
              // Una vez cumplido, no convertimos el excedente en puntaje.
              .replace('{hechas}', String(Math.min(progress.sesionesCompletadas, progress.sesionesObjetivo)))
              .replace('{objetivo}', String(progress.sesionesObjetivo))}
          </strong>
          <span className="font-mono text-xs text-secondary">
            {t.adherencia.minutos
              .replace('{hechos}', String(progress.minutosCompletados))
              .replace('{objetivo}', String(progress.minutosObjetivo))}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t.adherencia.progresoLabel}
          aria-valuemin={0}
          aria-valuemax={progress.sesionesObjetivo}
          aria-valuenow={Math.min(progress.sesionesCompletadas, progress.sesionesObjetivo)}
          className="h-2 overflow-hidden rounded-full bg-elevated"
        >
          <div
            className={`h-full rounded-full ${progress.cumplido ? 'bg-success' : 'bg-accent'}`}
            style={{ width: `${progress.proporcionSesiones * 100}%` }}
          />
        </div>
        <p className="m-0 text-sm text-secondary">{remainingText}</p>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 border-t border-subtle pt-3">
          <label className="flex flex-col gap-1 text-sm text-secondary">
            {t.adherencia.tipoPlan}
            <select
              value={weeklyPlanPreset(draft)}
              onChange={(event) => {
                const value = event.target.value as WeeklyPlanPreset | 'personalizado';
                if (value !== 'personalizado') setDraft({ ...WEEKLY_PLAN_PRESETS[value] });
              }}
              className="min-h-11 rounded-md border border-subtle bg-elevated px-3 text-primary focus-visible:border-accent"
            >
              <option value="ligero">{t.adherencia.planLigero}</option>
              <option value="constante">{t.adherencia.planConstante}</option>
              <option value="intenso">{t.adherencia.planIntenso}</option>
              <option value="personalizado">{t.adherencia.planPersonalizado}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-secondary">
              {t.adherencia.objetivoSesiones}
              <input
                type="number"
                min="1"
                max="7"
                value={draft.sesionesObjetivo}
                onChange={(event) => setDraft({ ...draft, sesionesObjetivo: Number(event.target.value) })}
                className="min-h-11 rounded-md border border-subtle bg-elevated px-3 font-mono text-primary focus-visible:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-secondary">
              {t.adherencia.objetivoMinutos}
              <input
                type="number"
                min="15"
                max="600"
                step="5"
                value={draft.minutosObjetivo}
                onChange={(event) => setDraft({ ...draft, minutosObjetivo: Number(event.target.value) })}
                className="min-h-11 rounded-md border border-subtle bg-elevated px-3 font-mono text-primary focus-visible:border-accent"
              />
            </label>
          </div>
          <p className="m-0 text-xs text-tertiary">{t.adherencia.reglaHonesta}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={saving || !isValidWeeklyPlan(draft)} className="btn-secondary flex-1">
              {saving ? t.adherencia.guardando : t.adherencia.guardar}
            </button>
            <button type="button" onClick={() => { setDraft(savedPlan); setEditing(false); }} className="min-h-11 px-3 text-sm font-semibold text-secondary hover:text-primary">
              {t.adherencia.cancelar}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
