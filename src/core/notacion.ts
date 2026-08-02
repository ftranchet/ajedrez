// Notación algebraica de jugadas, en español o en inglés (RNF-9).
//
// El Apéndice C de las Leyes del Ajedrez de la FIDE fija la algebraica como la
// única notación admitida en competencia, y dice que cada pieza se nombra con
// **la primera letra de su nombre en el idioma del jugador**. En español eso es
// R, D, T, A, C; en inglés, K, Q, R, B, N. Las dos son igual de correctas: cuál
// se usa depende de con qué aprendió a anotar cada uno, y por eso es una
// preferencia y no una decisión del producto (se elige en Ajustes).
//
// Antes de esto la app mezclaba: mostraba las jugadas en algebraica inglesa
// ("Bc4 Bc5 O-O") pero para cargarlas pedía UCI —casilla de origen y destino,
// "e2e4"—, que no es notación de ajedrez sino el protocolo con el que se le
// habla a un motor. Quien sabe anotar una partida no podía usar lo que sabe, y
// lo que leía no era lo que escribía.
//
// El formato **guardado** es siempre UCI: es inequívoco, no depende del idioma
// y ya está en los datos del usuario. Este módulo traduce en los dos bordes —lo
// que se muestra y lo que se escribe—, así que cambiar la preferencia no toca
// ningún dato.
import { Chess } from 'chess.js';

export type IdiomaNotacion = 'es' | 'en';

export const IDIOMA_NOTACION_POR_DEFECTO: IdiomaNotacion = 'es';

/** Inicial de cada pieza por idioma, en el orden rey, dama, torre, alfil, caballo. */
export const PIEZAS_POR_IDIOMA: Record<IdiomaNotacion, Record<string, string>> = {
  es: { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' },
  en: { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' },
};

const INVERSO: Record<IdiomaNotacion, Record<string, string>> = {
  es: { R: 'K', D: 'Q', T: 'R', A: 'B', C: 'N' },
  en: { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N' },
};

/** UCI: origen y destino, con la pieza de coronación opcional. */
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

const otroIdioma = (idioma: IdiomaNotacion): IdiomaNotacion => (idioma === 'es' ? 'en' : 'es');

/**
 * Traduce una jugada de algebraica inglesa (la que produce chess.js) al idioma
 * pedido. Solo toca la letra de pieza inicial y la de coronación: casillas,
 * capturas, jaques, enroques y sufijos son idénticos en los dos idiomas.
 */
export function aNotacion(san: string, idioma: IdiomaNotacion): string {
  if (!san || idioma === 'en') return san;
  // El enroque no lleva letra de pieza en ningún idioma.
  if (san.startsWith('O-O')) return san;
  const tabla = PIEZAS_POR_IDIOMA[idioma];
  const inicial = tabla[san[0]];
  const cuerpo = inicial ? inicial + san.slice(1) : san;
  // Coronación: "e8=Q" → "e8=D".
  return cuerpo.replace(/=([KQRBN])/, (_, pieza: string) => `=${tabla[pieza] ?? pieza}`);
}

/** El camino inverso, para poder pasarle a las reglas lo que se escribió. */
export function aIngles(san: string, idioma: IdiomaNotacion): string {
  if (!san) return san;
  if (san.startsWith('O-O') || san.startsWith('0-0')) return san.replace(/0/g, 'O');
  const tabla = INVERSO[idioma];
  const inicial = tabla[san[0]];
  const cuerpo = inicial ? inicial + san.slice(1) : san;
  return cuerpo.replace(/=([A-Z])/, (_, pieza: string) => `=${tabla[pieza] ?? pieza}`);
}

export type ErrorNotacion =
  /** No se entiende como jugada: ni algebraica ni UCI. */
  | 'formato'
  /** Se entiende, pero no es legal en esta posición. */
  | 'ilegal'
  /** Está bien escrita, pero en el otro idioma (Nf3 con la app en español). */
  | 'otro-idioma';

export interface JugadaInterpretada {
  /** Formato interno y persistido. */
  uci: string;
  /** Cómo mostrarla: algebraica en el idioma elegido, ya desambiguada. */
  san: string;
}

/**
 * Interpreta lo que el usuario escribió sobre una posición dada.
 *
 * Acepta algebraica en el idioma configurado ("Cf3", "exd5", "O-O", "e8=D") y
 * también UCI ("g1f3"), que era el formato anterior y no puede confundirse con
 * algebraica —ninguna jugada algebraica tiene la forma casilla+casilla—, así
 * que aceptarlo no introduce ambigüedad y no rompe la costumbre de quien ya lo
 * venía usando.
 *
 * **No** acepta el otro idioma, y no por purismo: "Re1" es rey a e1 en español
 * y torre a e1 en inglés, y las dos pueden ser legales en la misma posición.
 * Admitir los dos a la vez sería elegir en silencio por el usuario. Cuando la
 * entrada solo se entiende en el otro idioma se devuelve un error propio, para
 * poder ofrecerle cambiar la preferencia en vez de un "formato inválido" que no
 * enseña nada.
 */
export function interpretarJugada(
  fen: string,
  linea: string[],
  entrada: string,
  idioma: IdiomaNotacion = IDIOMA_NOTACION_POR_DEFECTO,
): JugadaInterpretada | { error: ErrorNotacion } {
  const texto = entrada.trim();
  if (!texto) return { error: 'formato' };

  const chess = replayLinea(fen, linea);
  const legales = chess.moves({ verbose: true });

  // UCI primero: es exacto y no depende de mayúsculas ni del idioma.
  if (UCI_RE.test(texto)) {
    const uci = texto.toLowerCase();
    const move = legales.find((m) => m.from + m.to + (m.promotion ?? '') === uci);
    return move ? { uci, san: aNotacion(move.san, idioma) } : { error: 'ilegal' };
  }

  // Las letras que solo existen en el otro idioma se descartan **antes** de
  // buscar: si no, "Bc4" con la app en español matchea igual contra el SAN
  // inglés que emite chess.js, y la app terminaría aceptando las dos
  // notaciones a la vez, que es justamente lo que hay que evitar.
  if (esExclusivaDe(texto, otroIdioma(idioma))) {
    return { error: buscarPorSan(legales, aIngles(texto, otroIdioma(idioma))) ? 'otro-idioma' : 'formato' };
  }

  const move = buscarPorSan(legales, aIngles(texto, idioma));
  if (move) return { uci: move.from + move.to + (move.promotion ?? ''), san: aNotacion(move.san, idioma) };

  // Distinguir "no es una jugada" de "es una jugada pero no acá": si la escribió
  // bien pero no es legal, el mensaje útil es el segundo.
  return { error: pareceAlgebraica(texto, idioma) ? 'ilegal' : 'formato' };
}

/** ¿La inicial de pieza pertenece solo a ese idioma? */
function esExclusivaDe(texto: string, idioma: IdiomaNotacion): boolean {
  const propias = new Set(Object.values(PIEZAS_POR_IDIOMA[idioma]));
  const ajenas = new Set(Object.values(PIEZAS_POR_IDIOMA[otroIdioma(idioma)]));
  return propias.has(texto[0]) && !ajenas.has(texto[0]);
}

/** Reproduce la línea ya declarada (en UCI) para validar el ply siguiente. */
export function replayLinea(fen: string, linea: string[]): Chess {
  const chess = new Chess(fen);
  for (const uci of linea) {
    const move = chess.moves({ verbose: true }).find((m) => m.from + m.to + (m.promotion ?? '') === uci);
    if (!move) break;
    chess.move(move);
  }
  return chess;
}

/** Convierte una línea guardada en UCI a algebraica, para mostrarla. */
export function lineaANotacion(fen: string, linea: string[], idioma: IdiomaNotacion): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of linea) {
    const move = chess.moves({ verbose: true }).find((m) => m.from + m.to + (m.promotion ?? '') === uci);
    if (!move) break;
    san.push(aNotacion(chess.move(move).san, idioma));
  }
  return san;
}

/**
 * Busca la jugada por su algebraica inglesa, tolerando lo que las reglas
 * permiten omitir: el "+" de jaque, el "#" de mate y los sufijos de comentario
 * (!, ?). chess.js los emite siempre, y exigírselos al usuario sería pedirle
 * que anticipe si su jugada da jaque para poder escribirla.
 */
function buscarPorSan(legales: { san: string }[], texto: string): { san: string; from: string; to: string; promotion?: string } | undefined {
  const limpio = normalizarSan(texto);
  return (legales as { san: string; from: string; to: string; promotion?: string }[])
    .find((m) => normalizarSan(m.san) === limpio);
}

const normalizarSan = (san: string): string => san.replace(/[+#!?]/g, '').replace(/0/g, 'O');

/** ¿Tiene forma de jugada algebraica en este idioma, aunque no sea legal acá? */
function pareceAlgebraica(texto: string, idioma: IdiomaNotacion): boolean {
  const piezas = Object.values(PIEZAS_POR_IDIOMA[idioma]).join('');
  return new RegExp(`^([${piezas}]?[a-h]?[1-8]?x?[a-h][1-8](=[${piezas}])?|O-O(-O)?|0-0(-0)?)[+#!?]*$`).test(texto);
}
