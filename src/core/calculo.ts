// Cálculo declarado (E7, ADR-0015 y ADR-0016): **un solo ejercicio**, sin
// presets, en el que el usuario declara lo que ve antes de que el tablero se
// mueva. Un intento es un **árbol**: ramas, cada una con su línea y su
// evaluación al final de la línea, no pegada a la jugada suelta.
//
// El ADR-0015 unificó "línea comprometida" (RF-7.1) y "Stoyko" (RF-7.2) en un
// modelo de datos con dos presets; el ADR-0016 sacó el preset forzado, que no
// tenía contenido propio —servía posiciones del catálogo del Radar— y cuya
// mecánica es el caso "una rama, sin evaluación" de este mismo ejercicio. El
// valor `'forzado'` sobrevive solo como dato ya guardado (RF-7.1b): se lee, se
// exporta y se muestra como historial, y nada nuevo lo escribe.
//
// Las tres varas no se promedian nunca (ADR-0015, punto 3): en una posición sin
// respuesta única un binario mide el tipo de posición servida más que el
// cálculo del usuario.
import type { EvalSymbol } from './types';

/** Cuántas ramas pide el ejercicio (RF-7.1). */
export const RAMAS_MIN_ABIERTO = 2;
export const RAMAS_MAX_ABIERTO = 5;

/**
 * Cuántas ramas tienen que traer **línea**, no solo la
 * candidata. Cargar cinco líneas de cuatro plies en un celular es una carga de
 * datos, no un ejercicio de ajedrez: se pide la línea en las dos primeras —las
 * que el usuario considera de verdad— y el resto entran como candidata suelta
 * con su evaluación, que es lo que sostiene la amplitud. La profundidad se
 * mide igual sobre la rama que empiece por la mejor jugada del motor, así que
 * quien calcule más profundo lo ve reflejado sin que el formulario lo exija.
 */
export const RAMAS_CON_LINEA = 2;

/**
 * Mínimo para que algo cuente como línea y no como jugada suelta: tu jugada y
 * la respuesta que esperás. Con un solo ply no hay cálculo declarado, hay una
 * intención. No hay tope: la profundidad declarada es justamente lo que se mide.
 */
export const PLIES_MIN_LINEA = 2;

/**
 * Una rama declarada: la candidata (primer ply de `linea`) con la continuación
 * que el usuario calculó y la evaluación de la posición a la que llega esa
 * línea.
 */
export interface RamaDeclarada {
  /** Jugadas en UCI, empezando por la candidata. Al menos una. */
  linea: string[];
  /** Evaluación de la hoja de la rama. Obligatoria en toda rama cerrada. */
  evaluacion?: EvalSymbol;
}

export const candidataDeRama = (rama: RamaDeclarada): string | undefined => rama.linea[0];

/**
 * Resultado del ejercicio: tres números que se leen por separado y que **no**
 * se agregan entre sí (ADR-0015, punto 3).
 */
export interface ResultadoAbierto {
  /** La mejor jugada del motor estuvo entre las candidatas declaradas. */
  cobertura: boolean;
  /** Plies de la variante principal del motor que el usuario declaró seguidos, desde la primera. */
  profundidadVista: number;
  /** Distancia entre la evaluación declarada para esa rama y la del motor, en pasos de la escala; null si no declaró ninguna. */
  brechaEvaluacion: number | null;
}

/** Orden de la escala de evaluación, para medir distancias entre símbolos. */
const ESCALA: EvalSymbol[] = ['-+', '∓', '=', '±', '+-'];

/**
 * Distancia entre dos evaluaciones, en pasos de la escala de cinco valores:
 * 0 es coincidir, 4 es haber leído la posición al revés. Es la unidad de la
 * brecha de evaluación, que es lo que este ejercicio entrena de verdad (E10) y
 * hasta ahora se recogía y se descartaba.
 */
export function distanciaEvaluacion(declarada: EvalSymbol, motor: EvalSymbol): number {
  return Math.abs(ESCALA.indexOf(declarada) - ESCALA.indexOf(motor));
}

export interface EntradaAbierto {
  /** Variante principal del motor en UCI: la referencia de profundidad. */
  lineaMotor: string[];
  /** Evaluación del motor de la posición servida, en la misma escala que declara el usuario. */
  evaluacionMotor: EvalSymbol;
}

/**
 * Puntúa un intento. La profundidad se mide sobre la rama
 * que empieza por la mejor jugada del motor —es la única comparable con su
 * variante principal—; si el usuario no la tuvo entre sus candidatas, la
 * profundidad vista es 0 y la brecha se toma de la rama que él consideró
 * mejor para su lado, que es la que revela su criterio.
 */
export function evaluarAbierto(entrada: EntradaAbierto, ramas: RamaDeclarada[]): ResultadoAbierto {
  const mejorMotor = entrada.lineaMotor[0];
  const ramaDeLaMejor = ramas.find((rama) => candidataDeRama(rama) === mejorMotor);
  const cobertura = ramaDeLaMejor !== undefined;

  let profundidadVista = 0;
  if (ramaDeLaMejor) {
    while (
      profundidadVista < entrada.lineaMotor.length &&
      ramaDeLaMejor.linea[profundidadVista] === entrada.lineaMotor[profundidadVista]
    ) {
      profundidadVista += 1;
    }
  }

  const ramaParaBrecha = ramaDeLaMejor?.evaluacion !== undefined
    ? ramaDeLaMejor
    : ramas.find((rama) => rama.evaluacion !== undefined);
  const brechaEvaluacion = ramaParaBrecha?.evaluacion !== undefined
    ? distanciaEvaluacion(ramaParaBrecha.evaluacion, entrada.evaluacionMotor)
    : null;

  return { cobertura, profundidadVista, brechaEvaluacion };
}

/** ¿Esta rama tiene que traer línea, por su posición en la lista? */
export function ramaPideLinea(indice: number): boolean {
  return indice < RAMAS_CON_LINEA;
}

/** ¿La declaración está completa? Gobierna el botón de revelar. */
export function declaracionCompleta(ramas: RamaDeclarada[]): boolean {
  if (ramas.length < RAMAS_MIN_ABIERTO || ramas.length > RAMAS_MAX_ABIERTO) return false;
  return ramas.every((rama, indice) => {
    const pliesMinimos = ramaPideLinea(indice) ? PLIES_MIN_LINEA : 1;
    return rama.linea.length >= pliesMinimos && rama.evaluacion !== undefined;
  });
}
