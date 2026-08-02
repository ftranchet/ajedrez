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
  onConfirm: (valor: number) => void | Promise<void>;
  label?: string;
  confirmLabel?: string;
}) {
  const [valor, setValor] = useState(50);
  // Guardar la calibración toca IndexedDB y a veces el motor: hasta que
  // termine, el botón queda deshabilitado. El store además es single-flight
  // (state/singleFlight.ts) —esto es lo que el usuario ve, aquello es lo que
  // garantiza que no se guarde dos veces—.
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (guardando) return;
    setGuardando(true);
    try {
      await onConfirm(valor);
    } finally {
      setGuardando(false);
    }
  }

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
          disabled={guardando}
          className="w-full accent-[var(--color-accent)]"
        />
      </label>
      <button
        onClick={() => void confirmar()}
        disabled={guardando}
        aria-busy={guardando}
        className="btn-primary disabled:opacity-60"
      >
        {confirmLabel}
      </button>
    </div>
  );
}
