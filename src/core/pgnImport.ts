// Importación manual de PGN (RF-2.2): vía alternativa que no depende de
// Lichess/Chess.com, único subtipo de E2 que no requiere red (ADR pendiente
// para RF-2.1/2.3: import por API, bloqueado en este entorno sin acceso a
// lichess.org/api.chess.com).
import { Chess } from 'chess.js';
import { leerReloj, leerTimeControl, tiemposDesdeRelojes } from './relojPgn';
import type { GameRecord, Resultado, Ritmo } from './types';

export type PgnParseError = 'vacio' | 'invalido' | 'sin-jugadas' | 'posicion-inicial-no-estandar' | 'varias-partidas';

export type PgnParseResult = {
  ok: true;
  pgn: string;
  resultado: Resultado;
  plyCount: number;
  /**
   * Lo que tardó cada media jugada según los `[%clk]` del PGN (ver
   * `relojPgn.ts`); `[]` si no los trae o el `TimeControl` no permite leerlos.
   */
  tiemposPorJugadaMs: number[];
  whiteElo?: number;
  blackElo?: number;
  playedAt?: string;
} | { ok: false; error: PgnParseError };

function normalizeResultado(raw: string | undefined): Resultado {
  return raw === '1-0' || raw === '0-1' || raw === '1/2-1/2' ? raw : '*';
}

function parseElo(raw: string | undefined): number | undefined {
  if (!raw || !/^\d{3,4}$/.test(raw)) return undefined;
  const value = Number(raw);
  return value >= 100 && value <= 4000 ? value : undefined;
}

const FEN_INICIAL_ESTANDAR = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

/**
 * ¿La partida arranca de algo que no es la posición inicial estándar?
 *
 * Se miran las tres formas en que un PGN lo declara: el par `SetUp`/`FEN`, un
 * `FEN` suelto (chess.js lo respeta igual) y el `Variant` de Lichess
 * ("From Position", "Chess960", atómico…). Del FEN se comparan los cuatro
 * primeros campos: los contadores de jugada no cambian la posición.
 */
function posicionInicialNoEstandar(headers: Record<string, string>): boolean {
  const fen = headers.FEN?.trim();
  if (fen) return fen.split(/\s+/).slice(0, 4).join(' ') !== FEN_INICIAL_ESTANDAR;
  // `SetUp: 1` sin FEN es un PGN que se declara no estándar y no dice desde
  // dónde: no hay forma de reproducirlo bien.
  if (headers.SetUp?.trim() === '1') return true;
  const variante = headers.Variant?.trim().toLowerCase();
  return variante !== undefined && variante !== '' && variante !== 'standard';
}

/** Fecha PGN `YYYY.MM.DD`; los signos `?` indican que no es utilizable. */
function parsePlayedAt(raw: string | undefined): string | undefined {
  const match = raw?.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  // Evita que Date normalice silenciosamente fechas imposibles como 31/02.
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return undefined;
  return date.toISOString();
}

/** Carga un PGN en chess.js; null si no es una partida que pueda leer. */
function cargar(pgn: string): Chess | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return null;
  }
  return chess;
}

const MARCA_DE_RESULTADO = /^(?:1-0|0-1|1\/2-1\/2|\*)$/;

/** Índice siguiente al `]` que cierra el encabezado que empieza en `desde`. */
function finDeEncabezado(texto: string, desde: number): number {
  let enComillas = false;
  for (let i = desde + 1; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas && c === '\\') i++;
    else if (c === '"') enComillas = !enComillas;
    else if (c === ']' && !enComillas) return i + 1;
    else if (c === '\n') return i;
  }
  return texto.length;
}

/**
 * Corta un texto con varias partidas en una por partida. Empieza otra cuando
 * aparece un encabezado después de jugadas, o jugadas después de la marca de
 * resultado (`1-0`, `0-1`, `1/2-1/2`, `*`) que cierra la anterior. Saltea los
 * comentarios: ahí adentro viven los `[%clk]`, que no son encabezados.
 */
function separarPartidas(texto: string): string[] {
  const cortes = [0];
  let hayJugadas = false;
  let terminada = false;
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (c === '{') {
      const fin = texto.indexOf('}', i);
      i = fin === -1 ? texto.length : fin + 1;
    } else if (c === ';') {
      const fin = texto.indexOf('\n', i);
      i = fin === -1 ? texto.length : fin;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === '[') {
      if (hayJugadas) cortes.push(i);
      hayJugadas = false;
      terminada = false;
      i = finDeEncabezado(texto, i);
    } else {
      const token = /[^\s{};[\]]+/y;
      token.lastIndex = i;
      const palabra = token.exec(texto)?.[0] ?? c;
      if (terminada) cortes.push(i);
      terminada = MARCA_DE_RESULTADO.test(palabra);
      hayJugadas = true;
      i += palabra.length;
    }
  }
  return cortes
    .map((desde, n) => texto.slice(desde, cortes[n + 1] ?? texto.length).trim())
    .filter((partida) => partida !== '');
}

/**
 * Reloj de cada media jugada, en el orden de la partida. chess.js guarda los
 * comentarios por la posición que queda después de la jugada, y esa posición
 * (FEN completo, con el número de jugada) no se repite dentro de una partida.
 */
function relojesPorJugada(chess: Chess): (number | null)[] {
  const comentarios = new Map(chess.getComments().map(({ fen, comment }) => [fen, comment]));
  return chess.history({ verbose: true }).map((jugada) => {
    const comentario = comentarios.get(jugada.after);
    return comentario === undefined ? null : leerReloj(comentario);
  });
}

export function parsePastedPgn(raw: string): PgnParseResult {
  const pgn = raw.trim();
  if (!pgn) return { ok: false, error: 'vacio' };

  const chess = cargar(pgn);
  if (!chess) {
    // chess.js lee una sola partida y rechaza el texto entero si trae más.
    // Decir "no es un PGN válido" era falso: es válido, lo que no se soporta
    // es más de una (B14). Antes de afirmarlo se exige que las dos primeras
    // carguen solas, para no tomar por otra partida la basura que siga al
    // resultado. No se cuentan: validarlas todas congelaría la pantalla con
    // una base entera, y contar sin validar podría sumar basura como partida.
    const partidas = separarPartidas(pgn);
    if (partidas.length > 1 && partidas.slice(0, 2).every((partida) => cargar(partida) !== null)) {
      return { ok: false, error: 'varias-partidas' };
    }
    return { ok: false, error: 'invalido' };
  }

  const plyCount = chess.history().length;
  if (plyCount === 0) return { ok: false, error: 'sin-jugadas' };

  const headers = chess.getHeaders();
  // Una partida que no arranca de la posición estándar se rechaza en la puerta.
  // El PGN se guarda como texto y todo lo que lo vuelve a reproducir —el
  // analizador del motor y la fase manual— parte de un `new Chess()` estándar,
  // así que aceptarla evalúa un tablero distinto del importado: si las jugadas
  // también son legales desde la posición normal el error es *silencioso*, y
  // Stockfish termina puntuando una partida que nadie jugó. Mejor un rechazo
  // explícito que un análisis falso. Levantar esto exige persistir el FEN raíz
  // y usarlo en reproducción, fase 1 y motor.
  if (posicionInicialNoEstandar(headers)) {
    return { ok: false, error: 'posicion-inicial-no-estandar' };
  }
  const whiteElo = parseElo(headers.WhiteElo);
  const blackElo = parseElo(headers.BlackElo);
  const playedAt = parsePlayedAt(headers.Date);
  const incrementoMs = leerTimeControl(headers.TimeControl)?.incrementoMs ?? null;
  return {
    ok: true,
    pgn,
    resultado: normalizeResultado(headers.Result),
    plyCount,
    tiemposPorJugadaMs: incrementoMs === null ? [] : tiemposDesdeRelojes(relojesPorJugada(chess), incrementoMs),
    ...(whiteElo !== undefined ? { whiteElo } : {}),
    ...(blackElo !== undefined ? { blackElo } : {}),
    ...(playedAt !== undefined ? { playedAt } : {}),
  };
}

/**
 * Encabezados del comienzo del texto, leídos sin reproducir las jugadas:
 * alcanza para el ritmo y para descartar candidatas al buscar repetidas, y es
 * mucho más barato que chess.js cuando hay que mirar todas las partidas.
 */
function leerEncabezados(texto: string): Record<string, string> {
  const encabezado = /\s*\[([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/y;
  const encabezados: Record<string, string> = {};
  for (let match = encabezado.exec(texto); match; match = encabezado.exec(texto)) {
    encabezados[match[1]] = match[2].trim();
  }
  return encabezados;
}

/**
 * Ritmo que declara el encabezado `TimeControl`, para prellenar el formulario
 * apenas se pega el PGN. Null si no lo trae o no se puede leer.
 */
export function ritmoDelPgn(texto: string): { ritmo: Ritmo; timeControl: string } | null {
  const timeControl = leerEncabezados(texto).TimeControl;
  const leido = leerTimeControl(timeControl);
  return leido && timeControl !== undefined ? { ritmo: leido.ritmo, timeControl } : null;
}

/**
 * Encabezados que distinguen dos partidas con las mismas jugadas: los siete
 * obligatorios del estándar y los que Lichess y Chess.com usan para ubicar una
 * partida (hora de inicio, enlace, identificador). Dos miniaturas idénticas
 * jugadas el mismo día contra el mismo rival se separan por hora o enlace.
 */
const ENCABEZADOS_DE_IDENTIDAD = [
  'Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'UTCDate', 'UTCTime', 'Link', 'GameId',
] as const;

function claveDeEncabezados(pgn: string): string {
  const encabezados = leerEncabezados(pgn);
  return JSON.stringify(ENCABEZADOS_DE_IDENTIDAD.map((nombre) => encabezados[nombre] ?? ''));
}

/**
 * Jugadas en SAN canónico: sin comentarios, relojes, variantes, NAGs, números
 * de jugada ni espacios, que cambian según cómo se exportó la misma partida.
 */
function jugadasNormalizadas(pgn: string): string | null {
  return cargar(pgn)?.history().join(' ') ?? null;
}

/**
 * ¿Esta partida ya está guardada? (B14) Importarla dos veces la contaba doble
 * en errores graves, sobreajuste, partida lenta de la semana y finales de tus
 * partidas. La identidad son las jugadas normalizadas más los encabezados que
 * la distinguen: el mismo PGN exportado con o sin relojes, evaluaciones o
 * comentarios es la misma partida; las mismas jugadas en otra fecha, otro
 * evento u otra hora son otra. Solo se reproducen las guardadas que coinciden
 * en encabezados, para no pasar todo el historial por chess.js.
 */
export function partidaYaGuardada(pgn: string, guardadas: readonly GameRecord[]): boolean {
  const clave = claveDeEncabezados(pgn);
  const candidatas = guardadas.filter((game) => claveDeEncabezados(game.pgn) === clave);
  if (candidatas.length === 0) return false;
  const jugadas = jugadasNormalizadas(pgn);
  return jugadas !== null && candidatas.some((game) => jugadasNormalizadas(game.pgn) === jugadas);
}
