import type { SensoryPreferences } from '../../core/types';

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let audioContext: AudioContext | null = null;
let lastMoveCueAt = -Infinity;
let lastResolutionCueAt = -Infinity;

const CUE_DEDUPE_MS = 100;

function visible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function contextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
}

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  const AudioContextClass = contextConstructor();
  if (!AudioContextClass) return null;
  try {
    audioContext = new AudioContextClass();
    return audioContext;
  } catch {
    return null;
  }
}

function resume(context: AudioContext): void {
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function shouldPlay(kind: 'move' | 'resolution'): boolean {
  const now = nowMs();
  const previous = kind === 'move' ? lastMoveCueAt : lastResolutionCueAt;
  if (now - previous < CUE_DEDUPE_MS) return false;
  if (kind === 'move') lastMoveCueAt = now;
  else lastResolutionCueAt = now;
  return true;
}

/** Click breve y seco: ruido filtrado con una caída de 36 ms. No requiere
 * descargar un asset ni despierta el AudioContext antes de un gesto. */
function woodClick(): void {
  const context = getAudioContext();
  if (!context) return;
  resume(context);
  const duration = 0.036;
  const samples = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, samples, context.sampleRate);
  const channel = buffer.getChannelData(0);
  // PRNG local y determinístico: el sonido no consume Math.random() global,
  // porque ese generador decide muestreos pedagógicos de Radar/confianza.
  let noiseState = 0x6d2b79f5;
  for (let index = 0; index < samples; index += 1) {
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    const noise = ((noiseState >>> 0) / 0xffffffff) * 2 - 1;
    channel[index] = noise * Math.exp(-index / (context.sampleRate * 0.006));
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const start = context.currentTime;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(620, start);
  filter.Q.setValueAtTime(0.75, start);
  gain.gain.setValueAtTime(0.055, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
  source.stop(start + duration);
}

/** Un único tono grave y neutral para “respuesta asentada”. Es idéntico en
 * acierto y error: informa cierre, no reparte premios ni castigos. */
function warmResolutionTone(): void {
  const context = getAudioContext();
  if (!context) return;
  resume(context);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime;
  const duration = 0.17;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(165, start);
  oscillator.frequency.exponentialRampToValueAtTime(147, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.045, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function reducedMotionRequested(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function shortVibration(): void {
  if (reducedMotionRequested() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(16);
  } catch {
    // La vibración es mejora progresiva: un navegador que la rechaza nunca
    // debe interrumpir el ejercicio.
  }
}

export function soundFeedbackSupported(): boolean {
  return contextConstructor() !== undefined;
}

export function vibrationFeedbackSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Desbloquea el contexto desde el gesto de "Empezar sesión" sin emitir
 * sonido. Así el primer bloque puede ser Triage (sin jugada en tablero) y el
 * tono de resolución posterior no depende de autoplay. */
export function unlockSoundFeedback(enabled: boolean): void {
  if (!enabled || !visible()) return;
  const context = getAudioContext();
  if (context) resume(context);
}

export function playMoveCue(enabled: boolean): void {
  if (!enabled || !visible() || !shouldPlay('move')) return;
  try {
    woodClick();
  } catch {
    // El feedback sensorial nunca bloquea la jugada.
  }
}

export function playResolutionCue(preferences: SensoryPreferences): void {
  if ((!preferences.sonido && !preferences.vibracion) || !visible() || !shouldPlay('resolution')) return;
  if (preferences.sonido) {
    try {
      warmResolutionTone();
    } catch {
      // El feedback textual y visual sigue siendo la fuente de verdad.
    }
  }
  if (preferences.vibracion) shortVibration();
}

/** Previews llamados directamente desde el gesto que activa cada preferencia,
 * necesario para desbloquear Web Audio sin crear contexto al cargar la app. */
export function previewSoundFeedback(): void {
  if (!visible()) return;
  try {
    woodClick();
  } catch {
    // Mejora progresiva.
  }
}

export function previewVibrationFeedback(): void {
  if (visible()) shortVibration();
}
