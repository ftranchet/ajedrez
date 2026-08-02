// Notación algebraica en español, que es la que oficializa la FIDE.
//
// El Apéndice C de las Leyes del Ajedrez fija la notación algebraica como la
// única admitida en competencia, y dice explícitamente que cada pieza se
// nombra con **la primera letra de su nombre en el idioma del jugador**. En una
// app en español eso es R, D, T, A, C — no las inglesas K, Q, R, B, N que
// devuelve chess.js.
//
// Antes de esto la app mezclaba dos notaciones: mostraba las jugadas en
// algebraica inglesa ("Bc4 Bc5 O-O") pero para cargarlas pedía UCI —casilla de
// origen y destino, "e2e4"—, que no es notación de ajedrez sino el protocolo
// con el que se le habla a un motor. Quien sabe anotar una partida no podía
// usar lo que sabe, y lo que leía no era lo que escribía.
//
// El formato **guardado** sigue siendo UCI: es inequívoco, no depende del
// idioma y ya está en los datos del usuario. Este módulo traduce en los dos
// bordes —lo que se muestra y lo que se escribe—, así que no hay migración.
import { Chess } from 'chess.js';

const PIEZA_EN_A_ES: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
const PIEZA_ES_A_EN: Record<string, string> = { R: 'K', D: 'Q', T: 'R', A: 'B', C: 'N' };

/** Letras de pieza que solo existen en la notación inglesa. */
const SOLO_INGLES = /^[KQBN]/;

/** UCI: origen y destino, con la pieza de coronación opcional. */
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

/**
 * Traduce una jugada de algebraica inglesa (la que produce chess.js) a
 * española. Solo toca la letra de pieza inicial y la de coronación: casillas,
 * capturas, jaques, enroques y sufijos quedan igual, porque son idénticos en
 * las dos.
 */
export function aEspanol(san: string): string {
  if (!san) return san;
  // El enroque no lleva letra de pieza en ningún idioma.
  if (san.startsWith('O-O')) return san;
  const inicial = PIEZA_EN_A_ES[san[0]];
  const cuerpo = inicial ? inicial + san.slice(1) : san;
  // Coronación: "e8=Q" → "e8=D".
  return cuerpo.replace(/=([KQRBN])/, (_, pieza: string) => `=${PIEZA_EN_A_ES[pieza] ?? pieza}`);
}

/** El camino inverso, para poder pasarle al motor de reglas lo que se escribió. */
export function aIngles(san: string): string {
  if (!san) return san;
  if (san.startsWith('O-O') || san.startsWith('0-0')) return san.replace(/0/g, 'O');
  const inicial = PIEZA_ES_A_EN[san[0]];
  const cuerpo = inicial ? inicial + san.slice(1) : san;
  return cuerpo.replace(/=([RDTAC])/, (_, pieza: string) => `=${PIEZA_ES_A_EN[pieza] ?? pieza}`);
}

export type ErrorNotacion =
  /** No se entiende como jugada: ni algebraica ni UCI. */
  | 'formato'
  /** Se entiende, pero no es legal en esta posición. */
  | 'ilegal'
  /** Está bien escrita, pero con las letras inglesas (Nf3 en vez de Cf3). */
  | 'notacion-inglesa';

export interface JugadaInterpretada {
  /** Formato interno y persistido. */
  uci: string;
  /** Cómo mostrarla: algebraica española, ya desambiguada por las reglas. */
  san: string;
}

/**
 * Interpreta lo que el usuario escribió sobre una posición dada.
 *
 * Acepta algebraica española ("Cf3", "exd5", "O-O", "e8=D") y también UCI
 * ("g1f3"), que era el formato anterior y no puede confundirse con algebraica
 * —ninguna jugada algebraica tiene la forma casilla+casilla—, así que aceptarlo
 * no reintroduce ambigüedad y no rompe la costumbre de quien ya venía usándolo.
 *
 * **No** acepta algebraica inglesa, y no por purismo: "Re1" es rey a e1 en
 * español y torre a e1 en inglés, y las dos pueden ser legales en la misma
 * posición. Admitir las dos sería elegir en silencio por el usuario. Cuando la
 * entrada solo se entiende como inglesa se devuelve un error propio, para poder
 * decirle qué letra usar en vez de un "formato inválido" que no enseña nada.
 */
export function interpretarJugada(fen: string, linea: string[], entrada: string): JugadaInterpretada | { error: ErrorNotacion } {
  const texto = entrada.trim();
  if (!texto) return { error: 'formato' };

  const chess = replayLinea(fen, linea);
  const legales = chess.moves({ verbose: true });

  // UCI primero: es exacto y no depende de mayúsculas.
  if (UCI_RE.test(texto)) {
    const uci = texto.toLowerCase();
    const move = legales.find((m) => m.from + m.to + (m.promotion ?? '') === uci);
    return move ? { uci, san: aEspanol(move.san) } : { error: 'ilegal' };
  }

  // Las letras inglesas se descartan **antes** de buscar. K, Q, B y N no son
  // inicial de ninguna pieza en español, así que una entrada que empieza con
  // una de ellas no es algebraica española — pero sí matchea contra el SAN
  // inglés que emite chess.js, que es exactamente el silencio que hay que
  // evitar: aceptarla haría que la app admita las dos notaciones a la vez.
  if (SOLO_INGLES.test(texto)) {
    return { error: buscarPorSan(legales, texto) ? 'notacion-inglesa' : 'formato' };
  }

  const move = buscarPorSan(legales, aIngles(texto));
  if (move) return { uci: move.from + move.to + (move.promotion ?? ''), san: aEspanol(move.san) };

  // Distinguir "no es una jugada" de "es una jugada pero no acá": si la escribió
  // bien pero no es legal, el mensaje útil es el segundo.
  return { error: pareceAlgebraica(texto) ? 'ilegal' : 'formato' };
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

/** Convierte una línea guardada en UCI a algebraica española, para mostrarla. */
export function lineaAEspanol(fen: string, linea: string[]): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of linea) {
    const move = chess.moves({ verbose: true }).find((m) => m.from + m.to + (m.promotion ?? '') === uci);
    if (!move) break;
    san.push(aEspanol(chess.move(move).san));
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

/** ¿Tiene forma de jugada algebraica, aunque no sea legal acá? */
function pareceAlgebraica(texto: string): boolean {
  return /^([RDTAC]?[a-h]?[1-8]?x?[a-h][1-8](=[RDTAC])?|O-O(-O)?|0-0(-0)?)[+#!?]*$/.test(texto);
}
