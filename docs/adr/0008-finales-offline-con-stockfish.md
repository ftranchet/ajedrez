# ADR-0008 — Demostración offline de finales contra Stockfish

- **Estado:** Aceptado
- **Fecha:** 2026-07-19
- **Requisitos relacionados:** RF-6.2, RF-6.3, RF-6.4, RNF-2, RNF-5

## Contexto

RF-6.2 exige jugar finales elementales contra defensa perfecta hasta demostrar la técnica. Las tablebases de Lichess son la verificación ideal (RF-6.4), pero dependen de red y la PWA debe funcionar offline. `chess.js` arbitra legalidad y resultado, pero no puede decidir si una posición intermedia sigue ganada o en tablas.

## Decisión

El catálogo inicial contiene cuatro posiciones de hasta siete piezas: oposición de rey y peón, regla del cuadrado, Lucena y Philidor. Un script versionado verifica sus FEN y resultados con Stockfish 18 a profundidad 22 antes de publicarlos.

Durante el ejercicio, Stockfish juega a máxima fuerza mediante `EnginePort.evaluate`, no con un nivel limitado. En posiciones ganadas, la demostración termina al promocionar o ganar, y falla si la evaluación deja de ser claramente ganadora. En Philidor, alcanza con llegar a tablas reglamentarias o sostener una evaluación de tablas durante doce jugadas propias contra la mejor defensa; exigir la regla de cincuenta jugadas convertiría una comprobación didáctica en una sesión desproporcionada.

Cada resultado actualiza el mismo progreso FSRS del currículo. Un fallo intenta crear una tarjeta posicional con origen `final` en la Cola Universal. Los finales se ofrecen en `Jugar → Finales teóricos`, separados del bloque breve de patrones de la sesión diaria porque su interacción es una partida completa y no una solución de una jugada.

## Alternativas consideradas

- **Consultar tablebases de Lichess en cada jugada** — da prueba exacta, pero rompe el funcionamiento offline; queda como sello opcional futuro de RF-6.4.
- **Esperar siempre el resultado reglamentario** — sirve para posiciones ganadas, pero en defensas teóricas puede exigir cincuenta jugadas sin agregar evidencia útil.
- **Usar solo evaluación estática o material** — no certifica oposición, Lucena ni Philidor.
- **Incluir los finales en el bloque actual de currículo** — mezcla partidas largas con ejercicios de una jugada y rompe su duración prescrita.

## Consecuencias

La biblioteca es pequeña pero reproducible, offline y honesta sobre su criterio. Stockfish a profundidad finita no equivale a una tablebase; por eso el catálogo se limita a posiciones elementales verificadas y la interfaz no muestra un sello de “jugada perfecta”. Cuando RF-6.4 esté disponible, la tablebase puede implementar una segunda certificación detrás de un puerto sin cambiar el progreso del usuario.
