// Tema de la aplicación (design system §2.1 "Modo oscuro primero"): el oscuro
// es el default (tokens de @theme); el claro se activa con data-theme='light'
// en <html>. La preferencia es una decisión de presentación del dispositivo,
// así que vive en localStorage (lectura síncrona → sin parpadeo desde el script
// inline de index.html), no en el perfil exportable. Lógica pura y testeable
// acá; el enganche a React vive en hooks/useTheme.
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'elomax-theme';

/** Color de la barra del navegador (meta theme-color) por tema resuelto. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#171310',
  light: '#efe6d6',
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Tema concreto a aplicar. "system" se resuelve con la preferencia del SO. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark ? 'dark' : 'light';
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Almacenamiento no disponible: el tema simplemente sigue al sistema.
  }
}

export function systemPrefersDark(): boolean {
  // Modo oscuro primero: ante la duda (sin matchMedia), oscuro.
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
}

/** Resuelve y aplica; devuelve el tema concreto que quedó activo. */
export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());
  applyResolvedTheme(resolved);
  return resolved;
}
