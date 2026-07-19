# ADR-0009 — Batería de transferencia reservada y sin feedback por ítem

**Estado:** Aceptado
**Fecha:** 2026-07-19

## Contexto

RF-12.2 pide medir cada 6–8 semanas con 30 posiciones nunca entrenadas. Usar
ítems del Radar, del currículo o de Stoyko haría circular la respuesta correcta
por la app y contaminaría el instrumento. Mostrar la solución al terminar cada
posición produciría el mismo problema para las tomas siguientes del set fijo.

## Decisión

- Mantener un catálogo embebido y versionado de exactamente 30 posiciones,
  separado de todos los catálogos de entrenamiento.
- Generarlo a partir de autojuegos nuevos de Stockfish: una posición como
  máximo por partida, mejor jugada estable entre profundidad 14 y 17 y margen
  mínimo de 90 cp contra la segunda opción; 15 posiciones con cada lado a
  mover y 10 en cada uno de tres tramos de la partida. El script reproducible es
  `scripts/mine-transfer-battery.mjs`.
- No revelar acierto, solución ni explicación por posición; mostrar únicamente
  el resultado agregado al completar las 30.
- No crear tarjetas de la Cola ni registros de Radar a partir de una respuesta.
- Persistir cada respuesta de inmediato para poder pausar y reanudar sin perder
  la toma. Ofrecer la primera toma de inmediato y las siguientes cada 49 días,
  el punto medio explícito del intervalo de 6–8 semanas.
- Comparar porcentajes solo entre tomas de la misma versión del catálogo e
  incluir el historial en exportación/restauración.

## Consecuencias

La app obtiene una medición separada de su entrenamiento y evita enseñar el
instrumento con su propio feedback. Repetir un set fijo todavía tiene posible
efecto de familiaridad, aunque se reduce al no revelar respuestas. Además, las
posiciones de la primera versión vienen de autojuego y no de partidas humanas
reales debido a la limitación de red vigente; por eso este resultado es una
señal interna de transferencia, no una prueba causal ni un reemplazo del rating
y los errores graves en partidas reales.
