/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Base de despliegue: '/' por defecto; GitHub Pages sirve bajo /ajedrez/
// (el workflow de deploy exporta BASE_PATH=/ajedrez/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ELOmax — entrenador de ajedrez',
        short_name: 'ELOmax',
        description: 'Entrenador de ajedrez basado en evidencia. Local-first.',
        lang: 'es',
        display: 'standalone',
        background_color: '#171310',
        theme_color: '#171310',
        start_url: base,
        scope: base,
        // Rutas relativas al manifest, así funcionan bajo cualquier base.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El motor WASM debe funcionar sin conexión (RNF-2), por eso entra al precache.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm,json}'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
