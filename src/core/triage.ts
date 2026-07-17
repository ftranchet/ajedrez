// Triage de reloj (E9): perfil de gestión de tiempo del usuario a partir de
// sus propias partidas analizadas (RF-9.1), y el ejercicio de decisión
// rápida "¿calcular en profundidad o ya alcanza?" (RF-9.2), que recicla el
// contenido ya verificado del Radar (E5) en vez de pedir uno nuevo: los
// tipos ofensiva/defensa/envenenada exigen vigilancia táctica, tranquila/
// genuina premian no forzar nada.
import type { Color, GameAnalysis, GameRecord, MoveClassification, TipoRadar } from './types';

const UMBRAL_RAPIDA = 0.5; // por debajo de la mitad de la mediana del usuario en esa partida
const UMBRAL_LENTA = 2; // por encima del doble
const COSTOSAS: MoveClassification[] = ['grave', 'error'];

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[mitad - 1] + ordenados[mitad]) / 2 : ordenados[mitad];
}

export interface PerfilDeTiempo {
  /** Proporción de jugadas lentas (relativas a la mediana propia) que igual salieron bien: tiempo gastado sin necesidad. */
  sobregasto: number;
  /** Proporción de jugadas rápidas que resultaron grave/error: apuro que costó. */
  infragasto: number;
  jugadasConsideradas: number;
}

interface PartidaConTiempo {
  jugadorColor: Color;
  tiemposPorJugadaMs: number[];
  analisis: GameAnalysis;
}

/**
 * Perfil de tiempo (RF-9.1): solo entran partidas locales con
 * `jugadorColor` conocido y ya analizadas (E3) — sin eso no hay con qué
 * separar las jugadas del usuario de las del motor, ni clasificarlas. Null
 * si todavía no hay ninguna partida así.
 */
export function perfilDeTiempo(games: GameRecord[]): PerfilDeTiempo | null {
  const partidas = games.filter(
    (g): g is GameRecord & PartidaConTiempo => g.jugadorColor !== undefined && g.analisis !== undefined && g.tiemposPorJugadaMs.length > 0,
  );

  const jugadas: Array<{ relativo: number; clasificacion: MoveClassification }> = [];
  for (const p of partidas) {
    const propias = p.analisis.jugadas
      .map((entry, ply) => ({ entry, tiempo: p.tiemposPorJugadaMs[ply] }))
      .filter(({ entry, tiempo }) => entry.ladoQueMueve === p.jugadorColor && tiempo !== undefined);
    if (propias.length === 0) continue;
    const medianaPartida = mediana(propias.map((p2) => p2.tiempo as number));
    if (medianaPartida === 0) continue;
    for (const { entry, tiempo } of propias) {
      jugadas.push({ relativo: (tiempo as number) / medianaPartida, clasificacion: entry.clasificacion });
    }
  }
  if (jugadas.length === 0) return null;

  const rapidas = jugadas.filter((j) => j.relativo <= UMBRAL_RAPIDA);
  const lentas = jugadas.filter((j) => j.relativo >= UMBRAL_LENTA);
  const infragasto = rapidas.length > 0 ? rapidas.filter((j) => COSTOSAS.includes(j.clasificacion)).length / rapidas.length : 0;
  const sobregasto = lentas.length > 0 ? lentas.filter((j) => !COSTOSAS.includes(j.clasificacion)).length / lentas.length : 0;

  return { sobregasto, infragasto, jugadasConsideradas: jugadas.length };
}

/** Umbral a partir del cual el perfil de tiempo cuenta como una fuga (RF-9.3, RF-11.2). */
export const UMBRAL_FUGA_TIEMPO = 0.35;

export function hayFugaDeTiempo(perfil: PerfilDeTiempo | null): boolean {
  if (!perfil) return false;
  return perfil.infragasto > UMBRAL_FUGA_TIEMPO || perfil.sobregasto > UMBRAL_FUGA_TIEMPO;
}

// --- RF-9.2: decisión rápida sobre contenido del Radar ---

const NECESITA_CALCULO: Record<TipoRadar, boolean> = {
  ofensiva: true,
  defensa: true,
  envenenada: true,
  tranquila: false,
  genuina: false,
};

export type DecisionTriage = 'calcular' | 'alcanza';

/** ¿La posición de este tipo del Radar exige cálculo profundo, o alcanza con una jugada sólida? (RF-9.2). */
export function decisionCorrecta(tipo: TipoRadar): DecisionTriage {
  return NECESITA_CALCULO[tipo] ? 'calcular' : 'alcanza';
}
