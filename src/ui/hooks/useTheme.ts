import { useEffect, useState } from 'react';
import {
  applyResolvedTheme,
  applyThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from '../theme';

/** Enganche a React del tema: lee/escribe la preferencia, la aplica y, cuando
 * es "system", sigue en vivo los cambios del sistema operativo. */
export function useTheme(): { preference: ThemePreference; setPreference: (next: ThemePreference) => void } {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference());

  useEffect(() => {
    applyThemePreference(preference);
    if (preference !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyResolvedTheme(resolveTheme('system', media.matches));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  function setPreference(next: ThemePreference) {
    writeThemePreference(next);
    setPreferenceState(next);
  }

  return { preference, setPreference };
}
