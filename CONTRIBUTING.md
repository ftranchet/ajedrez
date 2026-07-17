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
(Completar en Fase 0 al inicializar el proyecto: dev, build, test, lint, typecheck.)

## Estado actual
Fase 0 — Fundaciones. Ver `docs/roadmap.md` para el criterio de salida de la fase.
