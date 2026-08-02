// Idioma de la notación algebraica (RNF-9). Las dos son correctas según la
// FIDE —el Apéndice C dice "la inicial del nombre de la pieza en el idioma del
// jugador"— y cuál se usa depende de con qué aprendió a anotar cada uno: mucha
// gente que juega en español anota en inglés porque así lo vio siempre en
// Lichess o en chess.com. Por eso es preferencia y no decisión del producto.
//
// El default es español, que es el idioma de la app. Vive en localStorage
// (preferencia de experiencia, lectura síncrona) igual que el tema y el modo a
// ciegas; no es dato exportable, y como el formato guardado de las jugadas es
// UCI, cambiarla no toca ningún dato del usuario.
import { IDIOMA_NOTACION_POR_DEFECTO, type IdiomaNotacion } from '../core/notacion';

const NOTACION_KEY = 'elomax-notacion';

export function readIdiomaNotacion(): IdiomaNotacion {
  try {
    return localStorage.getItem(NOTACION_KEY) === 'en' ? 'en' : IDIOMA_NOTACION_POR_DEFECTO;
  } catch {
    return IDIOMA_NOTACION_POR_DEFECTO;
  }
}

export function writeIdiomaNotacion(idioma: IdiomaNotacion): void {
  try {
    if (idioma === IDIOMA_NOTACION_POR_DEFECTO) localStorage.removeItem(NOTACION_KEY);
    else localStorage.setItem(NOTACION_KEY, idioma);
  } catch {
    // Sin localStorage se mantiene el default; no es crítico persistir.
  }
}
