// Entidades núcleo del dominio (PRD §9). core/ es dominio puro: sin React,
// sin Dexie, sin fetch (CONTRIBUTING regla 4).

export type Fuente = 'local' | 'lichess' | 'chesscom' | 'manual';
export type Ritmo = 'bullet' | 'blitz' | 'rapida' | 'clasica' | 'sin-reloj';
export type Resultado = '1-0' | '0-1' | '1/2-1/2' | '*';
export type Color = 'w' | 'b';

export interface GameRecord {
  id: string;
  pgn: string;
  fuente: Fuente;
  ritmo: Ritmo;
  resultado: Resultado;
  /** Milisegundos consumidos por cada media jugada, en orden (RF-1.5). */
  tiemposPorJugadaMs: number[];
  analizada: boolean;
  /** Fecha de la partida en ISO 8601. */
  fecha: string;
}
