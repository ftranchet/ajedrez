import { useState } from 'react';
import { readBlindTrainingEnabled, writeBlindTrainingEnabled } from '../trainingPrefs';

/** Enganche a React del modo a ciegas progresivo (RF-6.5): lee/escribe la
 * preferencia device-local que decide si las piezas se desvanecen al dominar
 * un patrón. */
export function useBlindTraining(): { enabled: boolean; setEnabled: (next: boolean) => void } {
  const [enabled, setEnabledState] = useState<boolean>(() => readBlindTrainingEnabled());

  function setEnabled(next: boolean) {
    writeBlindTrainingEnabled(next);
    setEnabledState(next);
  }

  return { enabled, setEnabled };
}
