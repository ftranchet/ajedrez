import { useEffect, useState } from 'react';

// `pointer: coarse` es el dedo: apunta el puntero primario del dispositivo, no
// el tamaño de la pantalla. Se usa para decidir si hace falta el camino táctil
// de las anotaciones (RF-5.10) — en un dispositivo con mouse alcanza el botón
// derecho y no hay nada que agregar a la pantalla.
const PUNTERO_GRUESO_QUERY = '(pointer: coarse)';

function preferenciaActual(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(PUNTERO_GRUESO_QUERY).matches === true;
}

/** Reactivo a propósito: una tablet con teclado desmontable cambia de puntero
 * sin recargar, y un híbrido puede alternar mouse y dedo en la misma sesión. */
export function usePunteroGrueso(): boolean {
  const [grueso, setGrueso] = useState(preferenciaActual);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(PUNTERO_GRUESO_QUERY);
    const update = () => setGrueso(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return grueso;
}
