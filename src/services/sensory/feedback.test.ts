import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface AudioHarness {
  constructed: number;
  resumed: number;
  bufferSourcesStarted: number;
  oscillatorsStarted: number;
}

interface Clock {
  now: number;
}

function createHarness(): AudioHarness {
  return {
    constructed: 0,
    resumed: 0,
    bufferSourcesStarted: 0,
    oscillatorsStarted: 0,
  };
}

function fakeAudioContextClass(
  harness: AudioHarness,
  options: { suspended?: boolean; rejectResume?: boolean } = {},
): typeof AudioContext {
  const audioParam = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const connectable = <T extends object>(value: T) => ({
    ...value,
    connect(destination: unknown) {
      return destination;
    },
  });

  class FakeAudioContext {
    readonly sampleRate = 1_000;
    readonly currentTime = 2;
    readonly destination = connectable({});
    readonly state = options.suspended ? 'suspended' : 'running';

    constructor() {
      harness.constructed += 1;
    }

    resume(): Promise<void> {
      harness.resumed += 1;
      return options.rejectResume ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve();
    }

    createBuffer(_channels: number, samples: number): AudioBuffer {
      return {
        getChannelData: () => new Float32Array(samples),
      } as unknown as AudioBuffer;
    }

    createBufferSource(): AudioBufferSourceNode {
      return connectable({
        buffer: null,
        start: () => {
          harness.bufferSourcesStarted += 1;
        },
        stop: vi.fn(),
      }) as unknown as AudioBufferSourceNode;
    }

    createBiquadFilter(): BiquadFilterNode {
      return connectable({
        type: 'lowpass',
        frequency: audioParam(),
        Q: audioParam(),
      }) as unknown as BiquadFilterNode;
    }

    createGain(): GainNode {
      return connectable({ gain: audioParam() }) as unknown as GainNode;
    }

    createOscillator(): OscillatorNode {
      return connectable({
        type: 'sine',
        frequency: audioParam(),
        start: () => {
          harness.oscillatorsStarted += 1;
        },
        stop: vi.fn(),
      }) as unknown as OscillatorNode;
    }
  }

  return FakeAudioContext as unknown as typeof AudioContext;
}

function installBrowser(options: {
  AudioContextClass?: typeof AudioContext;
  clock?: Clock;
  reducedMotion?: boolean;
  visibility?: DocumentVisibilityState;
  vibrate?: (pattern: number | number[]) => boolean;
} = {}): void {
  const clock = options.clock ?? { now: 0 };
  vi.stubGlobal('performance', { now: () => clock.now });
  vi.stubGlobal('document', { visibilityState: options.visibility ?? 'visible' });
  vi.stubGlobal('navigator', options.vibrate ? { vibrate: options.vibrate } : {});
  vi.stubGlobal('window', {
    AudioContext: options.AudioContextClass,
    matchMedia: vi.fn((query: string) => ({
      matches: options.reducedMotion ?? false,
      media: query,
    })),
  });
}

async function loadFeedback() {
  return import('./feedback');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('feedback sensorial progresivo', () => {
  it('no arroja cuando las APIs no existen', async () => {
    installBrowser();
    const feedback = await loadFeedback();

    expect(feedback.soundFeedbackSupported()).toBe(false);
    expect(feedback.vibrationFeedbackSupported()).toBe(false);
    expect(() => feedback.unlockSoundFeedback(true)).not.toThrow();
    expect(() => feedback.playMoveCue(true)).not.toThrow();
    expect(() => feedback.playResolutionCue({ sonido: true, vibracion: true })).not.toThrow();
    expect(() => feedback.previewSoundFeedback()).not.toThrow();
    expect(() => feedback.previewVibrationFeedback()).not.toThrow();
  });

  it('degrada sin arrojar si AudioContext o vibrate fallan', async () => {
    class BrokenAudioContext {
      constructor() {
        throw new Error('audio unavailable');
      }
    }
    const vibrate = vi.fn(() => {
      throw new Error('vibration denied');
    });
    installBrowser({
      AudioContextClass: BrokenAudioContext as unknown as typeof AudioContext,
      vibrate,
    });
    const feedback = await loadFeedback();

    expect(() => feedback.unlockSoundFeedback(true)).not.toThrow();
    expect(() => feedback.playMoveCue(true)).not.toThrow();
    expect(() => feedback.playResolutionCue({ sonido: true, vibracion: true })).not.toThrow();
    expect(() => feedback.previewSoundFeedback()).not.toThrow();
    expect(() => feedback.previewVibrationFeedback()).not.toThrow();
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('absorbe el rechazo asíncrono al desbloquear un contexto suspendido', async () => {
    const harness = createHarness();
    installBrowser({
      AudioContextClass: fakeAudioContextClass(harness, { suspended: true, rejectResume: true }),
    });
    const feedback = await loadFeedback();

    expect(() => feedback.unlockSoundFeedback(true)).not.toThrow();
    await Promise.resolve();
    expect(harness.resumed).toBe(1);
  });

  it('genera el click sin consumir Math.random global', async () => {
    const harness = createHarness();
    const random = vi.spyOn(Math, 'random');
    installBrowser({ AudioContextClass: fakeAudioContextClass(harness) });
    const feedback = await loadFeedback();

    feedback.playMoveCue(true);

    expect(harness.bufferSourcesStarted).toBe(1);
    expect(random).not.toHaveBeenCalled();
  });

  it('deduplica por tipo durante 100 ms y mantiene move y resolución independientes', async () => {
    const harness = createHarness();
    const clock = { now: 1_000 };
    const vibrate = vi.fn(() => true);
    installBrowser({
      AudioContextClass: fakeAudioContextClass(harness),
      clock,
      vibrate,
    });
    const feedback = await loadFeedback();

    feedback.playMoveCue(true);
    feedback.playMoveCue(true);
    feedback.playResolutionCue({ sonido: true, vibracion: true });
    feedback.playResolutionCue({ sonido: true, vibracion: true });
    clock.now += 99;
    feedback.playMoveCue(true);
    feedback.playResolutionCue({ sonido: true, vibracion: true });

    expect(harness.bufferSourcesStarted).toBe(1);
    expect(harness.oscillatorsStarted).toBe(1);
    expect(vibrate).toHaveBeenCalledTimes(1);

    clock.now += 1;
    feedback.playMoveCue(true);
    feedback.playResolutionCue({ sonido: true, vibracion: true });

    expect(harness.bufferSourcesStarted).toBe(2);
    expect(harness.oscillatorsStarted).toBe(2);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('no crea contexto ni vibra mientras el documento está oculto', async () => {
    const harness = createHarness();
    const vibrate = vi.fn(() => true);
    installBrowser({
      AudioContextClass: fakeAudioContextClass(harness),
      visibility: 'hidden',
      vibrate,
    });
    const feedback = await loadFeedback();

    feedback.unlockSoundFeedback(true);
    feedback.playMoveCue(true);
    feedback.playResolutionCue({ sonido: true, vibracion: true });
    feedback.previewSoundFeedback();
    feedback.previewVibrationFeedback();

    expect(harness.constructed).toBe(0);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('respeta opt-in y no despierta ninguna API con preferencias apagadas', async () => {
    const harness = createHarness();
    const vibrate = vi.fn(() => true);
    installBrowser({ AudioContextClass: fakeAudioContextClass(harness), vibrate });
    const feedback = await loadFeedback();

    feedback.unlockSoundFeedback(false);
    feedback.playMoveCue(false);
    feedback.playResolutionCue({ sonido: false, vibracion: false });

    expect(harness.constructed).toBe(0);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('activa cada canal de resolución de forma independiente', async () => {
    const harness = createHarness();
    const clock = { now: 0 };
    const vibrate = vi.fn(() => true);
    installBrowser({
      AudioContextClass: fakeAudioContextClass(harness),
      clock,
      vibrate,
    });
    const feedback = await loadFeedback();

    feedback.playResolutionCue({ sonido: true, vibracion: false });
    expect(harness.oscillatorsStarted).toBe(1);
    expect(vibrate).not.toHaveBeenCalled();

    clock.now = 100;
    feedback.playResolutionCue({ sonido: false, vibracion: true });
    expect(harness.oscillatorsStarted).toBe(1);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith(16);
  });

  it('suprime vibración y preview con prefers-reduced-motion', async () => {
    const vibrate = vi.fn(() => true);
    installBrowser({ reducedMotion: true, vibrate });
    const feedback = await loadFeedback();

    feedback.playResolutionCue({ sonido: false, vibracion: true });
    feedback.previewVibrationFeedback();

    expect(vibrate).not.toHaveBeenCalled();
  });
});
