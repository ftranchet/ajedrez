// Migración de respaldos importados (RF-14.2).
//
// **El problema que corrige.** `validateImportBundle` acepta cualquier esquema
// anterior al actual y la restauración escribía esos datos crudos en la base
// de la versión vigente. Las migraciones de Dexie (services/storage/db.ts) no
// los tocan: solo corren cuando cambia la versión de IndexedDB, y restaurar no
// la cambia. Un respaldo v17 entraba entero con sus intentos de cálculo en las
// tablas viejas —el Panel lee `calculoAttempts`, así que el historial parecía
// desaparecer—, sus análisis con pérdidas de decenas de miles de centipeones y
// sus partidas de diagnóstico contando como entrenamiento propio.
//
// **La regla.** Cada versión de esquema que transforma datos ya guardados
// necesita su paso acá, y el paso es una función pura sobre el paquete. Las
// migraciones de Dexie usan estas mismas funciones (no una copia): un respaldo
// v16 restaurado y una base v16 actualizada in situ tienen que terminar igual,
// y la única forma de garantizarlo es que sea el mismo código.
import type {
  CalculoAttempt,
  CompromisoAttempt,
  GameRecord,
  RadarAttempt,
  StoykoAttempt,
} from './types';
import { unificarIntentosDeCalculo } from './calculoMigracion';
import { classifyMoveLoss, computeCpLoss } from './analysis';
import { SCHEMA_VERSION } from './schemaVersion';

/**
 * Ventana hacia atrás desde `diagnosticoCompletadoEn` dentro de la cual una
 * partida local sin reloj se atribuye al diagnóstico (esquema v16). El
 * diagnóstico es una sola sentada (su pausa solo sobrevive mientras la pestaña
 * siga abierta), así que 12 horas es holgado y a la vez acotado.
 */
export const VENTANA_ATRIBUCION_DIAGNOSTICO_MS = 12 * 60 * 60 * 1000;

/** Cuántas partidas juega el diagnóstico: ni una más se le atribuye. */
const PARTIDAS_DEL_DIAGNOSTICO = 2;

function enVentana(iso: unknown, desde: number, hasta: number): boolean {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : Number.NaN;
  return Number.isFinite(t) && t >= desde && t <= hasta;
}

/** Milisegundos de `diagnosticoCompletadoEn`, o `null` si no es utilizable. */
export function cierreDelDiagnostico(completadoEn: string | null | undefined): number | null {
  if (!completadoEn) return null;
  const t = new Date(completadoEn).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Ids de las partidas que fueron del diagnóstico (esquema v16): locales, sin
 * reloj, terminadas dentro de la ventana y sin contexto asignado. Si hubiera
 * más candidatas —el usuario puede saltear el diagnóstico y jugar suelto antes
 * de volver—, se atribuyen las dos más cercanas al cierre y las demás quedan
 * como partidas propias.
 */
export function partidasDelDiagnostico(
  games: ReadonlyArray<Partial<GameRecord> & { id: string }>,
  cierre: number,
): Set<string> {
  const desde = cierre - VENTANA_ATRIBUCION_DIAGNOSTICO_MS;
  return new Set(
    games
      .filter(
        (game) =>
          game.contexto === undefined &&
          game.fuente === 'local' &&
          game.ritmo === 'sin-reloj' &&
          enVentana(game.fecha, desde, cierre),
      )
      .sort((a, b) => new Date(String(b.fecha)).getTime() - new Date(String(a.fecha)).getTime())
      .slice(0, PARTIDAS_DEL_DIAGNOSTICO)
      .map((game) => game.id),
  );
}

/**
 * Las respuestas del Radar del diagnóstico son las únicas anteriores al cierre
 * que no llevan dificultad normalizada: la sesión siempre la registra, salvo
 * en errores propios, que van marcados aparte (esquema v16).
 */
export function esRespuestaDelDiagnostico(attempt: Partial<RadarAttempt>, cierre: number): boolean {
  return (
    attempt.origenContenido === undefined &&
    attempt.dificultadNormalizada === undefined &&
    enVentana(attempt.fecha, cierre - VENTANA_ATRIBUCION_DIAGNOSTICO_MS, cierre)
  );
}

/**
 * Recalcula `cpPerdidos` y su clasificación de un análisis ya guardado
 * (esquema v19). El mate se codifica como ±100.000 centipeones para poder
 * ordenar, pero `cpPerdidos` lo restaba: una jugada que dejaba mate quedaba
 * guardada como una pérdida de 98.908 centipeones. `cpAntes`, `cpDespues` y
 * `ladoQueMueve` están persistidos, así que se recalcula sin motor.
 */
export function recalcularPerdidas(game: GameRecord): GameRecord {
  if (!game.analisis?.jugadas?.length) return game;
  return {
    ...game,
    analisis: {
      ...game.analisis,
      jugadas: game.analisis.jugadas.map((jugada) => {
        const cpPerdidos = computeCpLoss(jugada.cpAntes, jugada.cpDespues, jugada.ladoQueMueve);
        return { ...jugada, cpPerdidos, clasificacion: classifyMoveLoss(cpPerdidos) };
      }),
    },
  };
}

/** Lo que un paso de migración puede leer y reescribir del paquete. */
export interface DatosMigrables {
  games: GameRecord[];
  radarAttempts: RadarAttempt[];
  compromisoAttempts: CompromisoAttempt[];
  stoykoAttempts: StoykoAttempt[];
  calculoAttempts: CalculoAttempt[];
  profile?: { diagnosticoCompletadoEn?: string | null } | undefined;
}

export interface ContextoMigracion {
  /**
   * Soluciones del catálogo del Radar, para reconstruir los plies verificables
   * de un intento de línea comprometida. Si falta un ítem, la rama queda vacía
   * en vez de inventada (ver core/calculoMigracion.ts).
   */
  solucionPorItem?: Map<string, string[]>;
}

/**
 * Un paso de la cadena. `desde` es la versión que **produce**: se aplica a todo
 * paquete cuyo esquema sea menor.
 */
interface PasoMigracion {
  version: number;
  descripcion: string;
  aplicar: (datos: DatosMigrables, ctx: ContextoMigracion) => DatosMigrables;
}

const PASOS: PasoMigracion[] = [
  {
    version: 16,
    descripcion: 'atribución de las partidas y respuestas del diagnóstico',
    aplicar: (datos) => {
      const cierre = cierreDelDiagnostico(datos.profile?.diagnosticoCompletadoEn);
      // Sin diagnóstico cerrado no hay nada que atribuir: un respaldo de quien
      // nunca lo terminó pasa intacto.
      if (cierre === null) return datos;
      const delDiagnostico = partidasDelDiagnostico(datos.games, cierre);
      return {
        ...datos,
        games: datos.games.map((game) =>
          delDiagnostico.has(game.id) ? { ...game, contexto: 'diagnostico' as const } : game,
        ),
        radarAttempts: datos.radarAttempts.map((attempt) =>
          esRespuestaDelDiagnostico(attempt, cierre)
            ? { ...attempt, origenContenido: 'diagnostico' as const }
            : attempt,
        ),
      };
    },
  },
  {
    version: 18,
    descripcion: 'unificación de los intentos de cálculo',
    aplicar: (datos, ctx) => {
      const convertidos = unificarIntentosDeCalculo(
        datos.compromisoAttempts,
        datos.stoykoAttempts,
        ctx.solucionPorItem ?? new Map(),
      );
      // Un intento ya convertido gana sobre su conversión: si el respaldo trae
      // los dos (una base que migró y volvió a exportar antes de este arreglo),
      // el bueno es el que ya está en el formato nuevo.
      const yaPresentes = new Set(datos.calculoAttempts.map((intento) => intento.id));
      return {
        ...datos,
        // Las tablas viejas NO se vacían: son el original del que salió la
        // conversión y el usuario no perdió nada al restaurar. Retirarlas es
        // una decisión aparte, y solo después de que esta migración exista.
        calculoAttempts: [
          ...datos.calculoAttempts,
          ...convertidos.filter((intento) => !yaPresentes.has(intento.id)),
        ].sort((a, b) => a.fecha.localeCompare(b.fecha)),
      };
    },
  },
  {
    version: 19,
    descripcion: 'corrección de las pérdidas de centipeones imposibles',
    aplicar: (datos) => ({ ...datos, games: datos.games.map(recalcularPerdidas) }),
  },
];

export interface ResultadoMigracion<T extends DatosMigrables> {
  datos: T;
  /** Versiones aplicadas, en orden. Vacío si el paquete ya estaba al día. */
  aplicadas: number[];
}

/**
 * Lleva un paquete de `esquema` a `SCHEMA_VERSION` aplicando en orden los pasos
 * que le faltan. No valida: eso ya pasó (`validateImportBundle`). Un esquema
 * igual o mayor al actual devuelve los datos intactos —mayor lo rechaza antes
 * la validación—.
 */
export function migrarDatosImportados<T extends DatosMigrables>(
  datos: T,
  esquema: number,
  ctx: ContextoMigracion = {},
): ResultadoMigracion<T> {
  const aplicadas: number[] = [];
  let actuales = datos;
  for (const paso of PASOS) {
    if (esquema >= paso.version) continue;
    actuales = { ...actuales, ...paso.aplicar(actuales, ctx) };
    aplicadas.push(paso.version);
  }
  return { datos: actuales, aplicadas };
}

/**
 * Versiones de esquema que todavía saben migrarse. Se compara contra el mínimo
 * que la cadena cubre: por debajo, restaurar escribiría datos que ningún paso
 * sabe interpretar.
 */
export const ESQUEMA_MINIMO_MIGRABLE = 1;

export function esEsquemaMigrable(esquema: number): boolean {
  return esquema >= ESQUEMA_MINIMO_MIGRABLE && esquema <= SCHEMA_VERSION;
}
