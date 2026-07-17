// EvalGraph (design system §5): curva de evaluación con marcadores de
// jugadas grave/error. Línea en `info`; errores como puntos `error`.
import type { MoveAnalysisEntry } from '../../core/types';

const CLAMP = 600; // cp máximos que se representan (a partir de acá, "ganado")
const ANCHO = 300;
const ALTO = 60;

function clamp(cp: number): number {
  return Math.max(-CLAMP, Math.min(CLAMP, cp));
}

function y(cp: number): number {
  // cp positivo (mejor para blancas) arriba; negativo abajo.
  return ALTO / 2 - (clamp(cp) / CLAMP) * (ALTO / 2 - 2);
}

export function EvalGraph({ jugadas }: { jugadas: MoveAnalysisEntry[] }) {
  if (jugadas.length === 0) return null;
  const puntos = [jugadas[0].cpAntes, ...jugadas.map((j) => j.cpDespues)];
  const pathD = puntos.map((cp, i) => `${i === 0 ? 'M' : 'L'} ${(i / (puntos.length - 1)) * ANCHO} ${y(cp)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-16 w-full" role="img" aria-label="Curva de evaluación">
      <line x1={0} y1={ALTO / 2} x2={ANCHO} y2={ALTO / 2} stroke="var(--color-subtle)" strokeWidth={1} />
      <path d={pathD} fill="none" stroke="var(--color-info)" strokeWidth={1.5} />
      {jugadas.map((j, i) => {
        if (j.clasificacion !== 'grave' && j.clasificacion !== 'error') return null;
        const x = ((i + 1) / puntos.length) * ANCHO;
        return <circle key={j.ply} cx={x} cy={y(j.cpDespues)} r={2.5} fill="var(--color-error)" />;
      })}
    </svg>
  );
}
