// Preset **abierto** del cálculo declarado (E7, RF-7.2, ADR-0015): una posición
// sin respuesta única, sin reloj, en la que el usuario declara sus candidatas
// —las dos primeras con la línea que calculó, el resto sueltas— cada una con su
// evaluación, y recién ahí compara con el motor.
//
// El tablero nunca se mueve mientras se anota y el tiempo se registra en
// silencio (RF-7.3). El estado del
// corto vive en `compromisoStore`: comparten el modelo persistido
// (`calculoAttempts`) y la pantalla, pero cada flujo se lee mejor con su propio
// estado — uno declara una línea contra una solución verificada, el otro un
// árbol contra una posición sin respuesta correcta.
//
// La posición sale de tus **partidas propias analizadas** cuando hay alguna
// (ADR-0015, punto 4): la jugada donde perdiste más centipeones o donde
// consumiste más tiempo. Ahí no hay `mejorLinea` precalculada, así que el motor
// evalúa en el dispositivo al revelar — es una sola posición, sin reloj, y el
// motor ya está cargado. Sin partidas analizadas cae al catálogo minado.
import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { EvalSymbol, StoykoItem } from '../../core/types';
import { stoykoDisponible, stoykoProximaDisponibleEn } from '../../core/stoyko';
import {
  PLIES_MIN_LINEA,
  RAMAS_MAX_ABIERTO,
  declaracionCompleta,
  evaluarAbierto,
  ramaPideLinea,
  type RamaDeclarada,
  type ResultadoAbierto,
} from '../../core/calculo';
import { posicionPropiaParaCalculo, type PosicionPropia } from '../../core/calculoPosicion';
import { evalToSymbol } from '../../core/analysis';
import { engine } from '../../services/engine/stockfishEngine';
import { gameRepo } from '../../services/storage/gameRepo';
import { stoykoItemRepo } from '../../services/storage/stoykoItemRepo';
import { calculoAttemptRepo } from '../../services/storage/calculoAttemptRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { sanDeLinea } from './chessBoardUtils';
import { t } from '../i18n/es';

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

/** Profundidad de la evaluación en el dispositivo, para una posición propia. */
const DEPTH_POSICION_PROPIA = 16;

type Phase = 'cargando' | 'error' | 'sinContenido' | 'enfriamiento' | 'analizando' | 'confianza' | 'revelado';

/** De dónde salió la posición servida, para poder decírselo al usuario. */
export type OrigenPosicion =
  | { tipo: 'catalogo'; item: StoykoItem }
  | { tipo: 'propia'; posicion: PosicionPropia };

/** La rama que se está armando, antes de cerrarla con su evaluación. */
interface RamaEnCurso {
  linea: string[];
  evaluacion: EvalSymbol;
}

interface StoykoState {
  phase: Phase;
  pool: StoykoItem[];
  /** Posición servida y su origen. */
  origen: OrigenPosicion | null;
  fen: string;
  proximaDisponibleEn: string | null;
  /** Ramas ya cerradas: las dos primeras con línea, el resto candidata suelta. */
  ramas: RamaDeclarada[];
  ramaEnCurso: RamaEnCurso;
  inputActual: string;
  inputError: string | null;
  confianza: number | null;
  acierto: boolean | null;
  /**
   * Las tres varas del ejercicio (ADR-0015): cobertura, profundidad vista
   * y brecha de evaluación. La brecha es lo que antes se recogía y se
   * descartaba: el usuario declaraba una evaluación por candidata y nadie la
   * comparaba con la del motor.
   */
  resultado: ResultadoAbierto | null;
  lineaMotorSan: string[];
  /** Evaluación del motor de la posición, para poder contrastarla en pantalla. */
  evaluacionMotor: EvalSymbol | null;
  inicioMs: number | null;
  /** Repetición libre durante el enfriamiento: no mide ni resetea la semana. */
  practica: boolean;
  /** El motor no pudo evaluar una posición propia; el resto del feedback sigue. */
  motorError: boolean;

  empezar(force?: boolean): Promise<void>;
  practicar(): Promise<void>;
  setInputActual(value: string): void;
  setEvalSeleccionada(value: EvalSymbol): void;
  /** Suma un ply a la rama en curso (la línea que se está calculando). */
  agregarPly(): void;
  borrarUltimoPly(): void;
  /** Cierra la rama en curso y la agrega a la lista. */
  cerrarRama(): void;
  quitarRama(index: number): void;
  terminarAnalisis(): void;
  confirmarConfianza(valor: number): Promise<void>;
}

let loadGeneration = 0;
let loadPromise: { generation: number; promise: Promise<void> } | null = null;

const RAMA_VACIA: RamaEnCurso = { linea: [], evaluacion: '=' };

/** Estado limpio al servir una posición nueva. */
function estadoInicial(origen: OrigenPosicion, practica: boolean) {
  return {
    phase: 'analizando' as const,
    practica,
    origen,
    fen: origen.tipo === 'catalogo' ? origen.item.fen : origen.posicion.fen,
    ramas: [] as RamaDeclarada[],
    ramaEnCurso: { ...RAMA_VACIA },
    inputActual: '',
    inputError: null,
    confianza: null,
    acierto: null,
    resultado: null,
    lineaMotorSan: [],
    evaluacionMotor: null,
    motorError: false,
    inicioMs: Date.now(),
  };
}

/**
 * Posición a servir: primero una de tus partidas analizadas (ADR-0015, punto 4)
 * y, si no hay ninguna, el catálogo minado.
 */
async function elegirPosicion(): Promise<{ origen: OrigenPosicion; pool: StoykoItem[] } | null> {
  const propia = posicionPropiaParaCalculo(await gameRepo.list());
  await stoykoItemRepo.ensureSeeded();
  const pool = await stoykoItemRepo.list();
  if (propia) return { origen: { tipo: 'propia', posicion: propia }, pool };
  if (pool.length === 0) return null;
  return { origen: { tipo: 'catalogo', item: pool[Math.floor(Math.random() * pool.length)] }, pool };
}

/** Reproduce la línea ya ingresada, para validar la legalidad del próximo ply. */
function replayLinea(fen: string, linea: string[]): Chess {
  const chess = new Chess(fen);
  for (const uci of linea) {
    const move = chess.moves({ verbose: true }).find((m) => m.from + m.to + (m.promotion ?? '') === uci);
    if (!move) break;
    chess.move(move);
  }
  return chess;
}

export const useStoykoStore = create<StoykoState>((set, get) => ({
  phase: 'cargando',
  pool: [],
  origen: null,
  fen: '',
  proximaDisponibleEn: null,
  ramas: [],
  ramaEnCurso: { ...RAMA_VACIA },
  inputActual: '',
  inputError: null,
  confianza: null,
  acierto: null,
  resultado: null,
  lineaMotorSan: [],
  evaluacionMotor: null,
  inicioMs: null,
  practica: false,
  motorError: false,

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
        const elegida = await elegirPosicion();
        if (generation !== loadGeneration) return;
        if (!elegida) {
          set({ phase: 'sinContenido', pool: [] });
          return;
        }
        set({ pool: elegida.pool, ...estadoInicial(elegida.origen, false) });
      } catch {
        if (generation === loadGeneration) set({ phase: 'error', origen: null });
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
      const elegida = await elegirPosicion();
      if (generation !== loadGeneration) return;
      if (!elegida) {
        set({ phase: 'sinContenido', pool: [] });
        return;
      }
      set({ pool: elegida.pool, ...estadoInicial(elegida.origen, true) });
    } catch {
      if (generation === loadGeneration) set({ phase: 'error', origen: null });
    }
  },

  setInputActual(value) {
    set({ inputActual: value, inputError: null });
  },

  setEvalSeleccionada(value) {
    set({ ramaEnCurso: { ...get().ramaEnCurso, evaluacion: value } });
  },

  agregarPly() {
    const s = get();
    if (s.phase !== 'analizando' || !s.fen) return;
    const jugada = s.inputActual.trim().toLowerCase();
    if (!UCI_RE.test(jugada)) {
      set({ inputError: t.stoyko.errorFormato });
      return;
    }
    // Cada ply se valida contra la posición que deja el ply anterior: una línea
    // declarada tiene que ser jugable, si no no es una línea.
    const chess = replayLinea(s.fen, s.ramaEnCurso.linea);
    const legales = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    if (!legales.includes(jugada)) {
      set({ inputError: t.stoyko.errorIlegal });
      return;
    }
    // La candidata (primer ply) no puede repetirse entre ramas: dos ramas con la
    // misma jugada inicial son la misma candidata contada dos veces.
    if (s.ramaEnCurso.linea.length === 0 && s.ramas.some((rama) => rama.linea[0] === jugada)) {
      set({ inputError: t.stoyko.errorDuplicada });
      return;
    }
    set({
      ramaEnCurso: { ...s.ramaEnCurso, linea: [...s.ramaEnCurso.linea, jugada] },
      inputActual: '',
      inputError: null,
    });
  },

  borrarUltimoPly() {
    const s = get();
    if (s.phase !== 'analizando' || s.ramaEnCurso.linea.length === 0) return;
    set({ ramaEnCurso: { ...s.ramaEnCurso, linea: s.ramaEnCurso.linea.slice(0, -1) }, inputError: null });
  },

  cerrarRama() {
    const s = get();
    if (s.phase !== 'analizando') return;
    if (s.ramas.length >= RAMAS_MAX_ABIERTO) {
      set({ inputError: t.stoyko.errorTopeRamas });
      return;
    }
    // Las dos primeras ramas piden línea (decisión de producto 2026-07-30):
    // cinco líneas completas en un celular son una carga de datos, y la
    // amplitud la sostienen las candidatas sueltas del final.
    const pliesMinimos = ramaPideLinea(s.ramas.length) ? PLIES_MIN_LINEA : 1;
    if (s.ramaEnCurso.linea.length < pliesMinimos) {
      set({ inputError: t.stoyko.errorLineaCorta.replace('{n}', String(pliesMinimos)) });
      return;
    }
    set({
      ramas: [...s.ramas, { linea: s.ramaEnCurso.linea, evaluacion: s.ramaEnCurso.evaluacion }],
      ramaEnCurso: { ...RAMA_VACIA },
      inputActual: '',
      inputError: null,
    });
  },

  quitarRama(index) {
    const s = get();
    if (s.phase !== 'analizando') return;
    set({ ramas: s.ramas.filter((_, i) => i !== index) });
  },

  terminarAnalisis() {
    const s = get();
    if (s.phase !== 'analizando') return;
    if (!declaracionCompleta(s.ramas)) {
      set({ inputError: t.stoyko.errorDeclaracionIncompleta });
      return;
    }
    set({ phase: 'confianza', inputError: null });
  },

  async confirmarConfianza(valor) {
    const s = get();
    if (s.phase !== 'confianza' || !s.origen) return;
    const origen = s.origen;
    const ramas = s.ramas;

    // La referencia del motor: del catálogo cuando viene de ahí, y evaluada en
    // el dispositivo cuando la posición sale de una partida propia.
    let referencia: { lineaMotor: string[]; evaluacionMotor: EvalSymbol } | null = null;
    let motorError = false;
    if (origen.tipo === 'catalogo') {
      referencia = { lineaMotor: origen.item.mejorLinea, evaluacionMotor: origen.item.evaluacionMotor };
    } else {
      try {
        const evaluacion = await engine.evaluate(s.fen, DEPTH_POSICION_PROPIA);
        // `cp` viene desde la perspectiva de quien mueve y la escala de
        // símbolos es desde blancas: se invierte cuando mueven las negras.
        const mueveNegras = s.fen.split(' ')[1] === 'b';
        const cpBlancas = evaluacion.cp === null
          ? (evaluacion.mateIn ?? 0) > 0 === !mueveNegras ? 10_000 : -10_000
          : mueveNegras ? -evaluacion.cp : evaluacion.cp;
        referencia = { lineaMotor: [evaluacion.move], evaluacionMotor: evalToSymbol(cpBlancas) };
      } catch {
        motorError = true;
      }
    }

    const resultado = referencia ? evaluarAbierto(referencia, ramas) : null;
    const acierto = resultado?.cobertura ?? false;
    const lineaMotorSan = referencia ? sanDeLinea(s.fen, referencia.lineaMotor) : [];
    set({
      phase: 'revelado',
      confianza: valor,
      acierto,
      resultado,
      lineaMotorSan,
      evaluacionMotor: referencia?.evaluacionMotor ?? null,
      motorError,
    });

    // Práctica libre: se muestra la línea del motor, pero no se mide ni se
    // resetea el enfriamiento semanal (RF-7.2).
    if (s.practica) return;
    // Sin referencia del motor no hay nada que medir: no se inventa un intento
    // con varas vacías ni se consume el Stoyko de la semana.
    if (!resultado) return;

    const ahora = new Date().toISOString();
    await calibrationRepo.save({
      id: crypto.randomUUID(),
      contexto: 'stoyko',
      confianzaDeclarada: valor,
      acierto,
      fecha: ahora,
    });
    // Persistir el intento entero (RF-7.2/7.3) en el formato unificado: las
    // ramas con su evaluación, las tres varas del ejercicio, el tiempo
    // (cronómetro silencioso) y la confianza.
    await calculoAttemptRepo.save({
      id: crypto.randomUUID(),
      preset: 'abierto',
      ...(origen.tipo === 'catalogo'
        ? { itemId: origen.item.id }
        : { origen: { gameId: origen.posicion.gameId, ply: origen.posicion.ply } }),
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
