# ADR-0007 — Dificultad normalizada del Radar

- **Estado:** Aceptado
- **Fecha:** 2026-07-19
- **Requisitos relacionados:** RF-5.5, RF-5.6, RF-12.1, RNF-5

## Contexto
El catálogo del Radar combina ratings que no son comparables: rating de puzzle de Lichess, Elo promedio de los jugadores de una partida para posiciones tranquilas y un valor fijo para contenido generado por autojuego. Usarlos como una única escala hace que el selector adapte una magnitud sin significado común y vuelve no verificable la convergencia al 60–80% de acierto exigida por RF-5.5.

La app es local-first y no dispone de datos agregados de muchos usuarios para estimar una dificultad absoluta por ítem. Tampoco se debe descartar el rating original: sigue siendo procedencia útil para auditar y regenerar el catálogo.

## Decisión
El selector usa una **dificultad interna normalizada de 0 a 100**, calculada como el percentil del rating de cada ítem dentro de su cohorte de procedencia (`fuente`). Los empates reciben el percentil medio; por eso una cohorte sin variación queda honestamente en 50 hasta disponer de una señal mejor.

El progreso personal persiste un `dificultadCentro` en esa escala y lo desplaza según la tasa de acierto reciente. El `rating` original permanece sin cambios en el catálogo y en cada intento para trazabilidad. Los intentos nuevos registran además la dificultad normalizada que efectivamente usó el selector.

Al migrar desde la escala heterogénea anterior, el centro se reinicia en 50: no existe una conversión válida desde un número que mezclaba unidades incompatibles. El historial de aciertos, tipos e ítems servidos se conserva.

## Alternativas consideradas
- **Conversión lineal única de 800–2000 a 0–100** — conserva exactamente el problema: trata Elo de jugadores, rating de puzzle y el 1500 fijo como una misma unidad.
- **Asignar dificultad con Stockfish** — profundidad o diferencia de centipeones no predicen por sí solas la dificultad humana de encontrar una jugada.
- **Rating empírico por ítem y usuario** — el catálogo es grande para una sola persona y la repetición introduce familiaridad; habría muy pocas observaciones independientes por posición.
- **Eliminar toda adaptación** — sería honesto respecto de los datos, pero incumple RF-5.5 y pierde una de las funciones centrales del Radar.

## Consecuencias
El selector deja de favorecer o excluir una fuente por diferencias arbitrarias de escala y puede adaptar todas las cohortes con una magnitud común. El costo es que el percentil solo expresa orden relativo dentro de cada fuente; no demuestra que una posición tranquila en percentil 70 sea tan difícil como un puzzle táctico en percentil 70. Las cohortes de rating constante quedan en el centro y se sirven con variedad, sin fingir una precisión inexistente.

La señal para revisar esta decisión será disponer de suficientes intentos comparables de uso real para calibrar dificultad por fuente o por ítem sin mezclar familiaridad con dificultad inicial.
