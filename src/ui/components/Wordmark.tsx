// Wordmark de ELOmax (design system §6, identidad): logotipo tipográfico en
// Newsreader —"ELO" en peso medio y tracking ceñido, "max" en itálica— para
// que la marca lea como una firma editorial y no como texto plano. Un solo
// nombre accesible; las dos mitades son decorativas.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display leading-none text-accent ${className}`} aria-label="ELOmax">
      <span aria-hidden className="font-medium tracking-tight">ELO</span>
      <span aria-hidden className="font-normal italic">max</span>
    </span>
  );
}
