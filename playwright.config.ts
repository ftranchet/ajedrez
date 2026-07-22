import { defineConfig } from '@playwright/test';

// La misma variable que usa el build (vite.config.ts): correr los e2e con
// BASE_PATH=/ajedrez/ prueba el escenario GitHub Pages (app bajo subpath).
const base = process.env.BASE_PATH ?? '/';

// En entornos sin descarga de navegadores, CHROMIUM_PATH apunta a un
// Chromium local (p. ej. /opt/pw-browsers/chromium-*/chrome-linux/chrome).
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:4173${base}`,
    // La app sigue al sistema, pero su default es "modo oscuro primero": los
    // e2e fijan oscuro para que las aserciones de color valgan igual que antes
    // del modo claro. tema.spec.ts emula claro donde prueba ese camino.
    colorScheme: 'dark',
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : {},
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: `http://localhost:4173${base}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
