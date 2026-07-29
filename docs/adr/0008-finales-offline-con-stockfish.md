# ADR-0008 — Demostración offline de finales contra Stockfish

- **Estado:** Aceptado (criterio de aprobación revisado el 2026-07-29, ver abajo)
- **Fecha:** 2026-07-19
- **Requisitos relacionados:** RF-6.2, RF-6.2a, RF-6.3, RF-6.4, RNF-2, RNF-5

## Contexto

RF-6.2 exige jugar finales elementales contra defensa perfecta hasta demostrar la técnica. Las tablebases de Lichess son la verificación ideal (RF-6.4), pero dependen de red y la PWA debe funcionar offline. `chess.js` arbitra legalidad y resultado, pero no puede decidir si una posición intermedia sigue ganada o en tablas.

## Decisión

El catálogo inicial contiene cuatro posiciones de hasta siete piezas: oposición de rey y peón, regla del cuadrado, Lucena y Philidor (16 desde 2026-07-29, sumando las versiones defensivas, el peón de torre y los mates elementales). Un script versionado verifica sus FEN y resultados con Stockfish 18 a profundidad 22 antes de publicarlos.

Durante el ejercicio, Stockfish juega a máxima fuerza mediante `EnginePort.evaluate`, no con un nivel limitado. En posiciones ganadas, la demostración termina al promocionar o ganar, y falla si la evaluación deja de ser claramente ganadora. En Philidor, alcanza con llegar a tablas reglamentarias o sostener una evaluación de tablas durante doce jugadas propias contra la mejor defensa; exigir la regla de cincuenta jugadas convertiría una comprobación didáctica en una sesión desproporcionada.

Cada resultado actualiza el mismo progreso FSRS del currículo. Un fallo intenta crear una tarjeta posicional con origen `final` en la Cola Universal. Los finales se ofrecen en `Jugar → Finales teóricos`, separados del bloque breve de patrones de la sesión diaria porque su interacción es una partida completa y no una solución de una jugada.

## Revisión 2026-07-29 — qué cuenta como demostrar la técnica

El criterio de arriba ("termina al promocionar o ganar, y falla si la evaluación deja de ser claramente ganadora") acreditaba técnicas que el usuario no había ejecutado, y un reporte de uso lo describió exactamente así: *"hay algunas que se finalizan y no es claro que haya aprendido el final"*.

Dos caminos lo producían:

1. **"Ganar" se leía como "el motor se ve perdido".** En rey y torre o rey y dama contra rey, Stockfish a profundidad 18 reporta mate **contra sí mismo** después de casi cualquier primera jugada razonable. Ese reporte cerraba el ejercicio: una jugada, "técnica demostrada" y una demostración limpia anotada en el planificador, camino a la automatización. Es la clase de métrica complaciente que el producto dice no querer.
2. **Coronar era terminal por sí solo.** Coronar ahogando al rival, o perder la dama recién coronada por el jaque en la espalda —el error que Lucena enseña a evitar—, también contaba.

**Decisión revisada:** cada final del catálogo declara su objetivo (`objetivo: 'mate' | 'coronar'`, deducible de la posición para ítems viejos) y la aprobación lo sigue al pie:

- **Mate**: hay que darlo. Ahogar, repetir o llegar a las cincuenta jugadas es perder la técnica, igual que en la partida. La objeción de 2026-07-19 —que esperar el resultado reglamentario alarga la comprobación sin agregar evidencia— vale para las **defensas**, donde el resultado puede tardar cincuenta jugadas sin decir nada nuevo; no vale para un mate elemental, donde ese resultado **es** la técnica y se alcanza en una veintena de jugadas.
- **Coronar**: hay que coronar y que la evaluación posterior confirme que la posición sigue decidida (umbral propio, más exigente que "todavía no está perdido").
- **Tablas**: sin cambios — tablas reglamentarias o doce jugadas propias sosteniendo la defensa.

Perder la técnica ahora también **muestra** el punto crítico: el tablero vuelve a la posición anterior a la última jugada propia y dibuja la que el motor prefería (RF-5.3d). Si esa jugada propia era la mejor —lo típico al no llegar al mate dentro de las cincuenta jugadas—, no se crea tarjeta de error: repasar "no repitas la jugada correcta" es peor que no repasar nada.

## Alternativas consideradas

- **Consultar tablebases de Lichess en cada jugada** — da prueba exacta, pero rompe el funcionamiento offline; queda como sello opcional futuro de RF-6.4.
- **Esperar siempre el resultado reglamentario** — sirve para posiciones ganadas, pero en defensas teóricas puede exigir cincuenta jugadas sin agregar evidencia útil.
- **Usar solo evaluación estática o material** — no certifica oposición, Lucena ni Philidor.
- **Incluir los finales en el bloque actual de currículo** — mezcla partidas largas con ejercicios de una jugada y rompe su duración prescrita.

## Consecuencias

La biblioteca es pequeña pero reproducible, offline y honesta sobre su criterio. Stockfish a profundidad finita no equivale a una tablebase; por eso el catálogo se limita a posiciones elementales verificadas y la interfaz no muestra un sello de “jugada perfecta”. Cuando RF-6.4 esté disponible, la tablebase puede implementar una segunda certificación detrás de un puerto sin cambiar el progreso del usuario.
