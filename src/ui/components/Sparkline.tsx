// Sparkline (design system §5): la forma mínima de mostrar evolución sin
// convertir el Panel en un tablero de analytics. Sin ejes, sin grilla, sin
// leyenda — solo la trayectoria y su punto actual, porque la pregunta que
// responde es "¿esto viene bajando?", no "¿cuánto valía el 12 de marzo?".
//
// El color no lleva información por sí solo (RNF-6): la lectura en texto que
// acompaña siempre dice si mejora o empeora.
export interface SparklinePoint {
  fecha: string;
  valor: number;
}

export function Sparkline({
  puntos,
  label,
  /** true cuando bajar es mejorar (errores graves, brecha de calibración). */
  menorEsMejor = true,
}: {
  puntos: SparklinePoint[];
  label: string;
  menorEsMejor?: boolean;
}) {
  if (puntos.length < 2) return null;
  const valores = puntos.map((punto) => punto.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  // 0–100 × 0–30: ancho completo, alto de sparkline.
  const coords = puntos.map((punto, index) => {
    const x = (index / (puntos.length - 1)) * 100;
    const y = 28 - ((punto.valor - min) / rango) * 26;
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const ultimo = coords[coords.length - 1];
  const mejora = menorEsMejor
    ? valores[valores.length - 1] < valores[0]
    : valores[valores.length - 1] > valores[0];

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label={label}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className={mejora ? 'text-success' : 'text-tertiary'} />
      <circle cx={ultimo.x} cy={ultimo.y} r="2" fill="currentColor" className={mejora ? 'text-success' : 'text-tertiary'} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
