// Cálculo comprometido (E7, RF-7.1): el usuario declara su línea completa
// (3 a 7 plies) antes de que el tablero se mueva — nunca antes, para que la
// consigna sea real. Reutiliza el catálogo del Radar, ya verificado.
import { create } from 'zustand';
import type { RadarItem } from '../../core/types';
import { evaluarLinea, itemsParaCompromiso, type ResultadoCompromiso } from '../../core/compromiso';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { compromisoAttemptRepo } from '../../services/storage/compromisoAttemptRepo';
import { sanDeLinea } from './chessBoardUtils';

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

type Phase = 'cargando' | 'sinContenido' | 'jugando' | 'feedback';

interface CompromisoState {
  phase: Phase;
  pool: RadarItem[];
  item: RadarItem | null;
  lineaIngresada: string[];
  /** Línea del usuario convertida a SAN, para mostrarla en el feedback junto a la solución. */
  lineaUsuarioSan: string[];
  lineaSolucionSan: string[];
  inputActual: string;
  inputError: string | null;
  resultado: ResultadoCompromiso | null;
  /** Marca de tiempo al servir el ítem, para el cronómetro silencioso (RF-7.3: nunca visible). */
  inicioMs: number | null;

  empezar(): Promise<void>;
  setInputActual(value: string): void;
  agregarJugada(): void;
  borrarUltima(): void;
  siguiente(): void;
}

export const useCompromisoStore = create<CompromisoState>((set, get) => {
  function elegirItem() {
    const s = get();
    if (s.pool.length === 0) {
      set({ phase: 'sinContenido', item: null });
      return;
    }
    const item = s.pool[Math.floor(Math.random() * s.pool.length)];
    set({
      phase: 'jugando',
      item,
      lineaIngresada: [],
      lineaUsuarioSan: [],
      lineaSolucionSan: [],
      inputActual: '',
      inputError: null,
      resultado: null,
      inicioMs: Date.now(),
    });
  }

  return {
    phase: 'cargando',
    pool: [],
    item: null,
    lineaIngresada: [],
    lineaUsuarioSan: [],
    lineaSolucionSan: [],
    inputActual: '',
    inputError: null,
    resultado: null,
    inicioMs: null,

    async empezar() {
      set({ phase: 'cargando' });
      await radarItemRepo.ensureSeeded();
      const todos = await radarItemRepo.list();
      const pool = itemsParaCompromiso(todos);
      set({ pool });
      elegirItem();
    },

    setInputActual(value) {
      set({ inputActual: value, inputError: null });
    },

    agregarJugada() {
      const s = get();
      if (s.phase !== 'jugando' || !s.item) return;
      const jugada = s.inputActual.trim().toLowerCase();
      if (!UCI_RE.test(jugada)) {
        set({ inputError: 'Formato inválido — usá casilla de origen y destino, p. ej. e2e4.' });
        return;
      }
      const lineaIngresada = [...s.lineaIngresada, jugada];
      set({ lineaIngresada, inputActual: '', inputError: null });

      if (lineaIngresada.length < s.item.solucion.length) return;

      // Línea completa: recién ahora se revela y se puntúa entera (RF-7.1).
      const item = s.item;
      const resultado = evaluarLinea(item, lineaIngresada);
      const lineaUsuarioSan = sanDeLinea(item.fen, lineaIngresada);
      const lineaSolucionSan = sanDeLinea(item.fen, item.solucion);
      set({ phase: 'feedback', resultado, lineaUsuarioSan, lineaSolucionSan });
      void compromisoAttemptRepo.save({
        id: crypto.randomUUID(),
        itemId: item.id,
        profundidad: item.solucion.length,
        correcta: resultado.correcta,
        primerErrorEn: resultado.primerErrorEn,
        tiempoMs: s.inicioMs !== null ? Date.now() - s.inicioMs : undefined,
        fecha: new Date().toISOString(),
      });
    },

    borrarUltima() {
      const s = get();
      if (s.phase !== 'jugando' || s.lineaIngresada.length === 0) return;
      set({ lineaIngresada: s.lineaIngresada.slice(0, -1) });
    },

    siguiente() {
      elegirItem();
    },
  };
});
