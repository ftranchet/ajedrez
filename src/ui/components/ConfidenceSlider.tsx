// ConfidenceSlider (design system §5): calibración 0–100. Aparece solo
// cuando el muestreo lo pide (RF-10.1); descartable nunca — no hay botón
// para saltearlo, solo confirmar.
import { useState } from 'react';
import { t } from '../i18n/es';

export function ConfidenceSlider({
  onConfirm,
  label = t.radar.confianza,
  confirmLabel = t.radar.confirmarConfianza,
}: {
  onConfirm: (valor: number) => void;
  label?: string;
  confirmLabel?: string;
}) {
  const [valor, setValor] = useState(50);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-secondary">{label}</span>
        <span className="font-mono text-2xl text-primary">{valor}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={valor}
          onChange={(e) => setValor(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
      </label>
      <button onClick={() => onConfirm(valor)} className="btn-primary">
        {confirmLabel}
      </button>
    </div>
  );
}
