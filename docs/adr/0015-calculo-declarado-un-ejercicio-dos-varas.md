# ADR-0015 — Un solo ejercicio de cálculo declarado, con dos varas de medición

- **Estado:** Propuesto
- **Fecha:** 2026-07-30
- **Requisitos relacionados:** RF-7.1, RF-7.2, RF-7.3, RF-10.2, RF-11.3a, RF-12.4

## Contexto

E7 tiene hoy dos ejercicios que la interfaz presenta como métodos distintos, con
dos pantallas, dos modelos de datos y dos criterios de aprobación:

- **Línea comprometida** (RF-7.1): reutiliza el catálogo del Radar —cualquier
  ítem con solución de 3 a 7 plies ya es una línea forzada verificada—, se
  declara una línea ply a ply antes de que el tablero se mueva y se puntúa
  contra la solución (primer ply divergente). Unos 6 minutos.
- **Stoyko** (RF-7.2): 8 posiciones minadas por autojuego, elegidas porque **no**
  hay una jugada claramente mejor (hueco ≤50 cp entre la primera y la tercera
  candidata); se anotan varias jugadas candidatas, cada una con su evaluación, y
  se puntúa si la mejor del motor estuvo entre ellas. Entre 30 y 90 minutos.

Los dos son cortes del mismo procedimiento —enumerar candidatas, calcular cada
una hasta una posición evaluable, evaluar esas hojas, elegir—. El primero es una
rama calculada a fondo donde la rama correcta existe y es demostrable; el
segundo, el árbol entero donde no hay rama correcta y lo que se mide es el
criterio. **La app ya lo asume en el único lugar donde tiene que medir:** el
experimento n=1 (ADR-0012) cuenta la modalidad `calculo` como
`compromisoAttempts + stoykoAttempts`. Cuando hay que tratarlos como tratamiento,
ya son uno.

Tres hechos más, medidos sobre el código actual, fuerzan la decisión ahora:

1. **La implementación de Stoyko es más angosta que su requisito.** RF-7.2 pide
   "todas las **líneas** candidatas con evaluación"; se guardan jugadas sueltas
   (el primer ply de cada línea) con la evaluación pegada a la jugada, no al
   final de la línea. La simplificación estaba documentada en `stoykoStore.ts`,
   pero la pantalla la presentaba como el ejercicio completo (corregido en
   2026-07-30).
2. **La evaluación declarada se guarda y se tira.** El catálogo trae
   `StoykoItem.evaluacionMotor` en la misma escala `+− ± = ∓ −+` que declara el
   usuario, y `ContextoCalibracion` ya incluye `'stoyko'` porque RF-10.2 pide
   Brier por contexto. Ningún código lee ninguna de las dos cosas: la parte de
   calibración del juicio —el motivo por el que `docs/evidence/` valora este
   ejercicio— se recoge y se descarta.
3. **El contenido del ejercicio largo depende de un pipeline caro.** Las 8
   posiciones salieron de autojuego con Stockfish a ~1 candidata cada 70
   posiciones revisadas. Ocho posiciones para un ejercicio semanal se agotan en
   dos meses.

Restricciones que acotan la decisión: el principio 1 del PRD (prescribir, no
ofrecer un buffet) hace caro mantener dos pantallas para el mismo acto;
`CompromisoAttempt` y `StoykoAttempt` son datos del usuario ya persistidos
(esquema Dexie 17) y exportados, así que unificarlos es migración versionada con
test (CONTRIBUTING, regla 3); y RF-7.3 ya descartó cronometrar el ejercicio.

## Decisión

1. **Un solo ejercicio, "cálculo declarado":** declarás lo que ves antes de que
   el tablero se mueva. Un intento es un **árbol**: una lista de ramas, cada
   rama con su candidata y su línea en UCI (1..N plies) y, cuando el preset lo
   pide, una evaluación **al final de la línea**, no pegada a la jugada. La
   línea comprometida de hoy es el caso "una rama de 3–7 plies sin evaluación";
   el Stoyko de hoy es el caso "N ramas de 1 ply con evaluación". El formato
   nuevo los contiene a los dos sin casos especiales.

2. **Dos presets, prescriptos por separado**, porque lo que difiere no es el
   método sino la dosis y el tipo de posición:
   - **Forzado** — corto, entra en la lista de hoy cuando hay fuga de cálculo
     (RF-11.2): posición con línea forzada verificada del catálogo del Radar,
     una rama, 3–7 plies, sin evaluación pedida.
   - **Abierto** — largo, semanal (RF-11.3a): posición sin respuesta única, 2 a
     5 ramas, profundidad libre, evaluación obligatoria al final de cada rama.

3. **Dos varas, nunca un promedio.** El forzado se puntúa contra la línea
   verificada, como hoy. El abierto se puntúa con tres números que **no se
   agregan entre sí**: cobertura (si la mejor jugada del motor estuvo entre las
   candidatas), profundidad vista (plies coincidentes con la variante principal)
   y brecha de evaluación (distancia entre el símbolo declarado y el del motor,
   que entra a calibración con contexto `'stoyko'`). Queda prohibido colapsarlos
   en un "acertaste": en una posición sin respuesta única un binario mide el
   tipo de posición servida más que el cálculo del usuario, y el proyecto ya
   arrastra tres correcciones por métricas que mezclaban dos cosas (Brier como
   titular, el ACPL como proxy de Elo, el Elo inventado de los niveles).

4. **Las posiciones del preset abierto salen de las partidas propias
   analizadas** en cuanto haya una: se elige la posición donde el usuario perdió
   más centipeones o donde consumió más tiempo (`MoveAnalysisEntry.cpPerdidos`,
   `GameRecord.tiemposPorJugadaMs`), que es material de máxima relevancia
   personal y no depende de ningún pipeline. El catálogo minado (`stoykoItems`)
   queda como respaldo para cuentas nuevas y como fuente cuando no haya partidas
   analizadas recientes. Sobre una posición propia el motor evalúa en el
   dispositivo al revelar: es **una** posición, sin reloj, y el motor ya está
   cargado.

5. **La app no afirma que esto mueva el Elo.** El respaldo del ejercicio es de
   tradición de entrenadores, así lo clasifica `docs/evidence/`, y la fusión se
   justifica por coherencia y dosis, no por una mejora medida. Quien quiera
   saber si le sirve tiene el experimento n=1 (ADR-0012), que ya trata al
   cálculo como una modalidad única.

6. **Migración (esquema Dexie 18):** tabla nueva `calculoAttempts` con el
   formato de árbol, y los intentos viejos se **convierten** en la migración —un
   `CompromisoAttempt` es una rama de N plies con su primer ply divergente; un
   `StoykoAttempt`, N ramas de 1 ply con su evaluación, su confianza declarada y
   su tiempo—. La conversión no descarta ningún campo. Se hace en la migración y
   no leyendo tres formatos para siempre, porque el Panel, el resumen de cálculo
   y el experimento n=1 leen estos datos y triplicar las formas de leerlos es la
   clase de deuda que después nadie paga. Test que migra datos de la versión
   anterior, como pide la regla 3.

7. Aceptar este ADR implica **reescribir RF-7.1 y RF-7.2 como un requisito con
   dos presets** en el mismo PR que la implementación (regla 6).

## Alternativas consideradas

- **Dejar los dos ejercicios separados y solo agregarle ramas a Stoyko** — es la
  opción que no paga la migración, y por un rato alcanza. Se descarta porque
  deja dos modelos de datos y dos pantallas para el mismo acto, el n=1 sigue
  sumando dos formatos, y la próxima métrica de cálculo hay que escribirla dos
  veces.
- **Fusionar también el puntaje en un solo número** ("precisión de cálculo") —
  descartado: mezcla una posición con respuesta verificable con otra que no la
  tiene. Ese número subiría o bajaría según el tipo de posición servida y el
  usuario leería como progreso lo que es composición del contenido.
- **Un solo preset, el largo** — descartado: 30–90 minutos no se pueden
  prescribir a diario, y la fuga de cálculo detectada por E9 necesita un
  ejercicio que quepa en el presupuesto declarado del día.
- **Usar todo el catálogo del Radar también para el preset abierto** —
  descartado: ese catálogo tiene, por diseño, una única jugada correcta
  verificada. El preset abierto necesita exactamente lo contrario.
- **Cronometrar el ejercicio para forzar profundidad** — ya descartado por
  RF-7.3, y se mantiene descartado: el objetivo es profundidad, no velocidad. El
  tiempo se registra en silencio y se muestra después.
- **Borrar el preset abierto por falta de evidencia dura** — descartado: es el
  único lugar del producto donde el usuario declara una evaluación sobre una
  posición sin respuesta única, y eso es la materia prima de E10. Lo que
  corresponde no es borrarlo sino no prometer más de lo que respalda, que es lo
  que hace el punto 5.

## Consecuencias

Se gana un modelo mental en vez de dos, una pantalla, un modelo de datos, y la
calibración de Stoyko deja de estar vacía —RF-10.2 nombra el contexto desde el
principio—. El preset abierto deja de depender del minado por autojuego y pasa a
alimentarse de las partidas del usuario, que es la fuente que la propia
investigación del proyecto pone más arriba.

Se paga: una migración Dexie con test, una pantalla más compleja (declarar un
árbol es más que declarar una línea) y un resultado que son tres números en vez
de un binario, con la obligación de explicarlos en lenguaje claro y no como
jerga.

**Riesgo registrado:** la entrada de un árbol en un celular es la parte que puede
fracasar por usabilidad, no por lógica. Si el preset abierto se abandona más que
hoy, la salida es reducirlo a dos ramas obligatorias con profundidad libre en una
sola, antes que volver a las jugadas sueltas.

**Señales que obligarían a revisar esta decisión:** que la brecha de evaluación no
se mueva en ocho semanas de uso sostenido (el ejercicio no estaría enseñando
juicio y habría que discutir el ejercicio, no la pantalla), o que el preset
abierto se empiece y no se termine.

**Lo que este ADR no decide:** la interfaz concreta de entrada del árbol, y si el
preset forzado debe seguir viniendo del catálogo del Radar una vez que haya
suficiente material propio analizado.
