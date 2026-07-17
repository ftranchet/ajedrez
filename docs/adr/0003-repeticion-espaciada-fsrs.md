# ADR-0003 — Repetición espaciada: FSRS

- **Estado:** Aceptado
- **Fecha:** 2026-07-16
- **Requisitos relacionados:** E4, RF-6.3

## Contexto
La Cola Universal y el currículo necesitan un planificador de repasos. La evidencia respalda el espaciado; falta elegir el algoritmo.

## Decisión
**FSRS** (Free Spaced Repetition Scheduler) vía la librería `ts-fsrs`, con parámetros por defecto. El estado FSRS (due, stability, difficulty, reps, lapses) se persiste por tarjeta con el esquema de la librería para permitir recalibración futura sin migración destructiva.

## Alternativas consideradas
- **SM-2 (el clásico de Anki viejo)** — más simple, pero intervalos peores con el mismo esfuerzo de integración; FSRS es el estado del arte con librería mantenida.
- **Planificador propio ad hoc** — reinventar mal un problema resuelto; costo de mantenimiento sin beneficio.
- **Leitner simple** — insuficiente para tarjetas con dificultad heterogénea (errores propios vs. patrones).

## Consecuencias
Intervalos de calidad probada y camino abierto a optimizar parámetros con los propios datos del usuario (Fase 5+). Riesgo bajo: dependencia de una librería externa para el corazón del dominio — mitigado encapsulándola detrás de un puerto en `core/scheduler` con tests propios, de modo que un reemplazo no toque al resto.
