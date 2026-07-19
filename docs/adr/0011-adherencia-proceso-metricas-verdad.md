# ADR-0011 — Adherencia basada en proceso y métricas de verdad

**Estado:** Reemplazado parcialmente por ADR-0013 (la racha diaria deja de ser el indicador principal; se conservan las reglas de proceso y métricas de verdad)
**Fecha:** 2026-07-19

## Contexto

E13 busca sostener la práctica sin empujar al usuario a resolver más ejercicios
fáciles, perseguir aciertos o confundir actividad con mejora. Una racha típica
por volumen contradice la jerarquía del Panel: juego real primero, actividad
después.

## Decisión

- Contar la racha por días calendario locales con al menos una sesión
  prescrita completada. Varias sesiones el mismo día valen uno; las abandonadas,
  la cantidad de ítems y el resultado no participan.
- Mantener visible la racha de ayer mientras hoy todavía está abierto, sin
  convertir la mañana en una racha perdida.
- Derivar la celebración de errores `grave`/`error` del usuario en partidas
  analizadas: últimos 30 días contra los 30 anteriores.
- Exigir al menos tres partidas atribuibles por ventana y una reducción mínima
  de 20%. Sin evidencia suficiente o sin mejora, no mostrar celebración.
- Usar un panel sobrio, sin confeti ni animación. Las métricas se derivan de
  datos existentes y no agregan estado persistido ni una nueva recompensa.

## Consecuencias

La racha mide consistencia sin premiar volumen. La celebración puede tardar en
aparecer, especialmente al inicio, pero cuando aparece se apoya en juego real.
La comparación de dos ventanas sigue siendo descriptiva y no prueba que el
entrenamiento causó la mejora; el texto comunica el cambio observado, no
causalidad.
