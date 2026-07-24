// Preferencia device-local del modo a ciegas progresivo del currículo (RF-6.5).
// Por defecto está activo —es "dificultad deseable" (Bjork): al dominar un
// patrón las piezas se desvanecen para que recordar la posición cueste un poco
// más y así se fije mejor—. Pero si al usuario le molesta ver el tablero
// atenuado, puede apagarlo desde Ajustes. Vive en localStorage (preferencia de
// experiencia, lectura síncrona), igual que el tema; no es dato exportable.
const BLIND_TRAINING_KEY = 'elomax-blind-training';

export function readBlindTrainingEnabled(): boolean {
  try {
    return localStorage.getItem(BLIND_TRAINING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeBlindTrainingEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(BLIND_TRAINING_KEY);
    else localStorage.setItem(BLIND_TRAINING_KEY, 'off');
  } catch {
    // Sin localStorage se mantiene el default (activo); no es crítico persistir.
  }
}
