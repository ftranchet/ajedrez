// Selector de vistas mutuamente excluyentes. Unifica los tabs internos de
// Jugar, Cálculo y Panel sin usar el relleno pleno reservado al CTA primario.
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  function moveSelection(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;

    event.preventDefault();
    onChange(options[next].value);
    const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
    window.requestAnimationFrame(() => radios?.[next]?.focus());
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid gap-1 rounded-lg border border-subtle bg-surface p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveSelection(index, event)}
            className={`min-h-11 rounded-md border px-2 py-2 text-center text-sm font-semibold transition-colors duration-[120ms] ${
              selected
                ? 'border-accent bg-accent-subtle text-primary'
                : 'border-transparent text-secondary hover:bg-elevated hover:text-primary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
