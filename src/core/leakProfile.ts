// Perfil de fugas por tipo de posición del Radar (RF-11.4: el diagnóstico
// produce "banda de Elo y perfil de fugas"). Hasta ahora el diagnóstico
// guardaba solo la banda, y el acierto por tipo —que ya se persistía en
// `radarAttempts`— no lo leía nadie. Este módulo lo convierte en la lectura
// accionable que el informe post-diagnóstico necesita.
//
// La honestidad estadística importa acá más que en otros lados: 20 posiciones
// repartidas entre cinco tipos dejan ~4 observaciones por tipo. Con esa base
// se puede señalar una tendencia, nunca afirmar una debilidad medida. Por eso
// `fugasPrincipales` exige un mínimo de observaciones, una tasa efectivamente
// baja y una separación clara del resto antes de nombrar una fuga; si nada
// califica devuelve vacío, y quien lo consume tiene que decir "todavía no hay
// señal" en vez de inventar una.
import type { PerfilDeFugas, RadarAttempt, TipoRadar } from './types';

export const TIPOS_RADAR: TipoRadar[] = ['ofensiva', 'defensa', 'tranquila', 'genuina', 'envenenada'];

/** Observaciones mínimas de un tipo para que su tasa se pueda leer como algo. */
export const MIN_OBSERVACIONES_FUGA = 3;
/** Techo de acierto por debajo del cual un tipo puede considerarse fuga. */
const TASA_MAXIMA_FUGA = 0.5;
/** Cuánto tiene que quedar por debajo del promedio propio para separarse del ruido. */
const SEPARACION_MINIMA = 0.15;
/** No se nombran más de dos fugas: una lista larga deja de ser una prioridad. */
const MAX_FUGAS = 2;

/**
 * Conteos por tipo a partir de respuestas del Radar. Se guardan crudos
 * (aciertos/total) y no una conclusión: el criterio para llamar "fuga" a un
 * tipo vive en `fugasPrincipales` y puede cambiar sin migrar datos del usuario.
 * Los tipos sin ninguna observación se omiten en vez de guardarse en 0/0.
 */
export function perfilDeFugasDesdeIntentos(attempts: Pick<RadarAttempt, 'tipo' | 'acierto'>[], now: Date = new Date()): PerfilDeFugas {
  const porTipo = TIPOS_RADAR.map((tipo) => {
    const delTipo = attempts.filter((attempt) => attempt.tipo === tipo);
    return { tipo, aciertos: delTipo.filter((attempt) => attempt.acierto).length, total: delTipo.length };
  }).filter((entry) => entry.total > 0);
  return { porTipo, registradoEn: now.toISOString() };
}

export interface LecturaFuga {
  tipo: TipoRadar;
  aciertos: number;
  total: number;
  /** Proporción de acierto, 0–1. */
  tasa: number;
}

/** Lectura del perfil ordenada de peor a mejor acierto, para mostrarlo entero. */
export function lecturaPerfilDeFugas(perfil: PerfilDeFugas | undefined): LecturaFuga[] {
  if (!perfil) return [];
  return perfil.porTipo
    .filter((entry) => entry.total > 0)
    .map((entry) => ({ ...entry, tasa: entry.aciertos / entry.total }))
    .sort((a, b) => a.tasa - b.tasa || b.total - a.total);
}

/** Acierto global del perfil, 0–1; null si no hay ninguna observación. */
export function tasaGlobalPerfil(perfil: PerfilDeFugas | undefined): number | null {
  if (!perfil) return null;
  const total = perfil.porTipo.reduce((sum, entry) => sum + entry.total, 0);
  if (total === 0) return null;
  return perfil.porTipo.reduce((sum, entry) => sum + entry.aciertos, 0) / total;
}

/**
 * Los tipos que hoy se pueden señalar como fuga: acierto bajo en términos
 * absolutos **y** claramente por debajo del promedio del propio usuario, con
 * observaciones suficientes. Vacío significa "todavía no hay una fuga clara",
 * que es una respuesta legítima con 20 posiciones — no un caso a rellenar.
 */
export function fugasPrincipales(perfil: PerfilDeFugas | undefined): LecturaFuga[] {
  const global = tasaGlobalPerfil(perfil);
  if (global === null) return [];
  return lecturaPerfilDeFugas(perfil)
    .filter(
      (entry) =>
        entry.total >= MIN_OBSERVACIONES_FUGA &&
        entry.tasa <= TASA_MAXIMA_FUGA &&
        entry.tasa <= global - SEPARACION_MINIMA,
    )
    .slice(0, MAX_FUGAS);
}
