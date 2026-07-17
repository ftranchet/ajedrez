# ADR-0002 — Motor de análisis: Stockfish WASM en el cliente

- **Estado:** Aceptado
- **Fecha:** 2026-07-16
- **Requisitos relacionados:** RF-3.2, RF-6.2, RNF-2, RNF-3, RNF-8

## Contexto
El análisis de partidas, la verificación del pipeline de posiciones y los finales contra defensa perfecta necesitan un motor fuerte, disponible sin conexión y sin costo de servidor.

## Decisión
**Stockfish compilado a WebAssembly**, corriendo en Web Worker, con build multihilo cuando el hosting sirva cabeceras COOP/COEP y fallback a un hilo. Presupuesto por posición configurable (por defecto profundidad 18 o 3 s en posiciones críticas).

## Alternativas consideradas
- **Motor en servidor** — costo recurrente, latencia, rompe el modo sin conexión.
- **Interfaz de análisis de Lichess** — excelente pero dependiente de conexión y de límites de tasa; queda como complemento (tablebases), no como núcleo.
- **Motores JS más débiles** — insuficientes para clasificar errores con confianza.

## Consecuencias
Análisis gratis e ilimitado en el dispositivo; el costo es rendimiento en equipos viejos (mitigado por presupuesto configurable y análisis diferido). **Licencia:** Stockfish es GPLv3 y servir su build al navegador constituye distribución → el proyecto se publica como **código abierto bajo GPLv3** (formalizado en ADR-0006; alineado con el ecosistema del que se nutre: Lichess, Maia, dataset CC0). Señal de revisión: si alguna vez se quisiera cerrar el código, habría que aislar o reemplazar el motor — ADR nuevo.
