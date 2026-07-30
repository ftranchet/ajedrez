// Cálculo declarado (E7, ADR-0015): un solo ejercicio en el que el usuario
// declara **lo que ve** antes de que el tablero se mueva, y dos varas para
// medirlo según el tipo de posición.
//
// Reemplaza la separación entre "línea comprometida" (RF-7.1) y "Stoyko"
// (RF-7.2), que no eran dos métodos sino dos cortes del mismo procedimiento:
// enumerar candidatas, calcular cada una hasta una posición evaluable, evaluar
// esas hojas y elegir. Un intento es un **árbol**: ramas, cada una con su línea
// y —cuando el preset la pide— su evaluación al final de la línea, no pegada a
// la jugada suelta.
//
// Las dos varas no se promedian nunca (ADR-0015, punto 3). En una posición con
// línea forzada verificada existe una respuesta correcta y el puntaje puede ser
// binario; en una posición sin respuesta única, un binario mide el tipo de
// posición servida más que el cálculo del usuario.
import type { EvalSymbol, RadarItem } from './types';

/** Profundidad que puede pedir el preset forzado (RF-7.1). */
export const PROFUNDIDAD_MIN = 3;
export const PROFUNDIDAD_MAX = 7;

/** Cuántas ramas pide el preset abierto (RF-7.2). */
export const RAMAS_MIN_ABIERTO = 2;
export const RAMAS_MAX_ABIERTO = 5;

/**
 * Qué se le pide al usuario en esta corrida. Lo que cambia entre presets no es
 * el método sino la dosis y el tipo de posición: `forzado` es corto y entra en
 * la lista de hoy cuando hay fuga de cálculo (RF-11.2); `abierto` es el
 * semanal, sin reloj (RF-11.3a).
 */
export type PresetCalculo = 'forzado' | 'abierto';

/**
 * Una rama declarada: la candidata (primer ply de `linea`) con la continuación
 * que el usuario calculó y, en el preset abierto, la evaluación de la posición
 * a la que llega esa línea.
 */
export interface RamaDeclarada {
  /** Jugadas en UCI, empezando por la candidata. Al menos una. */
  linea: string[];
  /** Evaluación de la hoja de la rama. Obligatoria en el preset abierto. */
  evaluacion?: EvalSymbol;
}

export const candidataDeRama = (rama: RamaDeclarada): string | undefined => rama.linea[0];

/** Resultado del preset forzado: la línea declarada contra la verificada. */
export interface ResultadoForzado {
  correcta: boolean;
  /** Índice 0-based del primer ply que no coincide; null si toda la línea coincide. */
  primerErrorEn: number | null;
}

/**
 * Resultado del preset abierto: tres números que se leen por separado y que
 * **no** se agregan entre sí (ADR-0015).
 */
export interface ResultadoAbierto {
  /** La mejor jugada del motor estuvo entre las candidatas declaradas. */
  cobertura: boolean;
  /** Plies de la variante principal del motor que el usuario declaró seguidos, desde la primera. */
  profundidadVista: number;
  /** Distancia entre la evaluación declarada para esa rama y la del motor, en pasos de la escala; null si no declaró ninguna. */
  brechaEvaluacion: number | null;
}

/** Compara una línea declarada contra la solución verificada del ítem (RF-7.1). */
export function evaluarForzado(item: Pick<RadarItem, 'solucion'>, rama: RamaDeclarada): ResultadoForzado {
  for (let i = 0; i < item.solucion.length; i++) {
    if (rama.linea[i] !== item.solucion[i]) return { correcta: false, primerErrorEn: i };
  }
  return { correcta: true, primerErrorEn: null };
}

/** Ítems del catálogo del Radar que sirven como posición del preset forzado:
 * su solución ya es una línea forzada verificada de la profundidad pedida. */
export function esAptoParaForzado(item: RadarItem): boolean {
  return item.solucion.length >= PROFUNDIDAD_MIN && item.solucion.length <= PROFUNDIDAD_MAX;
}

export function itemsParaForzado(pool: RadarItem[]): RadarItem[] {
  return pool.filter(esAptoParaForzado);
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
 * Puntúa un intento del preset abierto. La profundidad se mide sobre la rama
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

/** ¿La declaración está completa para el preset? Gobierna el botón de revelar. */
export function declaracionCompleta(preset: PresetCalculo, ramas: RamaDeclarada[], profundidadPedida: number): boolean {
  if (preset === 'forzado') {
    return ramas.length === 1 && ramas[0].linea.length >= profundidadPedida;
  }
  return (
    ramas.length >= RAMAS_MIN_ABIERTO &&
    ramas.length <= RAMAS_MAX_ABIERTO &&
    ramas.every((rama) => rama.linea.length >= 1 && rama.evaluacion !== undefined)
  );
}
