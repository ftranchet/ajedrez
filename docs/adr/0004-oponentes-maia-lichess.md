# ADR-0004 — Oponentes humano-realistas: Maia vía bots de Lichess

- **Estado:** Aceptado
- **Fecha:** 2026-07-16
- **Requisitos relacionados:** RF-1.4, E8

## Contexto
El producto requiere oponentes que cometan errores humano-plausibles (sparring y defensa en conversión). Maia es la única familia de modelos con esa propiedad documentada. Correr Maia localmente exige empaquetar una red neuronal (lc0/ONNX), costo alto para el MVP.

## Decisión
En v0.x–v1.0, jugar contra **los bots maia1 / maia5 / maia9 de Lichess** (≈1100/1500/1900) mediante la interfaz de programación de Lichess con token personal del usuario. El **motor local con fuerza limitada queda como fallback** sin conexión, señalando honestamente su límite ("resistencia no humana").

## Alternativas consideradas
- **Self-hosting de Maia (lc0 + pesos) u ONNX en el navegador** — mejor granularidad de niveles, pero complejidad y peso desproporcionados para el MVP; queda como evolución natural (Fase 6+, ADR nuevo).
- **Stockfish capado como único oponente** — barato pero pedagógicamente inferior: juega perfecto y de golpe regala; no modela errores humanos.

## Consecuencias
Cero infraestructura propia y errores humano-realistas desde la Fase 2, a cambio de: requiere conexión y cuenta de Lichess, y solo 3 niveles (suficiente para bandas 900–1900 del usuario objetivo). Señal de revisión: demanda real de niveles intermedios o fricción del token → evaluar self-hosting.
