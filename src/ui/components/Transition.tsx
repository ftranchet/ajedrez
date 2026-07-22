import { useEffect, useRef, type ReactNode } from 'react';

/** Un único primitivo para que el ojo siga los cambios de fase. El contenido
 * saliente no se retiene: evita controles duplicados en foco/lectores de
 * pantalla y deja que CSS respete reduced motion. */
export function Transition({
  phaseKey,
  label,
  children,
  className = '',
}: {
  phaseKey: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousPhase = useRef(phaseKey);

  useEffect(() => {
    if (previousPhase.current === phaseKey) return;
    previousPhase.current = phaseKey;

    // El control que originó el cambio suele desmontarse con la fase. Llevar
    // el foco al primer control nuevo (o al grupo si solo pide una jugada)
    // mantiene el flujo de teclado y hace perceptible el cambio para AT.
    const frame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const interactive = container.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      );
      (interactive ?? container).focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [phaseKey]);

  return (
    <div
      key={phaseKey}
      ref={containerRef}
      role={label ? 'group' : undefined}
      aria-label={label}
      tabIndex={-1}
      data-phase={phaseKey}
      className={`study-transition ${className}`}
    >
      {children}
    </div>
  );
}
