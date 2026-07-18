// Ejercicio de Stoyko semanal (E7, RF-7.2): ante una posición rica y sin
// reloj, el usuario anota todas las jugadas candidatas que consideraría —
// cada una con su evaluación — antes de comparar con la línea del motor.
// Simplificación v1 documentada: "líneas candidatas" (RF-7.2) se toma como
// jugadas candidatas (el primer ply de cada una), cada una con su
// evaluación — captura el espíritu del ejercicio (enumerar todo lo que se
// consideraría) sin la complejidad de ramificar cada candidata en una línea
// propia. El tablero nunca se mueve mientras se anota (mismo dispositivo que
// Cálculo comprometido, RF-7.1) y el tiempo se registra en silencio, sin
// cronómetro visible (RF-7.3).
import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { EvalSymbol, StoykoItem } from '../../core/types';
import { stoykoAcierto, stoykoDisponible, stoykoProximaDisponibleEn, type Candidata } from '../../core/stoyko';
import { stoykoItemRepo } from '../../services/storage/stoykoItemRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { sanDeLinea } from './chessBoardUtils';
import { t } from '../i18n/es';

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

type Phase = 'cargando' | 'sinContenido' | 'enfriamiento' | 'analizando' | 'confianza' | 'revelado';

interface StoykoState {
  phase: Phase;
  pool: StoykoItem[];
  item: StoykoItem | null;
  proximaDisponibleEn: string | null;
  candidatas: Candidata[];
  inputActual: string;
  evalSeleccionada: EvalSymbol;
  inputError: string | null;
  confianza: number | null;
  acierto: boolean | null;
  lineaMotorSan: string[];
  inicioMs: number | null;

  empezar(): Promise<void>;
  setInputActual(value: string): void;
  setEvalSeleccionada(value: EvalSymbol): void;
  agregarCandidata(): void;
  quitarCandidata(index: number): void;
  terminarAnalisis(): void;
  confirmarConfianza(valor: number): Promise<void>;
}

export const useStoykoStore = create<StoykoState>((set, get) => ({
  phase: 'cargando',
  pool: [],
  item: null,
  proximaDisponibleEn: null,
  candidatas: [],
  inputActual: '',
  evalSeleccionada: '=',
  inputError: null,
  confianza: null,
  acierto: null,
  lineaMotorSan: [],
  inicioMs: null,

  async empezar() {
    set({ phase: 'cargando' });
    const profile = await profileRepo.get();
    if (!stoykoDisponible(profile)) {
      set({ phase: 'enfriamiento', proximaDisponibleEn: stoykoProximaDisponibleEn(profile) });
      return;
    }
    await stoykoItemRepo.ensureSeeded();
    const pool = await stoykoItemRepo.list();
    if (pool.length === 0) {
      set({ phase: 'sinContenido', pool });
      return;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    set({
      phase: 'analizando',
      pool,
      item,
      candidatas: [],
      inputActual: '',
      evalSeleccionada: '=',
      inputError: null,
      confianza: null,
      acierto: null,
      lineaMotorSan: [],
      inicioMs: Date.now(),
    });
  },

  setInputActual(value) {
    set({ inputActual: value, inputError: null });
  },

  setEvalSeleccionada(value) {
    set({ evalSeleccionada: value });
  },

  agregarCandidata() {
    const s = get();
    if (s.phase !== 'analizando' || !s.item) return;
    const jugada = s.inputActual.trim().toLowerCase();
    if (!UCI_RE.test(jugada)) {
      set({ inputError: t.calculo.errorFormato });
      return;
    }
    const chess = new Chess(s.item.fen);
    const legales = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    if (!legales.includes(jugada)) {
      set({ inputError: t.stoyko.errorIlegal });
      return;
    }
    if (s.candidatas.some((c) => c.jugada === jugada)) {
      set({ inputError: t.stoyko.errorDuplicada });
      return;
    }
    set({
      candidatas: [...s.candidatas, { jugada, evaluacion: s.evalSeleccionada }],
      inputActual: '',
      inputError: null,
    });
  },

  quitarCandidata(index) {
    const s = get();
    if (s.phase !== 'analizando') return;
    set({ candidatas: s.candidatas.filter((_, i) => i !== index) });
  },

  terminarAnalisis() {
    const s = get();
    if (s.phase !== 'analizando' || s.candidatas.length === 0) return;
    set({ phase: 'confianza' });
  },

  async confirmarConfianza(valor) {
    const s = get();
    if (s.phase !== 'confianza' || !s.item) return;
    const item = s.item;
    const acierto = stoykoAcierto(item, s.candidatas);
    const lineaMotorSan = sanDeLinea(item.fen, item.mejorLinea);
    set({ phase: 'revelado', confianza: valor, acierto, lineaMotorSan });

    const ahora = new Date().toISOString();
    await calibrationRepo.save({
      id: crypto.randomUUID(),
      contexto: 'stoyko',
      confianzaDeclarada: valor,
      acierto,
      fecha: ahora,
    });
    const profile = await profileRepo.get();
    await profileRepo.save({ ...profile, stoykoUltimaCompletadaEn: ahora });
  },
}));
