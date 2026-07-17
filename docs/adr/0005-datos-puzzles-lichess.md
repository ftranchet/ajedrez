# ADR-0005 — Datos de entrenamiento: dataset de puzzles de Lichess (CC0)

- **Estado:** Aceptado
- **Fecha:** 2026-07-16
- **Requisitos relacionados:** RF-5.6, E6

## Contexto
El Radar y el currículo necesitan millones de posiciones etiquetadas por tema y rating, con licencia que permita redistribución.

## Decisión
Usar el **dataset abierto de puzzles de Lichess** (licencia CC0, CSV descargable con FEN, jugadas, rating, temas y popularidad) procesado por un **pipeline propio offline** que: filtra por calidad y rating, balancea temas, deriva subconjuntos defensivos, y genera las **posiciones tranquilas** del Radar a partir de partidas reales verificando con Stockfish que ninguna jugada gana material ni mueve la evaluación más de un umbral configurable. El resultado se empaqueta en lotes versionados que la app descarga una vez y guarda localmente.

## Alternativas consideradas
- **Generar puzzles propios desde cero** — reinventa un dataset maduro de millones de posiciones ya validadas por uso masivo.
- **Consumir la interfaz de puzzles de Lichess en runtime** — acopla el entrenamiento diario a la conexión y a límites de tasa; contradice el modo sin conexión.
- **Datasets comerciales (Chess.com, CT-ART)** — licencias incompatibles con un proyecto abierto.

## Consecuencias
Contenido de calidad, gratis y redistribuible; el costo es mantener el pipeline (un script reproducible en el repo) y validar el generador de posiciones tranquilas, cuyo riesgo de falsos positivos está registrado en el PRD §11 con mitigación (umbrales conservadores + verificación a mayor profundidad + reporte de usuario).
