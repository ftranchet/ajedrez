// Token personal de Lichess (RF-1.4), guardado **solo en este dispositivo**.
//
// Va en localStorage y no en el perfil a propósito. El perfil entra completo en
// la exportación (RF-14.1), que está pensada para moverse entre equipos y para
// que el usuario la abra, la lea y la comparta si quiere: meter ahí una
// credencial con permiso de jugar en su cuenta convertiría un archivo de
// respaldo en una llave suelta. Es el mismo criterio que el tema y el modo a
// ciegas —preferencia de dispositivo, no dato de entrenamiento—, con el agregado
// de que acá el costo de equivocarse no es estético.
const LICHESS_TOKEN_KEY = 'elomax-lichess-token';

export function readLichessToken(): string | null {
  try {
    const valor = localStorage.getItem(LICHESS_TOKEN_KEY);
    return valor && valor.trim() !== '' ? valor : null;
  } catch {
    return null;
  }
}

export function writeLichessToken(token: string): void {
  try {
    const limpio = token.trim();
    if (limpio === '') localStorage.removeItem(LICHESS_TOKEN_KEY);
    else localStorage.setItem(LICHESS_TOKEN_KEY, limpio);
  } catch {
    // Sin localStorage la partida contra Maia simplemente no está disponible;
    // no es motivo para romper el resto de la app.
  }
}

export function clearLichessToken(): void {
  writeLichessToken('');
}
