# CONTRIBUTING.md — reglas de trabajo (personas y agentes de IA)

Este documento es la única fuente de verdad del proceso de trabajo. Aplica por igual a cualquier colaborador: una persona, un agente de IA, o una persona asistida por uno. Si algo acá contradice a una herramienta puntual, gana este documento.

## Qué es este proyecto
ELOmax: entrenador de ajedrez basado en evidencia. Aplicación web progresiva, local-first, en español, de código abierto bajo GPLv3. La fuente de verdad de producto es `docs/PRD.md`; las decisiones técnicas viven en `docs/adr/`; la justificación científica en `docs/evidence/`.

## Contexto mínimo antes de trabajar
Todo colaborador (humano o IA) carga antes de tocar código: (1) este documento, (2) la sección del PRD de la épica en curso, (3) los ADRs relacionados, (4) `docs/design-system.md` si el cambio toca interfaz.

## Reglas
1. **Antes de implementar una épica, leer su sección del PRD** y citar los requisitos (`RF-x.y`) en commits y pull requests.
2. **Decisión con costo de reversa alto → primero un ADR** (usar `docs/adr/0000-plantilla.md`), después el código. Nunca al revés.
3. **No romper datos guardados**: todo cambio al modelo de datos incluye migración de Dexie versionada + test que migra datos de la versión anterior.
4. `core/` es dominio puro: sin React, sin Dexie, sin fetch. Recibe puertos. Si un cambio necesita violar esto, es un ADR.
5. Tests obligatorios para: scheduler FSRS, prescriptor, extractor de errores, migraciones, pipeline de posiciones. No testear reglas de ajedrez (las provee la librería).
6. Cada pull request actualiza `CHANGELOG.md` (sección Sin publicar). Si hubo desvío del PRD, actualizar el PRD en el mismo PR.
7. Interfaz en español rioplatense; textos en archivos de i18n, nunca hardcodeados en componentes.
8. Estética: respetar `docs/design-system.md` (tokens, nada de estilos ad hoc).
9. Convención de commits: `tipo(alcance): descripción` — feat/fix/docs/refactor/test/chore.
10. No agregar dependencias sin justificarlo en el PR; si es estructural, ADR.

## Archivos de contexto específicos de herramientas
Si una herramienta de IA requiere su propio archivo de contexto (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `GEMINI.md` u otro), ese archivo debe contener **únicamente** una instrucción puntero:

> Leer `CONTRIBUTING.md` y la sección relevante de `docs/PRD.md` antes de trabajar. Las reglas de ese documento son obligatorias.

Nunca duplicar reglas en esos archivos: la duplicación diverge, y la divergencia rompe la robustez del proceso.

## Comandos
Requiere Node 20+.

```
npm install        # instala dependencias y copia el motor a public/engine/
npm run dev        # servidor de desarrollo (Vite)
npm run build      # typecheck + build de producción (dist/)
npm run preview    # sirve el build de producción
npm test           # tests (Vitest): dominio y migraciones
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (TypeScript estricto)
npm run verify:finales # valida FEN y resultado del catálogo de finales con Stockfish 18
```

```
npm run e2e        # tests de punta a punta (Playwright) sobre el build de producción
```

La CI (GitHub Actions) corre lint + typecheck + test + verificación de finales + build en cada push; no se mergea en rojo (RNF-5). El job `e2e` además juega una partida real contra el motor sobre el build de producción, dos veces: con base `/` y con base `/ajedrez/` (el subpath de GitHub Pages).

## Estrategia de tests
1. **Unitarios de dominio** (`src/**/*.test.ts`, Vitest): obligatorios para todo módulo de `core/` (regla 5) y para toda migración de esquema (regla 3). Corren en milisegundos; son la primera línea.
2. **E2E del flujo crítico** (`e2e/*.spec.ts`, Playwright): el criterio de salida de cada fase se codifica como spec e2e que corre en CI sobre el build de producción, en viewport de celular y de escritorio, y contra ambas bases de despliegue. Fase 0: jugar contra el motor, guardar, sobrevivir a la recarga. Fase 1: Radar (evaluación → jugada → calibración muestreada → feedback), Cola (prioridad de vencidas), exportación.
   - **Nota sobre pixel-clicking del tablero:** chessground no pone listeners en los elementos `<piece>` (tienen `pointer-events` deshabilitado a propósito; el click lo captura `<cg-board>` y calcula la casilla por coordenadas) y el tablero se reorienta según quién mueve (RF-5.2, convención tipo Lichess). Todo spec que clickee el tablero debe calcular coordenadas por píxel leyendo la clase `orientation-white`/`orientation-black` del `.cg-wrap`, nunca asumir una orientación fija ni clickear elementos de pieza directamente.
3. **Regla al agregar una épica**: la épica no está "hecha" sin (a) unitarios de su lógica en `core/`, (b) un spec e2e de su flujo principal si tiene interfaz, y (c) migración probada si toca el modelo de datos (RNF-5, definición de "hecho").

## Despliegue
`main` se publica automáticamente en GitHub Pages (workflow `deploy-pages.yml`, build con `BASE_PATH=/ajedrez/`). La fuente de Pages en la configuración del repo debe ser **GitHub Actions**, no una rama: publicar la rama sirve el código sin compilar y la página queda en blanco. Toda ruta a assets en el código usa `import.meta.env.BASE_URL` (nunca `/` absoluto), para que la app funcione en cualquier base.

## Estado actual
El estado por fase vive en un solo lugar: `docs/roadmap.md` (documento vivo, con criterio de salida por fase). No se duplica acá — la duplicación diverge, como ya pasó cuando esta sección decía "Fase 1" con el roadmap en Fase 4.
