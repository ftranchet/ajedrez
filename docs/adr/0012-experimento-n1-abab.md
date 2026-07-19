# ADR-0012 — Experimento n=1 con diseño ABAB fijo

**Estado:** Aceptado
**Fecha:** 2026-07-19

## Contexto

RF-12.4 debe permitir que una persona compare dos énfasis de entrenamiento
sin presentar una observación individual como evidencia causal. El producto ya
registra proceso, partidas analizadas y rating real, pero esos datos ocurren en
escalas distintas y pueden cambiar por factores ajenos al entrenamiento.

## Decisión

- Usar un diseño fijo A1–B1–A2–B2 de ocho semanas, con bloques de 14 días y
  dos modalidades distintas elegidas al inicio.
- Registrar una línea base de los 30 días anteriores y objetivos semanales de
  dosis. Radar cuenta respuestas de sesiones completas; Cálculo cuenta intentos
  de línea comprometida y Stoyko; Partidas + análisis cuenta análisis cerrados.
- Congelar al cierre de cada bloque la dosis observada, los errores
  `grave`/`error` por partida analizada y el último rating real de rápida o
  clásica. Los cierres son automáticos e idempotentes al abrir el experimento.
- Comparar A contra B mediante la media ponderada por partidas analizadas y
  exigir al menos tres partidas por condición. Informar asociación descriptiva,
  empate práctico o insuficiencia; nunca declarar causalidad.
- Persistir configuración, línea base y snapshots en `n1Experiments` (esquema
  Dexie v14), e incluirlos en exportación/restauración.
- Mantener visibles las advertencias sobre ausencia de control, efectos de
  orden, aprendizaje acumulado, rivales, fatiga y cambios concomitantes.

## Consecuencias

El usuario obtiene un protocolo reproducible y auditable sin carga manual para
la medición. Ocho semanas y el mínimo de partidas hacen que el resultado tarde,
pero evitan conclusiones tempranas. El diseño no aísla causalidad ni corrige
automáticamente confusores; esa limitación es deliberada y se comunica en la
misma pantalla que el resultado.
