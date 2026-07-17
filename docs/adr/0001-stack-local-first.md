# ADR-0001 — Stack y arquitectura local-first

- **Estado:** Aceptado
- **Fecha:** 2026-07-16
- **Requisitos relacionados:** RNF-1..5, §9 del PRD

## Contexto
La app debe correr en celular/tablet/computadora, funcionar sin conexión, construirse incrementalmente mediante desarrollo asistido por IA (múltiples herramientas, intercambiables) y evolucionar sin romperse. No hay backend disponible ni deseado en el MVP.

## Decisión
Aplicación web progresiva **local-first**: Vite + React + TypeScript estricto, Tailwind con tokens propios, Zustand para estado, **Dexie sobre IndexedDB** con migraciones versionadas, chessground para el tablero y chessops/chess.js para reglas, vite-plugin-pwa. Arquitectura en capas `ui / core / services / config` con dominio puro en `core` (sin React ni almacenamiento; recibe puertos).

## Alternativas consideradas
- **Next.js** — agrega servidor y complejidad de despliegue que el MVP no necesita; nada del producto requiere renderizado en servidor.
- **Svelte/SolidJS** — viables, pero React maximiza ecosistema, ejemplos disponibles y compatibilidad con asistentes de IA (abundancia de código de referencia reduce errores de generación).
- **Flutter / nativo** — contradice web-first, PWA y la construcción incremental de un solo desarrollador.
- **Backend desde el día uno (Supabase/Firebase)** — costo y acoplamiento prematuros; la sincronización es Fase 6 y será opcional.

## Consecuencias
Cero costo de infraestructura; los datos del usuario viven en su dispositivo (privacidad y velocidad), a cambio: la **integridad de IndexedDB es crítica** (de ahí RNF-5: migraciones probadas + exportación permanente, E14). Señal de revisión: si la Fase 6 exige sync multi-dispositivo con conflictos complejos, evaluar CRDTs o backend liviano en un ADR nuevo.
