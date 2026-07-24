// La preferencia del modo a ciegas (RF-6.5) tiene semántica invertida —se
// guarda solo cuando está APAGADO, para que el default sea "activo" sin
// escribir nada— y debe sobrevivir a un localStorage inaccesible (modo
// privado, cuota llena) sin romper el entrenamiento.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readBlindTrainingEnabled, writeBlindTrainingEnabled } from './trainingPrefs';

const KEY = 'elomax-blind-training';

// El entorno de tests es `node` (vite.config.ts), sin Web Storage: se stubea
// un localStorage en memoria con la misma semántica.
function localStorageEnMemoria() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, String(v)),
    removeItem: (k: string) => void datos.delete(k),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('localStorage', localStorageEnMemoria());
});

describe('preferencia del modo a ciegas', () => {
  it('viene activo por defecto, sin nada guardado', () => {
    expect(readBlindTrainingEnabled()).toBe(true);
  });

  it('apagarlo persiste y se lee apagado', () => {
    writeBlindTrainingEnabled(false);
    expect(localStorage.getItem(KEY)).toBe('off');
    expect(readBlindTrainingEnabled()).toBe(false);
  });

  it('volver a activarlo limpia la clave en vez de guardar un valor', () => {
    writeBlindTrainingEnabled(false);
    writeBlindTrainingEnabled(true);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readBlindTrainingEnabled()).toBe(true);
  });

  it('un valor inesperado no apaga el modo (solo "off" lo apaga)', () => {
    localStorage.setItem(KEY, 'true');
    expect(readBlindTrainingEnabled()).toBe(true);
  });

  it('sin localStorage disponible, cae al default activo y escribir no lanza', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('sin acceso'); },
      setItem: () => { throw new Error('sin acceso'); },
      removeItem: () => { throw new Error('sin acceso'); },
    });
    expect(readBlindTrainingEnabled()).toBe(true);
    expect(() => writeBlindTrainingEnabled(false)).not.toThrow();
  });
});
