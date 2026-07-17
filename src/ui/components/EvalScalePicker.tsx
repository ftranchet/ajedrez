// Escala de evaluación de 5 valores (RF-3.1c, design system §5 EvalPicker):
// +− / ± / = / ∓ / −+, en font-mono como especifica el design system.
import { Chip } from './Chip';
import type { EvalSymbol } from '../../core/types';
import { t } from '../i18n/es';

const OPCIONES: Array<{ value: EvalSymbol; label: string }> = [
  { value: '+-', label: t.analisis.evalMuyMejorBlancas },
  { value: '±', label: t.analisis.evalMejorBlancas },
  { value: '=', label: t.analisis.evalIgual },
  { value: '∓', label: t.analisis.evalMejorNegras },
  { value: '-+', label: t.analisis.evalMuyMejorNegras },
];

export function EvalScalePicker({ onSelect }: { onSelect: (v: EvalSymbol) => void }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-2 p-0 text-sm text-secondary">{t.analisis.evalConsigna}</legend>
      <div className="flex flex-col gap-2">
        {OPCIONES.map((o) => (
          <Chip key={o.value} selected={false} onClick={() => onSelect(o.value)}>
            <span className="font-mono">{o.label}</span>
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
