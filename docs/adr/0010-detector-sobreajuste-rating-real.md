# ADR-0010 — Detector de sobreajuste con rating real

**Estado:** Aceptado
**Fecha:** 2026-07-19

## Contexto

RF-12.3 pide alertar cuando el nivel interno de ejercicios mejora durante ocho
semanas sin una mejora equivalente en partidas. La banda del diagnóstico no es
un rating observado y el rating crudo del catálogo mezcla fuentes incompatibles.
Usarlos produciría una alerta precisa en apariencia, pero falsa.

## Decisión

- Medir el nivel interno con `dificultadNormalizada` de intentos del catálogo
  del Radar; excluir errores propios reciclados porque no tienen dificultad
  calibrada.
- Medir juego real únicamente con el Elo del usuario en partidas rápidas o
  clásicas. Guardar el color y el Elo al importar: tomar `WhiteElo`/`BlackElo`
  del PGN cuando existen y permitir que el usuario aporte el valor si falta.
- Comparar la mediana de las primeras dos semanas contra la de las últimas dos
  dentro de una ventana fija de 56 días. Exigir al menos tres intentos de Radar
  y una partida rated en cada extremo.
- Considerar mejora interna un aumento mínimo de cinco percentiles. Alertar si
  ese aumento ocurre y el Elo de partidas no sube.
- Mostrar una sugerencia explícita de priorizar partidas rápidas/clásicas con
  análisis. No cambiar automáticamente la dieta: la señal es escasa y una
  intervención silenciosa sería una conclusión más fuerte que los datos.

## Consecuencias

El detector permanece honestamente en “datos insuficientes” durante las
primeras ocho semanas o si faltan partidas con rating real. La alerta queda
protegida de bullet, bandas estimadas y contenido personal sin escala. El
umbral de cinco percentiles es una heurística versionada, no una estimación
causal; podrá revisarse con datos de uso mediante un ADR nuevo.
