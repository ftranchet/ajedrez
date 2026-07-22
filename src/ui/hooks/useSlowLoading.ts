import { useEffect, useState } from 'react';

/**
 * Distingue una carga normal de una que ya merece explicación y una salida.
 * El temporizador solo afecta a la UI: la operación que está cargando conserva
 * su propio ciclo de vida y puede completarse mientras se muestra el aviso.
 */
export function useSlowLoading(loading: boolean, delayMs = 4_000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Diferir el reset evita derivar estado sincrónicamente dentro del
      // efecto y deja el hook compatible con las reglas de React 19.
      const reset = window.setTimeout(() => setSlow(false), 0);
      return () => window.clearTimeout(reset);
    }

    const timeout = window.setTimeout(() => setSlow(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, loading]);

  return loading && slow;
}
