# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versionado semántico `0.x.y` durante el MVP: `x` sube al completar una fase del roadmap, `y` con correcciones y mejoras menores. Toda entrada referencia requisitos del PRD (`RF-…`) o ADRs cuando aplica.

## [Sin publicar]
### Agregado
- Base documental del proyecto: PRD v0.2.0, roadmap, design system, plantilla y ADRs 0001–0006, CONTRIBUTING.md.
- Épica E14 (exportación e importación de datos) con criterios de aceptación; primeros entregables en Fase 1 del roadmap (RF-14.1, 14.2).
- ADR-0006: licencia del proyecto GPLv3.
- `LICENSE` con el texto oficial de GPLv3 (RNF-8, ADR-0006).
- Set de piezas **Staunty** (autor sadsnake1, tomado de lichess-org/lila) en `public/piece/staunty/`, licencia CC BY-NC-SA 4.0 con atribución (ver README del set).
- Prototipos de validación del design system v2 en `docs/prototipos/` con README propio: referencia visual (`design-system.dc.html`), prototipo interactivo del flujo sesión → Radar (`sesion-de-hoy.dc.html`) y sus archivos de soporte (`support.js`, `ios-frame.jsx`).
- Los tres documentos de evidencia en `docs/evidence/` (informe científico, tier list y documento de diseño): la base documental queda completa, sin pendientes.
- Fase 0 — Fundaciones: aplicación inicial con Vite + React + TypeScript estricto + Tailwind (tokens del design system v2) + PWA instalable y usable sin conexión (RNF-1, RNF-2, RNF-3). Tablero chessground con piezas Staunty, movimiento por arrastre y toque-toque, promoción con selector, validación completa de legalidad (RF-1.1, RF-1.2); partida local contra Stockfish 18 WASM lite single-thread en Web Worker, 5 niveles de fuerza limitada (RF-1.3, ADR-0002); partidas persistidas con PGN, tiempos por jugada, fuente, resultado y fecha (RF-1.5).
- Persistencia Dexie con esquema v1 y migración v2 probada con test que migra datos de la versión anterior (RNF-5, CONTRIBUTING regla 3).
- Estructura de capas `ui / core / services / config` con dominio puro en `core` y puertos para motor y almacenamiento (ADR-0001); tests de dominio (resultado de partida) y de migración.
- Interfaz en español rioplatense con textos en archivo de i18n (RNF-7); pantallas Hoy y Panel con estados vacíos honestos que explican qué llega en cada fase.
- CI en GitHub Actions: lint + typecheck + test + build en cada push (RNF-5).
- Tests e2e (Playwright) del criterio de salida de Fase 0: partida contra el motor, guardado y persistencia tras recarga, en celular y escritorio, sobre el build de producción y contra las bases `/` y `/ajedrez/`; corren en CI en cada push.
- Despliegue automático a GitHub Pages desde `main` (workflow `deploy-pages.yml`); estrategia de tests y regla de despliegue documentadas en CONTRIBUTING.
- Fase 1 — Radar + Cola Universal (el MVP diferencial):
  - **Cola Universal de errores (E4):** planificador FSRS vía `ts-fsrs` detrás de un puerto propio (`core/scheduler.ts`, ADR-0003); acierto espacia la reaparición, fallo la reinicia (RF-4.2); producción libre en el tablero, nunca opción múltiple (RF-4.3); los repasos vencidos tienen prioridad fija al inicio de la sesión (RF-4.4); detector de tarjetas "sanguijuela" (RF-4.6).
  - **El Radar (E5):** cinco tipos de posición mezclados sin previo aviso (ofensiva, defensa, tranquila, genuina, envenenada — RF-5.1) con selector de dificultad adaptativo que mantiene la tasa de acierto en la banda 60–80% (RF-5.5); evaluación rápida antes de jugar (RF-5.2); feedback que explica el porqué también cuando no había táctica (RF-5.3); los fallos generan tarjetas para la Cola (RF-5.4). El subtipo de doble solución (RF-5.7) queda para Fase 4, según el roadmap.
  - **Calibración del juicio (E10):** confianza declarada muestreada ~1 de cada 4–5 respuestas (RF-10.1) y puntuación de Brier acumulada por contexto (RF-10.2).
  - **Sesión simple (Cola vencida + Radar):** pantalla "Tu sesión de hoy" pasa de placeholder a la sesión real, con layout de bloque héroe (design system §4.1).
  - **Exportación e importación completas (E14):** un solo archivo `.zip` con manifiesto versionado, partidas (JSON + PGN legible por separado), tarjetas de la Cola y registros de calibración (RF-14.1); restauración con validación de esquema (RF-14.2); alcanzable en 2 toques desde Hoy (Hoy → Panel → Exportar).
  - Esquema Dexie v3 (tablas `errorCards`, `radarItems`, `calibrationRecords`), puramente aditiva, con test de migración desde v2.
  - Dataset semilla de **desarrollo** para el Radar (`scripts/build-seed-puzzles.mjs`): 7 posiciones construidas a mano (no recordadas de partidas reales) y verificadas con chess.js + Stockfish antes de incluirse — **no** es el dataset real de Lichess CC0 de ADR-0005: este entorno de desarrollo no tiene acceso de red a `database.lichess.org`. `scripts/import-puzzles.mjs` documenta el pipeline real para correr con el CSV oficial en un entorno con acceso a internet.
  - 33 tests nuevos de dominio (scheduler, Cola, calibración, selector del Radar, exportación) + 6 tests de integración del store de sesión contra Dexie real + 3 tests e2e (Playwright) del flujo Radar/Cola/exportación.
  - Lote offline versionado `radar-84639d96e9b3`: 100 posiciones reales y balanceadas (20 por tipo), obtenido del dataset CC0 de Lichess y de partidas reales verificadas con Stockfish (RF-5.6, ADR-0005). El generador reproducible `build:radar-dataset` admite CSV/PGN comprimidos con zstd y aborta si falta una cuota o hay duplicados.
  - Progreso adaptativo del Radar e historial de respuestas persistentes entre sesiones: la tasa de las últimas 50 posiciones queda visible en el Panel y exportable junto con tarjetas, calibración y progreso (RF-5.5, RF-14.1).
  - Migración Dexie v4, aditiva y probada, para catálogo versionado, progreso y respuestas del Radar (RNF-5).
### Eliminado
- Los generadores provisionales `import-puzzles.mjs` y `build-seed-puzzles.mjs`, reemplazados por el único pipeline reproducible `build-radar-dataset.mjs`.
### Cambiado
- docs(design-system): v2 — jerarquía de texto de 4 niveles, variantes `-hover`/`-subtle`, anillo de foco, especificación completa de tablero y piezas (§3), estados obligatorios por componente (§5), tipografía Newsreader + Instrument Sans + IBM Plex Mono, layout héroe validado para "Tu sesión de hoy" (§4.1) y flujo del Radar (§4.2).
- El proyecto pasa a llamarse **ELOmax** (antes FORGE); nombre actualizado en README, PRD (v0.2.1), CONTRIBUTING y design system. Los documentos de `docs/evidence/` conservan sus nombres de archivo originales por trazabilidad.
- PRD v0.2.3: el árbol del repo (§10) incluye `public/` y `docs/prototipos/`; el inventario de licencias de RNF-8 registra el set de piezas.
- PRD v0.2.4: §6.2 lista explícitamente como fuera de alcance v1.0 los tres módulos del documento de diseño que el PRD no adopta ("Adiviná la jugada", aperturas dosificadas, Maia selectora de posiciones), como candidatos post-v1.0.
- Flujo de trabajo generalizado para cualquier persona o agente de IA: CONTRIBUTING.md como única fuente de verdad de proceso, con patrón puntero para archivos de contexto específicos de herramientas.
- CONTRIBUTING.md: sección Comandos completada (entregable de Fase 0); README con instrucciones para correr la app.
### Corregido
- GitHub Pages en blanco: la página publicaba el repo sin compilar (fuente "rama") y la app usaba rutas absolutas que se rompen bajo el subpath `/ajedrez/`. Ahora todas las rutas a assets (motor, piezas, íconos, manifest) son relativas a `import.meta.env.BASE_URL`, y el despliegue compila con `BASE_PATH=/ajedrez/`. Requiere fuente de Pages = GitHub Actions.
- README: eliminada la instrucción ya cumplida de agregar `LICENSE` y la guía de volcado inicial del paquete documental (pasos ya ejecutados); queda como pendiente solo copiar los documentos de evidencia.
- Changelog: el enlace de Keep a Changelog apunta a la versión canónica en inglés (la variante `es-AR` no está publicada).
- Licencia del set Staunty precisada como **CC BY-NC-SA 4.0**, verificada en `lichess-org/lila/COPYING.md` (antes decía "licencia libre", impreciso: la cláusula NC restringe el uso comercial). Corregido en design system §3.1 y en el README del set.
- `CHANGELOG-snippet.md` integrado a este changelog y eliminado.
- Prototipos: movidos de la raíz a `docs/prototipos/` con nombres kebab-case, y rutas de piezas corregidas para apuntar a `public/piece/staunty/` (referenciaban una carpeta `pieces/` inexistente).
- README de `docs/evidence/`: ahora dice explícitamente que los tres documentos de investigación están pendientes de copia (antes afirmaba que ya vivían ahí).

## [0.0.1] — 2026-07-16
### Agregado
- Inicio del repositorio.
