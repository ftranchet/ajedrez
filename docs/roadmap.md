# Roadmap — construcción incremental

Documento vivo. Sin fechas: cada fase tiene entregables y un **criterio de salida** verificable. No se arranca una fase sin cerrar la anterior (excepción: documentación y pipeline de datos pueden adelantarse). Cada fase deja una app usable por sí misma.

## Fase 0 — Fundaciones
**Estado:** ✅ Completa. Verificado en emulación (celular y escritorio); pendiente validar en un dispositivo físico real.
**Entregables:** repo inicializado (Vite + React + TS estricto + Tailwind + PWA), CI en GitHub Actions (lint, typecheck, test), estructura `ui/core/services/config`, tokens del design system aplicados, tablero chessground funcionando con partida local contra Stockfish WASM (RF-1.1, 1.2, 1.3), persistencia Dexie con esquema v1 y primera migración de prueba, CONTRIBUTING.md completado con comandos; `LICENSE` con el texto oficial de GPLv3 (ADR-0006).
**Criterio de salida:** en un celular y en una computadora se juega una partida completa contra el motor, queda guardada, sobrevive al cierre del navegador, y la CI está en verde.

## Fase 1 — Radar + Cola Universal (el MVP diferencial)
**Estado:** 🟡 Completa técnicamente; pendiente la validación de uso real de siete días indicada en el criterio de salida. No se marca como cerrada hasta medir esa experiencia con una persona.
**Entregables:** lote real `radar-84639d96e9b3` con 100 posiciones de Lichess CC0 y partidas reales verificadas por Stockfish (20 por tipo; procedimiento en `docs/radar-dataset.md`) ✅; pipeline reproducible que filtra rating/popularidad, balancea tipos y genera tranquilas ✅; el Radar completo (E5, sin doble solución todavía) ✅; Cola Universal con FSRS (E4) ✅; calibración muestreada (RF-10.1, 10.2) ✅; progreso de dificultad y tasa de acierto persistentes entre sesiones (RF-5.5) ✅; sesión simple (Cola vencida + Radar) ✅; exportación e importación de tarjetas, calibración, progreso e historial del Radar (RF-14.1, 14.2) ✅.
**Criterio de salida:** un usuario entrena 15 minutos diarios durante una semana solo con Radar+Cola; los fallos reaparecen espaciados; la tasa de acierto converge a 60–80%; una exportación hecha en un dispositivo restaura el estado completo en otro. *(El espaciado, la restauración y la medición persistente están cubiertos por tests; falta registrar la semana de uso real, que no se puede sustituir por automatización.)*

## Fase 2 — Partidas y análisis en dos fases
**Estado:** 🟡 Criterio de salida cumplido y verificado end-to-end; dos entregables quedan bloqueados por una limitación del entorno de desarrollo actual, no por falta de trabajo.
**Entregables:** análisis en dos fases completo (E3) con extracción de errores a la Cola ✅; importación manual de PGN (RF-2.2, RF-2.4) ✅; partidas contra bots Maia vía Lichess (RF-1.4) con fallback local ⬜️ — **bloqueado:** este entorno no tiene acceso de red a `lichess.org`; importación automática de historial Lichess/Chess.com (RF-2.1, RF-2.3) ⬜️ — **bloqueado:** sin acceso a `lichess.org`/`api.chess.com` (mismo límite que impidió validar Maia en Fase 1); modo exprés para lotes (RF-3.5) ⬜️ — no bloqueado, prioridad menor, queda para una iteración posterior.
**Criterio de salida:** el ciclo completo funciona — jugar una partida lenta, analizarla en dos fases, confirmar tarjetas de error, y verlas aparecer en la sesión del día siguiente. *Verificado end-to-end con Playwright contra Stockfish real en el Worker del navegador (no un doble): partida jugada localmente (o importada por PGN) → fase 1 (momento crítico, plan, evaluaciones) → fase 2 corre el motor recién ahí y detecta un blunder verificado → error confirmado y categorizado → tarjeta nueva → reaparece como repaso vencido en la sesión siguiente.* El motor Maia no participa de este criterio (el roadmap no lo exige para el ciclo básico), así que su bloqueo por red no impide cerrar la fase; queda anotado como deuda para cuando haya acceso a Lichess.

## Fase 3 — Prescriptor + currículo base
**Entregables:** currículo de patrones intercalados y finales contra motor (E6); Prescriptor con dieta por banda de Elo en JSON versionado, ajuste por fugas y porqués visibles (E11); diagnóstico inicial; panel de verdad v1 (RF-12.1).
**Criterio de salida:** un usuario nuevo pasa por diagnóstico y recibe sesiones prescritas coherentes con su nivel sin tocar ningún menú.

## Fase 4 — Módulos avanzados
**Entregables:** cálculo comprometido + Stoyko (E7); conversión de ventajas contra Maia (E8); triage de reloj (E9); doble solución y regla de candidatas (RF-5.7, 5.8); modificador a ciegas (RF-6.5).
**Criterio de salida:** el Prescriptor incorpora los módulos nuevos a la dieta según fugas, y el subtipo doble solución registra la tasa de conformismo.

## Fase 5 — Medición completa
**Entregables:** batería de transferencia (RF-12.2); detector de sobreajuste (RF-12.3); panel de calibración con lectura en lenguaje claro (RF-10.3); modo experimento n=1 (RF-12.4); adherencia honesta (E13).
**Criterio de salida:** la app puede responder, con datos propios del usuario, "¿está funcionando este entrenamiento?".

## Fase 6+ — Extensiones (cada una con su ADR previo)
Candidatas: sincronización opcional en la nube, Maia self-hosted con niveles finos, inglés, cuentas para entrenadores con alumnos, cohortes agregadas con consentimiento para evidencia de eficacia.
