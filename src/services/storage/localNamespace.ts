// El namespace de ELOmax en `localStorage`.
//
// IndexedDB guarda los datos de entrenamiento; `localStorage` guarda lo que es
// de *este dispositivo*: tema, idioma de notación, modo a ciegas y el token de
// Lichess (ver ui/lichessToken.ts). "Eliminar todos mis datos" vaciaba solo lo
// primero, así que después de borrar todo y recargar la app seguía conectada a
// Lichess con el bearer token intacto: la acción prometía más de lo que hacía,
// justo en el dato más sensible que la app toca.
//
// Se barre por prefijo y no por una lista de claves a propósito: una clave
// nueva queda cubierta el día que se agrega, sin que nadie tenga que acordarse
// de sumarla acá.
export const PREFIJO_LOCAL = 'elomax-';

/**
 * Borra todas las claves del namespace y devuelve las que borró. Silencioso si
 * `localStorage` no está disponible (Safari en privado, entorno de test): no
 * poder limpiar preferencias no puede romper el borrado de datos.
 */
export function clearLocalNamespace(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave?.startsWith(PREFIJO_LOCAL)) claves.push(clave);
    }
    for (const clave of claves) localStorage.removeItem(clave);
    return claves;
  } catch {
    return [];
  }
}
