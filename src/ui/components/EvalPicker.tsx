// EvalPicker (design system §5): evaluación rápida de la posición, selección
// única, táctil. RF-5.2: "mejor blancas / igual / mejor negras".
import { Chip } from './Chip';
import type { EvalGuess } from '../state/sessionStore';
import { t } from '../i18n/es';

const OPCIONES: Array<{ value: EvalGuess; label: string }> = [
  { value: 'blancas', label: t.radar.mejorBlancas },
  { value: 'igual', label: t.radar.igual },
  { value: 'negras', label: t.radar.mejorNegras },
];

export function EvalPicker({ selected, onSelect }: { selected: EvalGuess | null; onSelect: (v: EvalGuess) => void }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 p-0 text-sm text-secondary">{t.radar.comoEstaLaPosicion}</legend>
      <div className="flex gap-2">
        {OPCIONES.map((o) => (
          <Chip key={o.value} selected={selected === o.value} onClick={() => onSelect(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
