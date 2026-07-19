# Registros de Decisión de Arquitectura (ADR)

Un ADR documenta una decisión con costo de reversa alto: qué se decidió, en qué contexto, qué alternativas se consideraron y qué consecuencias se aceptan. Se escribe **antes** de implementar.

**Reglas:**
1. Numeración secuencial `NNNN-titulo-corto.md`. Los ADRs son **inmutables**: para cambiar una decisión se escribe uno nuevo y se marca el viejo como "Reemplazado por ADR-XXXX".
2. Disparadores de ADR: dependencia estructural nueva, formato de datos persistidos, algoritmo del dominio (scheduler, prescriptor), integración externa, cualquier cosa que duela deshacer en más de un día.
3. Cortos: una página. Si necesita más, el problema no está bien recortado.

## Índice
| Nº | Título | Estado |
|---|---|---|
| 0001 | Stack y arquitectura local-first | Aceptado |
| 0002 | Motor de análisis: Stockfish WASM en el cliente | Aceptado |
| 0003 | Repetición espaciada: FSRS | Aceptado |
| 0004 | Oponentes humano-realistas: Maia vía bots de Lichess | Aceptado |
| 0005 | Datos de entrenamiento: dataset de puzzles de Lichess (CC0) | Aceptado |
| 0006 | Licencia del proyecto: GPLv3 | Aceptado |
| 0007 | Dificultad normalizada del Radar | Aceptado |
| 0008 | Demostración offline de finales contra Stockfish | Aceptado |
| 0009 | Batería de transferencia reservada y sin feedback por ítem | Aceptado |
| 0010 | Detector de sobreajuste con rating real | Aceptado |
| 0011 | Adherencia basada en proceso y métricas de verdad | Aceptado |
