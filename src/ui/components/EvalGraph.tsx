// EvalGraph (design system §5): curva de evaluación con marcadores de
// jugadas grave/error. Línea en `info`; errores como puntos `error`.
import type { MoveAnalysisEntry } from '../../core/types';
import { t } from '../i18n/es';

const CLAMP = 600; // cp máximos que se representan (a partir de acá, "ganado")
const ANCHO = 300;
const ALTO = 60;

function clamp(cp: number): number {
  return Math.max(-CLAMP, Math.min(CLAMP, cp));
}

/**
 * Dónde se dibuja el punto `indice` de la curva, de `totalPuntos`: el 0 es la
 * posición inicial y el `k`, la posición después de la jugada `k`. Es la
 * única función de coordenadas del gráfico. Los marcadores tenían su propia
 * cuenta de x, `(i + 1) / totalPuntos` contra el `i / (totalPuntos − 1)` de
 * la curva, y quedaban corridos hacia la izquierda: más cuanto más avanzada
 * la jugada (auditoría 2026-10-15, N3).
 */
export function coordenadaDePunto(indice: number, totalPuntos: number, cp: number): { x: number; y: number } {
  return {
    x: (indice / (totalPuntos - 1)) * ANCHO,
    // cp positivo (mejor para blancas) arriba; negativo abajo.
    y: ALTO / 2 - (clamp(cp) / CLAMP) * (ALTO / 2 - 2),
  };
}

/**
 * La curva y los marcadores de una partida con al menos una jugada. El
 * marcador de una jugada es el punto de la curva que la sigue, el mismo
 * vértice y no una cuenta paralela.
 */
export function trazadoDeLaCurva(jugadas: MoveAnalysisEntry[]): {
  path: string;
  marcadores: { ply: number; x: number; y: number }[];
} {
  const puntos = [jugadas[0].cpAntes, ...jugadas.map((j) => j.cpDespues)];
  const coordenadas = puntos.map((cp, i) => coordenadaDePunto(i, puntos.length, cp));
  const path = coordenadas.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const marcadores = jugadas.flatMap((j, i) =>
    j.clasificacion === 'grave' || j.clasificacion === 'error' ? [{ ply: j.ply, ...coordenadas[i + 1] }] : [],
  );
  return { path, marcadores };
}

export function EvalGraph({ jugadas }: { jugadas: MoveAnalysisEntry[] }) {
  if (jugadas.length === 0) return null;
  const { path, marcadores } = trazadoDeLaCurva(jugadas);

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-16 w-full" role="img" aria-label={t.analisis.curvaTitulo}>
      <line x1={0} y1={ALTO / 2} x2={ANCHO} y2={ALTO / 2} stroke="var(--color-subtle)" strokeWidth={1} />
      <path d={path} fill="none" stroke="var(--color-info)" strokeWidth={1.5} />
      {marcadores.map((m) => (
        <circle key={m.ply} cx={m.x} cy={m.y} r={2.5} fill="var(--color-error)" />
      ))}
    </svg>
  );
}
