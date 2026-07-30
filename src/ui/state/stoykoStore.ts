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
import { stoykoDisponible, stoykoProximaDisponibleEn, type Candidata } from '../../core/stoyko';
import { evaluarAbierto, type ResultadoAbierto } from '../../core/calculo';
import { stoykoItemRepo } from '../../services/storage/stoykoItemRepo';
import { calculoAttemptRepo } from '../../services/storage/calculoAttemptRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { sanDeLinea } from './chessBoardUtils';
import { t } from '../i18n/es';

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

type Phase = 'cargando' | 'error' | 'sinContenido' | 'enfriamiento' | 'analizando' | 'confianza' | 'revelado';

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
  /**
   * Las tres varas del preset abierto (ADR-0015): cobertura, profundidad vista
   * y brecha de evaluación. La brecha es lo que antes se recogía y se
   * descartaba: el usuario declaraba una evaluación por candidata y nadie la
   * comparaba con `evaluacionMotor`, que el catálogo ya traía.
   */
  resultado: ResultadoAbierto | null;
  lineaMotorSan: string[];
  /** Evaluación del motor de la posición, para poder contrastarla en pantalla. */
  evaluacionMotor: EvalSymbol | null;
  inicioMs: number | null;
  /** Repetición libre durante el enfriamiento: no mide ni resetea la semana. */
  practica: boolean;

  empezar(force?: boolean): Promise<void>;
  practicar(): Promise<void>;
  setInputActual(value: string): void;
  setEvalSeleccionada(value: EvalSymbol): void;
  agregarCandidata(): void;
  quitarCandidata(index: number): void;
  terminarAnalisis(): void;
  confirmarConfianza(valor: number): Promise<void>;
}

let loadGeneration = 0;
let loadPromise: { generation: number; promise: Promise<void> } | null = null;

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
  resultado: null,
  lineaMotorSan: [],
  evaluacionMotor: null,
  inicioMs: null,
  practica: false,

  async empezar(force = false) {
    if (loadPromise && !force) return loadPromise.promise;
    const generation = ++loadGeneration;
    set({ phase: 'cargando' });
    const promise = (async () => {
      try {
        const profile = await profileRepo.get();
        if (generation !== loadGeneration) return;
        if (!stoykoDisponible(profile)) {
          set({ phase: 'enfriamiento', proximaDisponibleEn: stoykoProximaDisponibleEn(profile) });
          return;
        }
        await stoykoItemRepo.ensureSeeded();
        const pool = await stoykoItemRepo.list();
        if (generation !== loadGeneration) return;
        if (pool.length === 0) {
          set({ phase: 'sinContenido', pool });
          return;
        }
        const item = pool[Math.floor(Math.random() * pool.length)];
        set({
          phase: 'analizando',
          practica: false,
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
      } catch {
        if (generation === loadGeneration) set({ phase: 'error', item: null });
      } finally {
        if (loadPromise?.generation === generation) loadPromise = null;
      }
    })();
    loadPromise = { generation, promise };
    return promise;
  },

  // Repetir/practicar durante el enfriamiento (pedido explícito del usuario):
  // sirve una posición saltando el chequeo semanal, pero en modo práctica —al
  // terminar no resetea el enfriamiento ni guarda calibración/intento—, para no
  // diluir la medición de "uno por semana" (RF-7.2).
  async practicar() {
    const generation = ++loadGeneration; // invalida cualquier empezar() en vuelo
    loadPromise = null;
    set({ phase: 'cargando' });
    try {
      await stoykoItemRepo.ensureSeeded();
      const pool = await stoykoItemRepo.list();
      if (generation !== loadGeneration) return;
      if (pool.length === 0) {
        set({ phase: 'sinContenido', pool });
        return;
      }
      const item = pool[Math.floor(Math.random() * pool.length)];
      set({
        phase: 'analizando',
        practica: true,
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
    } catch {
      if (generation === loadGeneration) set({ phase: 'error', item: null });
    }
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
    // Una candidata de un ply es una rama de un ply: el mismo criterio del
    // preset abierto, ya en el formato unificado (ADR-0015). Cuando la entrada
    // de ramas exista, esto no cambia.
    const ramas = s.candidatas.map((candidata) => ({ linea: [candidata.jugada], evaluacion: candidata.evaluacion }));
    const resultado = evaluarAbierto({ lineaMotor: item.mejorLinea, evaluacionMotor: item.evaluacionMotor }, ramas);
    const acierto = resultado.cobertura;
    const lineaMotorSan = sanDeLinea(item.fen, item.mejorLinea);
    set({
      phase: 'revelado',
      confianza: valor,
      acierto,
      resultado,
      lineaMotorSan,
      evaluacionMotor: item.evaluacionMotor,
    });

    // Práctica libre: se muestra la línea del motor, pero no se mide ni se
    // resetea el enfriamiento semanal (RF-7.2).
    if (s.practica) return;

    const ahora = new Date().toISOString();
    await calibrationRepo.save({
      id: crypto.randomUUID(),
      contexto: 'stoyko',
      confianzaDeclarada: valor,
      acierto,
      fecha: ahora,
    });
    // Persistir el intento entero (RF-7.2/7.3) en el formato unificado: las
    // ramas con su evaluación, las tres varas del preset abierto, el tiempo
    // (cronómetro silencioso) y la confianza.
    await calculoAttemptRepo.save({
      id: crypto.randomUUID(),
      preset: 'abierto',
      itemId: item.id,
      ramas,
      cobertura: resultado.cobertura,
      profundidadVista: resultado.profundidadVista,
      brechaEvaluacion: resultado.brechaEvaluacion,
      confianzaDeclarada: valor,
      tiempoMs: s.inicioMs !== null ? Date.now() - s.inicioMs : 0,
      fecha: ahora,
    });
    const profile = await profileRepo.get();
    await profileRepo.save({ ...profile, stoykoUltimaCompletadaEn: ahora });
  },
}));
