// Chip seleccionable (design system §2.1, regla "selected"): accent-subtle
// + borde accent. Usado por selectores de una sola opción (nivel del motor,
// color, EvalPicker).
export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-sm border px-3 py-2 text-left text-sm transition-colors duration-[120ms] ${
        selected
          ? 'border-accent bg-accent-subtle text-primary'
          : 'border-subtle bg-surface text-secondary hover:border-strong hover:bg-elevated'
      }`}
    >
      {children}
    </button>
  );
}
