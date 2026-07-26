// Explicación por posición del Radar (RF-5.3).
//
// **El problema que corrige.** `explainFeedback` devolvía una sola frase fija
// por *tipo*: las 116 posiciones del catálogo compartían cinco textos. Fallabas
// una y leías "había una combinación ganadora que no se jugó" sin enterarte de
// cuál era, y el panel mostraba únicamente la primera jugada de una línea que
// muchas veces tiene cinco. Peor: la frase afirmaba cosas que no siempre eran
// ciertas de *esa* posición —"combinación ganadora" para un puzzle cuya
// solución gana un peón, "perdía material" sin decir dónde estaba la trampa—.
// El usuario lo resumió como "te explica de forma equivocada".
//
// **Qué se afirma acá y con qué respaldo.** Todo lo que este módulo dice sale
// de reproducir la línea sobre el tablero con chess.js: el mate es mate porque
// la posición final es mate, y el material es el que hay al terminar la línea,
// contado pieza por pieza. No hay ninguna estimación. Lo que el tablero *no*
// puede decidir —cuál de varias capturas es la carnada de una posición
// envenenada y qué la refuta— se calcula fuera de línea con el motor y viaja
// en el propio catálogo (`RadarItem.carnada`); si falta, no se inventa.
//
// **Lo que deliberadamente NO se afirma.** Cuando la línea termina con el
// solucionador *abajo* en material (un sacrificio cuya compensación llega
// después del corte de la línea, 8 posiciones del lote), no se dice nada sobre
// material: contar "perdés 3 peones" sería cierto sobre el tablero y falso
// sobre la partida. Se muestra la línea y se calla el resto.
import { Chess } from 'chess.js';
import type { RadarItem, TipoRadar } from './types';

/** Valor material convencional; el rey no se cuenta. */
const VALOR: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface AnalisisSolucion {
  /** La línea completa en SAN. Corta en la primera jugada ilegal. */
  lineaSan: string[];
  /** Jugadas del solucionador hasta el mate, o null si la línea no da mate. */
  mateEn: number | null;
  /**
   * Material del solucionador menos el del rival **al terminar la línea**,
   * menos el mismo balance en la posición inicial. Positivo = termina arriba.
   */
  materialPeones: number;
  /** Jugadas verificadas como equivalentes (solo tranquilas), en SAN. */
  equivalentesSan: string[];
  /** La jugada "familiar" del subtipo doble solución, en SAN. */
  familiarSan: string | null;
}

function balanceMaterial(chess: Chess, color: 'w' | 'b'): number {
  let propio = 0;
  let rival = 0;
  for (const fila of chess.board()) {
    for (const casilla of fila) {
      if (!casilla || casilla.type === 'k') continue;
      if (casilla.color === color) propio += VALOR[casilla.type];
      else rival += VALOR[casilla.type];
    }
  }
  return propio - rival;
}

/**
 * Aplica una jugada UCI. La pieza de promoción **importa**: en el lote
 * publicado, `lichess-004LZ` corona con `c2c1q` y, al ignorar la `q`, chess.js
 * devolvía primero `c1=N` — que da jaque y vuelve ilegal el resto de la línea.
 * Emparejar solo origen y destino cortaba esa solución a la mitad.
 */
function aplicar(chess: Chess, uci: string): string | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promocion = uci.slice(4, 5) || undefined;
  const candidatas = chess.moves({ verbose: true }).filter((m) => m.from === from && m.to === to);
  const jugada = promocion ? candidatas.find((m) => m.promotion === promocion) : candidatas[0];
  if (!jugada) return null;
  return chess.move(jugada).san;
}

function sanDeUci(fen: string, uci: string): string | null {
  return aplicar(new Chess(fen), uci);
}

const SIN_ANALISIS: AnalisisSolucion = {
  lineaSan: [],
  mateEn: null,
  materialPeones: 0,
  equivalentesSan: [],
  familiarSan: null,
};

/** Reproduce la solución sobre el tablero y devuelve solo hechos verificables. */
export function analizarSolucion(item: RadarItem): AnalisisSolucion {
  let chess: Chess;
  try {
    chess = new Chess(item.fen);
  } catch {
    // Un FEN inválido en el catálogo no puede dejar al usuario mirando una
    // pantalla rota a mitad de sesión: se degrada al texto genérico del tipo.
    return SIN_ANALISIS;
  }
  const solucionador = chess.turn() as 'w' | 'b';
  const balanceInicial = balanceMaterial(chess, solucionador);

  const lineaSan: string[] = [];
  for (const uci of item.solucion) {
    const san = aplicar(chess, uci);
    if (san === null) break; // línea parcial antes que un feedback roto
    lineaSan.push(san);
  }

  return {
    lineaSan,
    // Las jugadas del solucionador son las de índice par: la línea alterna.
    mateEn: chess.isCheckmate() ? Math.ceil(lineaSan.length / 2) : null,
    materialPeones: balanceMaterial(chess, solucionador) - balanceInicial,
    equivalentesSan: (item.jugadasAceptables ?? [])
      .map((uci) => sanDeUci(item.fen, uci))
      .filter((san): san is string => san !== null),
    familiarSan: item.dobleSolucion ? sanDeUci(item.fen, item.dobleSolucion.familiar) : null,
  };
}

/** "1.Dxh7+ Rxh7 2.Th3#", numerada desde la jugada real de la posición. */
export function formatearLinea(fen: string, lineaSan: string[]): string {
  if (lineaSan.length === 0) return '';
  const campos = fen.split(' ');
  const blancasMueven = campos[1] !== 'b';
  let numero = Number(campos[5]);
  if (!Number.isFinite(numero) || numero < 1) numero = 1;

  const partes: string[] = [];
  let turnoBlancas = blancasMueven;
  for (let i = 0; i < lineaSan.length; i++) {
    if (turnoBlancas) partes.push(`${numero}.${lineaSan[i]}`);
    else if (i === 0) partes.push(`${numero}...${lineaSan[i]}`);
    else partes.push(lineaSan[i]);
    if (!turnoBlancas) numero++;
    turnoBlancas = !turnoBlancas;
  }
  return partes.join(' ');
}

/**
 * Material en palabras. La pieza se nombra **solo cuando el número es
 * exactamente el suyo**: decir "una pieza" para 4 peones netos, o "un peón"
 * para 2, es impreciso justo en la afirmación que se está haciendo. Fuera de
 * esos valores gana el número.
 */
function nombreMaterial(peones: number): string {
  if (peones === 1) return 'un peón';
  if (peones === 3) return 'una pieza';
  if (peones === 5) return 'una torre';
  if (peones === 9) return 'una dama';
  return `${peones} peones`;
}

/**
 * Motivos tácticos con nombre. Solo se usan las etiquetas de Lichess que
 * describen un mecanismo concreto y verificable en la posición; las genéricas
 * (`crushing`, `advantage`, `short`, `middlegame`…) no dicen nada que el
 * usuario no vea, y las inventadas por el pipeline tampoco.
 */
const MOTIVOS: Record<string, string> = {
  // Patrones de mate con nombre propio: lo más específico que se puede decir.
  backRankMate: 'mate del pasillo',
  smotheredMate: 'mate de la coz',
  bodenMate: 'mate de Boden',
  operaMate: 'mate de la ópera',
  anastasiaMate: 'mate de Anastasia',
  arabianMate: 'mate árabe',
  hookMate: 'mate del gancho',
  doubleBishopMate: 'mate de los dos alfiles',
  pillsburysMate: 'mate de Pillsbury',
  dovetailMate: 'mate de la cola de milano',
  // Mecanismos tácticos.
  fork: 'horquilla',
  pin: 'clavada',
  skewer: 'enfilada',
  deflection: 'desviación',
  attraction: 'atracción',
  discoveredAttack: 'ataque a la descubierta',
  doubleCheck: 'jaque doble',
  clearance: 'despeje',
  interference: 'interferencia',
  intermezzo: 'jugada intermedia',
  xRayAttack: 'ataque en rayos X',
  capturingDefender: 'captura del defensor',
  zugzwang: 'zugzwang',
  underPromotion: 'subpromoción',
  trappedPiece: 'pieza atrapada',
  // Rasgos de la posición: útiles, pero solo si no hay nada más filoso.
  hangingPiece: 'pieza colgada',
  advancedPawn: 'peón avanzado',
  exposedKing: 'rey expuesto',
  sacrifice: 'sacrificio',
};

/**
 * Motivos ordenados de más a menos específico, tal como aparecen en `MOTIVOS`
 * (los objetos de JS conservan el orden de inserción de las claves de texto).
 * Sin este orden, "mate de Boden y pieza colgada" empezaba por lo genérico.
 */
const ORDEN_MOTIVOS = Object.keys(MOTIVOS);

/**
 * Motivos que el tipo ya declara y repetirlos sería ruido: una posición de
 * defensa no gana nada con "el mecanismo: recurso defensivo", y una tranquila
 * tampoco con "jugada tranquila".
 */
const IMPLICITOS: Partial<Record<TipoRadar, string[]>> = {
  defensa: ['defensiveMove'],
  tranquila: ['quietMove'],
  genuina: ['hangingPiece'],
};

export function motivosConNombre(item: RadarItem): string[] {
  const implicitos = IMPLICITOS[item.tipo] ?? [];
  return item.temas
    .filter((tema) => MOTIVOS[tema] !== undefined && !implicitos.includes(tema))
    .sort((a, b) => ORDEN_MOTIVOS.indexOf(a) - ORDEN_MOTIVOS.indexOf(b))
    .map((tema) => MOTIVOS[tema]);
}

/** Cuántas jugadas equivalentes se enumeran antes de resumir el resto. */
const MAX_EQUIVALENTES = 3;

/**
 * Enumera unas pocas y resume el resto. Una posición del lote tiene 23 jugadas
 * equivalentes verificadas: listarlas todas convertía la explicación en una
 * pared de notación que nadie lee.
 */
function listaCorta(jugadas: string[]): string {
  if (jugadas.length <= MAX_EQUIVALENTES) return jugadas.join(' y ');
  const restantes = jugadas.length - MAX_EQUIVALENTES;
  return `${jugadas.slice(0, MAX_EQUIVALENTES).join(', ')} y otras ${restantes}`;
}

/** Frase genérica por tipo: el piso cuando no hay nada específico que decir. */
const GENERICA_ACIERTO: Record<TipoRadar, string> = {
  ofensiva: 'Encontraste el golpe táctico.',
  defensa: 'Encontraste el recurso defensivo.',
  tranquila: 'No había ninguna táctica y elegiste una jugada sólida en lugar de forzar algo que no estaba. Eso también es acertar.',
  genuina: 'La oferta era real: capturar ganaba material limpio, sin ninguna trampa detrás.',
  envenenada: 'Detectaste la trampa y declinaste la captura.',
};

const GENERICA_FALLO: Record<TipoRadar, string> = {
  ofensiva: 'Había un golpe táctico que no se jugó.',
  defensa: 'Esta posición exigía un recurso defensivo; otra jugada dejaba pasar la amenaza.',
  tranquila: 'No había ninguna táctica acá: la posición pedía una jugada sólida y tranquila, no forzar una combinación que no existía.',
  genuina: 'La oferta era genuina — no había trampa. No capturar dejó pasar material gratis.',
  envenenada: 'Era una trampa: había que declinar la captura.',
};

/** Lo que consiguió la línea, dicho solo cuando el tablero lo respalda. */
function fraseDesenlace(analisis: AnalisisSolucion): string | null {
  if (analisis.mateEn !== null) {
    return analisis.mateEn === 1 ? 'Es mate en una.' : `La línea fuerza mate en ${analisis.mateEn}.`;
  }
  // Un balance negativo NO se reporta: la línea del catálogo se corta cuando la
  // ventaja ya es clara, y en un sacrificio la compensación llega después del
  // corte. Decir "perdés una pieza" sería cierto del tablero y falso del juego.
  if (analisis.materialPeones > 0) {
    return `Al terminar la línea quedás ${nombreMaterial(analisis.materialPeones)} arriba.`;
  }
  return null;
}

/**
 * Centinela de mate en `carnada.costoCp` (mismo valor que core/engineLevels.ts):
 * la carnada no cuesta material, cuesta un mate forzado.
 */
const CP_MATE = 100_000;

function fraseCarnada(item: RadarItem, analisis: AnalisisSolucion): string | null {
  if (!item.carnada) return null;
  const { san, ganaPeones, refutacionSan, costoCp } = item.carnada;
  const cebo =
    ganaPeones >= 3
      ? `${san} parece ganar ${nombreMaterial(ganaPeones)} gratis`
      : `${san} parece ganar material`;

  // Hay dos trampas distintas y decir "perdía material" en la segunda sería
  // falso: en una, capturar cuesta material; en otra, capturar tira un mate
  // que ya estaba. El costo medido distingue las dos.
  if (costoCp >= CP_MATE && analisis.mateEn !== null) {
    return `${cebo}, pero tira el mate que ya estaba en la posición.`;
  }
  if (refutacionSan.length === 0) return `${cebo}, pero es la carnada: el motor la condena.`;
  return `${cebo}, pero es la carnada: sigue ${refutacionSan.join(' ')}.`;
}

/**
 * Texto de feedback de una posición concreta (RF-5.3).
 *
 * Se compone de frases independientes, cada una con su propio respaldo, y se
 * omite la que no lo tenga. En el peor caso —una posición sin mate, sin
 * material y sin motivo con nombre— queda la frase genérica del tipo, que es
 * exactamente lo que había antes: esto nunca explica *menos* que la versión
 * anterior.
 */
export function explicarPosicion(item: RadarItem, acierto: boolean): string {
  const analisis = analizarSolucion(item);
  const partes: string[] = [];

  if (item.tipo === 'tranquila') {
    partes.push(acierto ? GENERICA_ACIERTO.tranquila : GENERICA_FALLO.tranquila);
    if (analisis.equivalentesSan.length > 0) {
      const [principal] = analisis.lineaSan;
      // Sin esto, ver "Jugada correcta: Ce5" después de haber jugado Ah3 —que
      // el pipeline verificó como equivalente— se lee como si Ah3 estuviera
      // mal. La aclaración es la definición misma de "tranquila".
      partes.push(
        `El motor prefiere ${principal}, pero ${listaCorta(analisis.equivalentesSan)} ${
          analisis.equivalentesSan.length > 1 ? 'también valían' : 'también valía'
        }: en una posición tranquila varias jugadas son prácticamente equivalentes.`,
      );
    }
    return partes.join(' ');
  }

  if (item.tipo === 'envenenada') {
    const carnada = fraseCarnada(item, analisis);
    partes.push(carnada ?? (acierto ? GENERICA_ACIERTO.envenenada : GENERICA_FALLO.envenenada));
    if (analisis.lineaSan.length > 0) {
      partes.push(`Lo correcto era declinar con ${formatearLinea(item.fen, analisis.lineaSan)}.`);
    }
    const remate = fraseDesenlace(analisis);
    // No se repite el mate si la frase de la carnada ya lo nombró.
    if (remate && !(analisis.mateEn !== null && carnada?.includes('mate'))) partes.push(remate);
    return partes.join(' ');
  }

  const desenlace = fraseDesenlace(analisis);
  const motivos = motivosConNombre(item);

  if (desenlace) partes.push(desenlace);
  else partes.push(acierto ? GENERICA_ACIERTO[item.tipo] : GENERICA_FALLO[item.tipo]);

  if (item.tipo === 'defensa' && desenlace) {
    partes.push('Era el recurso defensivo que la posición exigía.');
  }
  if (motivos.length > 0) {
    partes.push(`El mecanismo: ${motivos.slice(0, 2).join(' y ')}.`);
  }
  if (analisis.familiarSan) {
    partes.push(
      `Ojo: ${analisis.familiarSan} también gana, pero ${analisis.lineaSan[0]} es objetivamente mejor.`,
    );
  }
  return partes.join(' ');
}

/** La línea completa lista para mostrar, o vacío si no hay nada que mostrar. */
export function lineaParaMostrar(item: RadarItem): string {
  return formatearLinea(item.fen, analizarSolucion(item).lineaSan);
}
