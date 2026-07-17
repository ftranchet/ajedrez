# Entrenamiento de ajedrez basado en evidencia: informe científico y diseño de una aplicación y un programa

## TL;DR
- La práctica deliberada es **necesaria pero no suficiente**: en juegos/ajedrez explica el 26% de la varianza en desempeño (Macnamara, Hambrick & Oswald, 2014), dejando ~66-74% a otros factores (inteligencia fluida, memoria a corto plazo, edad de inicio, genética); el ejercicio individual serio es la actividad con mayor peso, y el reconocimiento de patrones (chunks/plantillas) es el mecanismo cognitivo central.
- La **transferencia lejana es prácticamente nula**: brain training, entrenamiento de memoria de trabajo (n-back) y "ajedrez para mejorar matemáticas" colapsan a tamaños de efecto cercanos a cero cuando hay grupo de control activo; la industria carece de respaldo (la Federal Trade Commission sancionó a Lumosity en 2016). Para el ajedrez, solo tiene sentido entrenar ajedrez y cuidar factores indirectos bien documentados (ejercicio aeróbico, sueño).
- El programa propuesto, **FORGE**, prioriza lo que sí tiene evidencia robusta en ciencia del aprendizaje (recuperación, repetición espaciada, práctica intercalada, dificultad deseable, feedback inmediato) aplicado a ajedrez, con análisis de partidas propias sin motor primero, diario de errores y calibración del juicio; se propone además un experimento n=1 para que el propio usuario lo valide.

## Hallazgos clave

**1. La práctica deliberada importa, pero está sobrevendida.** El estudio de referencia, Charness, Tuffiash, Krampe, Reingold & Vasyukova (2005, *Applied Cognitive Psychology*), con dos muestras grandes de jugadores con rating, encontró que un conjunto de actividades ajedrecísticas explicaba ~40% de la varianza en el rating, con el **estudio individual serio** como predictor dominante; los grandes maestros habían acumulado ~5.000 horas de estudio en solitario en su primera década (unas cinco veces más que los jugadores intermedios). El meta-análisis de Macnamara, Hambrick & Oswald (2014, *Psychological Science* 25:1608–1618) concluyó textualmente que "la práctica deliberada explicó el 26% de la varianza en desempeño para juegos, 21% para música, 18% para deportes, 4% para educación y menos del 1% para profesiones". El reanálisis de Hambrick et al. (2014, *Intelligence*, "Deliberate practice: Is that all it takes to become an expert?") lo dejó en ~34% para ajedrez tras corregir por fiabilidad, con ~66% sin explicar. Campitelli & Gobet (2011, *Current Directions in Psychological Science*) estimaron un **mínimo de ~3.000 horas** para nivel maestro, pero con enorme variabilidad individual: según los datos de Gobet & Campitelli (2007) recogidos allí, algunos jugadores alcanzaron el nivel maestro con tan solo **3.016 horas** mientras otros necesitaron hasta **23.608 horas**, y varios jugadores con más de 20.000 horas (algunos casos por encima de 25.000 h) **nunca lo alcanzaron**.

**2. Otros factores tienen peso causal real.** Burgoyne, Sala, Gobet, Macnamara, Campitelli & Hambrick (2016, *Intelligence* 59:72–83) meta-analizaron la relación entre capacidad cognitiva y habilidad ajedrecística: "la habilidad ajedrecística correlacionó positiva y significativamente con el razonamiento fluido (Gf) (r=0,24), el conocimiento-comprensión (Gc) (r=0,22), la memoria a corto plazo (Gsm) (r=0,25) y la velocidad de procesamiento (Gs) (r=0,24); el promedio meta-analítico de las correlaciones fue r=0,24". Correlacionó más fuerte con la habilidad numérica (r=0,35) que con la verbal (r=0,19) o la visoespacial (r=0,13). Además, la correlación con razonamiento fluido es **mayor en jóvenes (r=0,32) que en adultos (r=0,11)** y mayor en muestras no clasificadas (r=0,32) que en jugadores con rating (r=0,14), lo que sugiere que la inteligencia importa más al inicio y en el aprendizaje, y menos entre expertos ya seleccionados. La edad de inicio (periodo sensible), la memoria de trabajo y factores genéticos también contribuyen.

**3. El motor cognitivo es el reconocimiento de patrones.** Chase & Simon (1973) propusieron la teoría de *chunking*: los expertos almacenan miles de configuraciones ("chunks"). Simon & Gilmartin (1973) estimaron mediante simulación que se necesitan **al menos 50.000 chunks** para acercarse a la memoria de un maestro (estimaciones posteriores llegan a 300.000 con las plantillas). Gobet & Simon (1996, 1998) extendieron esto a la **teoría de plantillas** (templates): estructuras de recuperación grandes en memoria a largo plazo que permiten a un maestro recordar hasta nueve tableros con >70% de precisión. Evidencia crítica: los expertos recuerdan posiciones **reales** muchísimo mejor que los novatos, pero esa ventaja **casi desaparece con posiciones aleatorias**, demostrando que no es memoria general superior sino conocimiento estructurado específico del dominio.

**4. Visualización y cálculo a la ciega.** Chabris & Hearst (2003, *Cognitive Science*) analizaron con motor los errores de 23 grandes maestros en partidas clásicas, rápidas y rápidas a la ciega: el ajedrez rápido produjo sustancialmente más errores que el clásico, pero, sorprendentemente, **no hubo diferencia entre rápidas con tablero y rápidas a la ciega**, pese a la carga extra de memoria/visualización. Esto sugiere que la visualización no es el cuello de botella: es en gran medida un subproducto del reconocimiento de patrones y de la memoria de trabajo específica del dominio.

**5. La transferencia lejana es un espejismo.** Sala & Gobet (2016, *Educational Research Review* 18:46–57): a partir de 24 estudios (40 tamaños de efecto), 2.788 jóvenes en condición de ajedrez y 2.433 en controles, hallaron "un tamaño de efecto global moderado (g=0,338) [y] una tendencia a un efecto más fuerte sobre la habilidad matemática (g=0,382) que sobre la lectora (g=0,248)"; con un mínimo de 25 horas de instrucción el efecto subía a g=0,427. Pero **casi ningún estudio usó grupo de control activo**. Los propios autores, con diseño de tres grupos (activo + pasivo), no hallaron efecto sobre resolución matemática (Sala, Foley & Gobet, 2017). Sala & Gobet (2019, *Trends in Cognitive Sciences*, "Cognitive Training Does Not Enhance General Cognition") concluyeron: efecto mínimo sobre cognición general en todos los dominios revisados. Melby-Lervåg, Redick & Hulme (2016) enterraron el entrenamiento de memoria de trabajo como vía a la inteligencia fluida. La Federal Trade Commission multó a Lumosity con 2 millones de dólares en 2016 (de una sentencia de 50 millones suspendida por su situación financiera); su directora del Bureau of Consumer Protection, Jessica Rich, declaró que "Lumosity se aprovechó de los miedos de los consumidores al deterioro cognitivo asociado a la edad, sugiriendo que sus juegos podían frenar la pérdida de memoria, la demencia e incluso el Alzheimer. Pero Lumosity simplemente no tenía la ciencia para respaldar sus anuncios".

## Detalles

### (1) Ciencia del entrenamiento de ajedrez

**Práctica deliberada: la evidencia cuantitativa.** El concepto procede de Ericsson, Krampe & Tesch-Römer (1993), que definieron la práctica deliberada como actividades estructuradas, diseñadas para mejorar, con feedback y esfuerzo, distintas del juego y de la competición. En ajedrez, la mejor evidencia es correlacional (no experimental, por lo que la causalidad no es identificable):

- Charness et al. (2005): la actividad ajedrecística seria explicó ~40% de la varianza (en un modelo de ecuaciones estructurales reanalizado, la "actividad ajedrecística seria" explicaba ~38,8%). El estudio individual serio correlacionaba r≈0,54 con el rating. Tanto el entrenamiento con coach como el juego de torneo aportaban predicción independiente.
- Gobet & Campitelli (2007): la práctica individual acumulada correlacionaba r≈0,42 con el nivel, con gran variabilidad interindividual.
- Macnamara et al. (2014): 26% en juegos; reanálisis posteriores (Chang & Lane, 2018) muestran que la varianza explicada por práctica deliberada **cae según la calidad de medición**: 20% con entrevista retrospectiva, 12% con cuestionario, y solo **5% con registros (logs)** —una señal clásica de sesgo de medición retrospectiva.

*Veredicto epistemológico:* la práctica deliberada es la palanca más grande bajo control del jugador, pero (a) su peso real probablemente esté sobreestimado por autoinforme retrospectivo; (b) es necesaria pero no suficiente; (c) la respuesta a la práctica es heterogénea (moderada por inteligencia, edad de inicio y probablemente genética). Ericsson (2016, y réplica de 2020) disputa estos meta-análisis alegando que definen mal la práctica deliberada al incluir clases y estudio genérico; el debate sigue abierto, pero el peso de la evidencia favorece la postura "necesaria pero no suficiente".

**Reconocimiento de patrones y diseño del entrenamiento.** Si la pericia es fundamentalmente una enorme base de datos de patrones indexados a movimientos/planes buenos, el entrenamiento óptimo debe maximizar la **exposición estructurada y recuperada a patrones significativos** (no la memorización aislada). Esto respalda: resolución masiva de patrones tácticos recurrentes, estudio de estructuras de peones típicas, y finales teóricos elementales. La estimación de De Groot (1946) y la "regla de los 10 años" (Simon & Chase, 1973) reflejan el tiempo necesario para construir esa base.

**Visualización/cálculo.** Debate entre procesos "rápidos" (reconocimiento) y "lentos" (búsqueda/cálculo). Van Harreveld, Wagenmakers & van der Maas (2007, *Psychological Research*): bajo presión de tiempo, las diferencias de habilidad se vuelven menos predictivas del resultado, lo que indica que los jugadores fuertes dependen relativamente más de procesos rápidos; pero Connors, Burns & Campitelli (2011) defienden que la búsqueda importa más en el ajedrez moderno. Implicación práctica: la visualización se entrena mejor **dentro** de tareas ajedrecísticas (cálculo de líneas sin mover piezas, ejercicios de Stoyko) que como habilidad abstracta separada.

**El sesgo de Einstellung.** Bilalić, McLeod & Gobet (2008, *Cognitive Psychology*; 2010, *Current Directions*) demostraron con seguimiento ocular que, cuando un jugador encuentra una primera solución familiar, sus ojos **siguen fijándose en las casillas de esa idea** aunque afirme buscar alternativas, bloqueando la solución óptima. El efecto redujo la capacidad de expertos al nivel de jugadores tres desviaciones estándar por debajo. Implicación de diseño: hay que entrenar explícitamente el **control inhibitorio** y la búsqueda de segundas/terceras candidatas (problemas con dos soluciones, una familiar y otra mejor).

**Principios de ciencia del aprendizaje con evidencia robusta (transversales, no específicos de ajedrez):**
- **Práctica de recuperación (testing effect):** Rowland (2014) g≈0,50; Adesope et al. (2017) g≈0,61 frente a reestudiar. Dunlosky et al. (2013) la clasifican como una de las dos técnicas más eficaces.
- **Práctica espaciada/distribuida:** Cepeda et al. (2006), 317 experimentos; el intervalo óptimo ≈10-20% del intervalo de retención objetivo. Dunlosky et al. (2013) y Hattie & Donoghue (2021) la sitúan (junto al testing) como la técnica más eficaz de diez evaluadas.
- **Práctica intercalada / interferencia contextual:** Pan et al. (2019) d≈0,67 para discriminación; efecto robusto en aprendizaje motor y matemático (Rohrer). Empeora el rendimiento inmediato pero mejora retención y transferencia.
- **Dificultades deseables (Bjork):** zona óptima de fallo ≈20-40% de intentos.
- **Feedback inmediato** y **calibración** (distinguir desempeño de aprendizaje; Soderstrom & Bjork, 2015).

*Advertencia clave:* estos efectos están validados sobre todo en vocabulario, matemáticas y habilidades motoras, **no específicamente en ajedrez**. Su aplicación al ajedrez es una inferencia razonada de alta plausibilidad, no un hecho demostrado en el dominio.

**Aperturas, finales y asignación del tiempo.** No existe evidencia experimental sólida sobre la asignación óptima de tiempo de estudio por nivel. El consenso experto (no revisado por pares) sostiene que en niveles bajos-intermedios el retorno marginal del estudio profundo de aperturas es bajo frente a táctica y finales elementales, porque las partidas se deciden por errores tácticos gruesos, no por matices teóricos. Chessable y otros invocan repetición espaciada para memorizar aperturas: el mecanismo es sólido para conocimiento discreto (líneas), pero el maestro FIDE Nate Solon advierte que la repetición espaciada "funciona muy bien para fragmentos discretos de conocimiento fáciles de aislar, como vocabulario o variantes de apertura, y es menos eficaz para conocimiento más abstracto, como cómo jugar cierta estructura de medio juego".

### (2) Análisis crítico de aplicaciones actuales

**Nota transversal sobre evidencia:** salvo una excepción, **ninguna app tiene evidencia empírica publicada y revisada por pares de eficacia**. Lo que existe es marketing, testimonios y la ciencia (no ajedrecística) de la repetición espaciada que varias apps invocan.

- **Chess.com.** Puzzles (con repetición espaciada en algunos entrenadores), Puzzle Rush/Battle (cronometrados), Lessons, Insights (estadísticas de errores/aperturas), Game Review (clasifica cada jugada, evalúa a profundidad 20+), Drills, Vision (visión de tablero/coordenadas), bots adaptativos. *Fortalezas:* ecosistema completo, gran base de patrones, análisis rápido. *Limitaciones:* el nuevo resumen post-partida enfatiza jugadas positivas sobre errores, lo que diluye el foco de aprendizaje; gamificación (rachas, puntuaciones) puede desviar del aprendizaje profundo.
- **Lichess.org.** Gratuito y de código abierto; Puzzles con temas, Puzzle Storm/Racer (cronometrados), Studies (anotables), Opening Explorer, entrenador de coordenadas, editor de tablero, análisis con Stockfish. *Fortalezas:* herramientas de máxima calidad sin coste, transparencia. *Limitación:* no genera entrenamiento personalizado a partir de tu historial; el usuario debe diagnosticar sus propias debilidades.
- **Chessable (MoveTrainer).** Repetición espaciada con intervalos crecientes; enorme biblioteca de cursos de autores titulados. *Fortaleza:* el mejor sistema para memorizar repertorios y patrones discretos. *Crítica:* la eficacia "científica" que promociona se apoya en literatura general (Ebbinghaus, estudios de idiomas/medicina), **no en estudios de ajedrez**; y la repetición espaciada transfiere mal al conocimiento conceptual/medio juego.
- **Aimchess.** Importa tus partidas y analiza seis dimensiones (aperturas, capitalización de ventaja, gestión del tiempo, resiliencia, finales, prevención de errores); genera puzzles de tus propios errores. *Excepción de evidencia:* su web cita "un experimento de campo aleatorizado de 12 semanas de investigadores de la University of British Columbia" que compara lecciones personalizadas vs. genéricas —pero **no se localiza versión publicada revisada por pares**; es una cita del proveedor, no verificable. El concepto de "entrenar sobre tus propios errores" es su fortaleza conceptual genuina.
- **Chesstempo.** Sistema adaptativo de rating de táctica (100k-350k+ problemas, incluidos defensivos), repetición espaciada para motivos y errores, entrenador de aperturas y de finales (respaldado por tablebases de 3-7 piezas). Crítica en reseñas: algunos puzzles son "tácticas de ordenador" no detectables por humanos al rating indicado.
- **Chess King / CT-ART.** ~20.000 ejercicios (200-2400) basados en los *Combination Motifs* de Maxim Blokh; verificación completa de variantes. Reputación fuerte, sin estudios controlados.
- **Maia Chess.** Red neuronal (McIlroy-Young, Sen, Kleinberg & Anderson, KDD 2020; Maia-2, NeurIPS 2024) entrenada por aprendizaje supervisado sobre millones de partidas humanas de Lichess para **predecir el movimiento humano** a un nivel de rating dado (600-2600), no el mejor movimiento. Predice errores humanos plausibles mejor que Stockfish limitado en profundidad. *Potencial pedagógico alto:* permite un sparring realista y detectar los errores que un humano de tu nivel realmente cometería —clave para entrenar el reconocimiento de posiciones peligrosas.
- **Otras:** Dr. Wolf (coach conversacional para principiantes, con repetición espaciada), DecodeChess (explicaciones en lenguaje natural sobre Stockfish; crítica: las explicaciones "no se acumulan"), Noctie AI (oponente humano-realista que convierte tus errores en mazos de repetición espaciada), ChessMood (cursos de gran maestro), Chessity (orientada a escuelas). Todas: sin evidencia empírica de eficacia.

**El problema pedagógico central de los puzzles.** El propio formato de puzzle **te informa de que existe una combinación ganadora**. En una partida real nadie te avisa. La habilidad difícil —reconocer *cuándo* buscar una táctica— no se entrena resolviendo puzzles convencionales. El consenso de entrenadores (no revisado por pares) lo articula así: hay que entrenar la **visión de tablero** (el maestro nacional Dan Heisman: "no puedes jugar lo que no ves"; correlación alta reportada por Jon Levitt en *Genius in Chess* entre rapidez/precisión en tareas de visión de tablero y fuerza), el **chequeo de seguridad/blunder-check** ("escribe tu jugada y mira de nuevo buscando errores obvios"; concepto de "Hope Chess" de Heisman) y la **disciplina de cálculo**. Formatos cronometrados como Puzzle Rush/Storm entrenan intuición y velocidad (útil para blitz) pero, según crítica de entrenadores y algún autoexperimento informal, pueden **reforzar cálculo superficial** y perjudicar el juego clásico. La solución de diseño: incluir puzzles "mixtos" donde a veces **no hay táctica** y la respuesta correcta es una jugada posicional segura, entrenando el disparador de decisión.

### (3) Juegos y actividades alternativas: veredicto de evidencia

**(a) Con evidencia razonable de transferencia CERCANA al ajedrez:** prácticamente solo el propio ajedrez y sus componentes (táctica, finales, estudio de estructuras). La transferencia es una función del solapamiento de elementos (Thorndike & Woodworth, 1901); cuanto más se parezca la tarea al ajedrez, más transfiere.

**(b) Evidencia débil o nula, pero promocionadas como útiles:**
- **Brain training (Lumosity, CogniFit):** sin respaldo; sanción de la Federal Trade Commission a Lumosity (2 millones USD, 2016).
- **Entrenamiento de memoria de trabajo / n-back dual:** Jaeggi et al. (2008) reportaron ganancias en inteligencia fluida, pero Redick et al. (2013), Chooi & Thompson (2012) y el meta-análisis de Melby-Lervåg, Redick & Hulme (2016) no replicaron la transferencia lejana; con controles activos el efecto se desvanece (g≈0,13 y no significativo tras excluir estudios sin control activo). Transferencia solo cercana (a otras tareas n-back).
- **Videojuegos de acción:** Green & Bavelier (2003) y el meta-análisis de Bediou et al. (2018) reportan efectos sobre atención/percepción, pero Boot, Blakely & Simons (2011) y Boot et al. (2013) muestran defectos metodológicos graves (selección de jugadores habituales, ausencia de doble ciego, efectos placebo/expectativa por controles no equivalentes). Sala, Tatlidil & Gobet (2018): el entrenamiento con videojuegos no mejora la capacidad cognitiva general.
- **Go, shogi, damas, póker, bridge:** ninguna evidencia de transferencia hacia el ajedrez; comparten el reconocimiento de patrones específico de dominio, que no transfiere.
- **Tetris/rotación mental, música, matemáticas:** sin evidencia de transferencia causal al ajedrez (la correlación música-inteligencia se explica mejor por pleiotropía genética, Mosing et al. 2016).

**(c) Vías indirectas bien documentadas (no mejoran el ajedrez directamente, pero optimizan el sustrato del rendimiento y del aprendizaje):**
- **Ejercicio aeróbico:** meta-análisis muestran efecto sobre función cognitiva y memoria episódica (Hedges g≈0,28 en memoria episódica en adultos mayores sin demencia; efectos mayores en deterioro cognitivo leve). La evidencia más fuerte es en poblaciones mayores/clínicas; en jóvenes sanos el efecto es menor pero plausible vía sueño y función ejecutiva.
- **Sueño:** consolidación de memoria bien establecida; el sueño tras el aprendizaje mejora la retención (mecanismo directo relevante para consolidar patrones aprendidos).
- **Manejo del estrés y control atencional; nutrición:** plausibles por vías generales, evidencia heterogénea.

### (4) Síntesis: ejercicios más eficaces (con nivel de confianza)

| Ejercicio | Justificación | Confianza |
|---|---|---|
| Resolución de táctica con recuperación espaciada de motivos recurrentes | Reconocimiento de patrones (Chase-Simon, Gobet) + repetición espaciada/testing (robusto en aprendizaje) | Alta (mecanismo) / Media (específico ajedrez) |
| Puzzles mixtos "¿hay o no hay táctica?" y chequeo de seguridad | Entrena el disparador de cálculo y el blunder-check que los puzzles clásicos omiten | Media (consenso experto, no empírico) |
| Ejercicio de Stoyko / cálculo profundo sin mover, luego verificar | Calibración del juicio + visualización dentro del dominio | Media (tradición de entrenadores) |
| Problemas de doble solución (familiar vs. óptima) | Combate el sesgo de Einstellung (Bilalić et al.) | Media-alta (base experimental del fenómeno) |
| Finales elementales con repetición espaciada | Conocimiento discreto ideal para repetición espaciada | Alta (mecanismo) |
| Repertorio de aperturas con MoveTrainer/repetición espaciada, dosificado | Repetición espaciada óptima para secuencias discretas | Alta para retención / Baja para su rentabilidad relativa en niveles bajos |
| Análisis de partidas propias sin motor primero, luego con motor | Preserva y examina tu pensamiento real; feedback | Media (consenso experto fuerte) |
| Diario de errores categorizado | Cierra el bucle de feedback dirigido | Baja-media (opinión experta) |
| Partidas lentas contra Maia (oponente humano-realista) | Práctica variable con errores humanos plausibles | Media (fundamento técnico sólido, sin estudio de eficacia) |
| Ejercicio aeróbico + higiene de sueño | Vía indirecta documentada | Media (fuera de ajedrez) |

### (5) Programa de entrenamiento: **FORGE**

**Nombre:** **FORGE** (del inglés "forjar"; evoca construir pericia a martillazos deliberados). Alternativas: **Zugzwang Protocol**, **Método Chunk**, **Kairós** (reconocer el momento de actuar), **Prisma**.

**Filosofía:** construir la base de patrones (chunks), entrenar el disparador de cálculo y el control inhibitorio, y cerrar el bucle con análisis propio y calibración —todo bajo repetición espaciada, intercalado y con dificultad deseable (fallo objetivo 20-40%).

**Microciclo semanal (intermedio, ~5 h/semana; escalable):**
- **Lun (45 min):** Táctica espaciada intercalada por motivos + 10 min puzzles mixtos "¿hay táctica?". *Estimula:* reconocimiento de patrones, control inhibitorio, disparador de decisión.
- **Mar (45 min):** Una partida lenta (15+10 o 30 min) contra humano o Maia + análisis inmediato sin motor (10 min). *Estimula:* integración, planificación, gestión de reloj, control emocional.
- **Mié (40 min):** Finales elementales espaciados + repertorio de aperturas dosificado (MoveTrainer). *Estimula:* memoria discreta, evaluación posicional.
- **Jue (45 min):** Ejercicio de Stoyko/cálculo profundo (1 posición, 30-45 min) + registro de evaluaciones para calibración. *Estimula:* cálculo/búsqueda en árbol, visualización, metacognición.
- **Vie (30 min):** Análisis con motor de la partida del martes + actualización del diario de errores (categorías: táctico, posicional, tiempo, psicológico). *Estimula:* feedback, metacognición.
- **Sáb (60-90 min):** 1-2 partidas clásicas + análisis sin motor. *Estimula:* transferencia al juego real.
- **Dom:** descanso activo (ejercicio aeróbico 30-50 min); higiene de sueño toda la semana.

**Detalle de ejecución de los ejercicios clave:**
- *Ejercicio de Stoyko:* colocar una posición rica, sin reloj; escribir en papel **cada línea que consideres** con su evaluación (por mala que parezca); dedicar 30-90 min; después comparar con el motor y con un jugador más fuerte. Estimula cálculo, visualización y, sobre todo, **calibración del juicio**.
- *Puzzles mixtos:* la mitad de las posiciones no contienen combinación ganadora; la respuesta correcta es una jugada sólida. Entrena el **disparador de decisión** (cuándo calcular) y el control inhibitorio.
- *Problemas de doble solución:* posiciones con una solución familiar (p. ej., mate ahogado largo) y otra óptima más corta; se puntúa encontrar la óptima. Combate el **sesgo de Einstellung**.

**Variantes por nivel:**
- **Principiante (~800-1200 Elo):** 70% táctica básica + mates elementales + reglas de finales rey-peón; aperturas solo principios (no memorización). Partidas 15+10.
- **Intermedio (~1200-1800):** equilibrio táctica/finales/análisis propio; introducir Stoyko y diario de errores; repertorio mínimo.
- **Avanzado (1800+):** cálculo profundo, estructuras de medio juego, repertorio serio con MoveTrainer, análisis exhaustivo; combatir Einstellung con problemas de doble solución.

**Progresión y criterios de avance:** subir dificultad cuando la tasa de acierto en un bloque supere ~80% (bajar si cae por debajo de ~60%); avanzar de nivel tras estabilidad de rating de rendimiento durante 4-6 semanas.

**Protocolo de medición (evitando medir con el mismo instrumento con el que se entrena):**
- Métrica primaria: **rating en partidas clásicas/rápidas** (no el rating de puzzles, que es el instrumento de entrenamiento).
- Métrica de proceso: **tasa de errores graves por partida** (del análisis con motor), no la puntuación de Puzzle Rush.
- Test de transferencia: batería fija de posiciones **no entrenadas** cada 6-8 semanas.
- Detección de mesetas: si el rating de partida no mejora en 8-10 semanas pese a subir el rating de puzzles, hay sobreajuste al instrumento de entrenamiento → cambiar de modalidad (más partidas lentas y análisis).

**Análisis propio, diario y calibración:** analizar siempre **sin motor primero** (Nate Solon: "una vez que has visto las líneas del motor no puedes 'no verlas'"), escribir el pensamiento, luego verificar con motor; matizar que para jugadores débiles el análisis autónomo tiene valor limitado, por lo que conviene apoyarse en un jugador más fuerte o coach. Diario de errores por categorías, revisado semanalmente, entrenando **una fuga a la vez** durante 7 días. Calibración mediante Stoyko (predecir evaluaciones y comparar con motor).

### (6) Especificaciones de la app ideal

**Arquitectura pedagógica:**
1. **Motor de patrones espaciado e intercalado:** puzzles etiquetados por motivo, servidos con repetición espaciada (intervalos crecientes, reinicio al fallar) e intercalados entre temas; dificultad ajustada a fallo del 20-40%.
2. **Modo "¿hay táctica?":** mezcla posiciones con y sin combinación ganadora; entrena el disparador de decisión y penaliza el "cálculo por defecto".
3. **Chequeo de seguridad forzado:** antes de confirmar la jugada, la app pide marcar amenazas del rival (blunder-check explícito).
4. **Anti-Einstellung:** problemas de doble solución; la app registra si aceptas la primera idea o buscas mejor.
5. **Sparring humano-realista con Maia** calibrado a tu nivel, para practicar reconocer posiciones donde un humano de tu fuerza erra.
6. **Análisis en dos fases:** la app **bloquea el motor** hasta que registras tu evaluación y plan; solo entonces revela Stockfish (y una capa de explicación tipo Maia/lenguaje natural sobre *por qué* un humano erraría).
7. **Diario de errores automático + calibración:** convierte tus errores en un mazo de repetición espaciada propio; rastrea tu calibración (predicción vs. realidad).

**Cómo adapta la dificultad el motor:** combina un rating de puzzle adaptativo (para mantener el fallo en 20-40%) con un modelo humano (Maia) que selecciona posiciones donde jugadores de tu rating cometen errores frecuentes, priorizando así los patrones donde tu perfil real falla, no dificultad abstracta.

**Qué métricas rastrea:** rating de partida (primaria), errores graves/partida, calibración (puntuación de Brier del juicio), tasa de acierto por motivo, tiempo por jugada, y una batería de transferencia no entrenada.

**Cómo evita los errores de las apps actuales:** separa el instrumento de entrenamiento del de medición; no premia la velocidad por encima de la profundidad en modo clásico; fuerza análisis sin motor primero; entrena el *cuándo* calcular, no solo el *qué*; y es honesta sobre el nivel de evidencia de cada módulo.

## Recomendaciones

1. **Empezar ya, en fase 1 (semanas 1-4):** instaurar el microciclo FORGE con Lichess (gratis, código abierto) para táctica/estudios y una partida lenta + análisis sin motor por semana. Umbral de cambio: si tras 4 semanas no sostienes el hábito, reducir a 3 sesiones/semana antes que abandonar.
2. **Fase 2 (semanas 5-12):** añadir diario de errores categorizado, ejercicio de Stoyko semanal y sparring con Maia. Añadir Chessable solo para un repertorio mínimo si tu nivel supera ~1500.
3. **Priorización por nivel:** por debajo de ~1500, invertir el 60-70% en táctica, chequeo de seguridad y finales elementales; minimizar aperturas. Por encima, subir cálculo profundo y estructuras.
4. **Medir bien:** seguir el rating de partidas clásicas y los errores graves/partida, NO el rating de puzzles. Reevaluar con batería de transferencia cada 6-8 semanas.
5. **Factores indirectos:** 30-50 min de ejercicio aeróbico varios días/semana y sueño regular; estudiar preferentemente antes de dormir para aprovechar la consolidación.
6. **Umbrales que cambian el plan:** meseta de rating >8-10 semanas con rating de puzzles subiendo → sobreajuste, más partidas lentas y análisis. Tasa de acierto <60% en un bloque → bajar dificultad. Errores por presión de tiempo dominantes en el diario → entrenar gestión de reloj.

## Qué NO sabemos (incertidumbres abiertas)
- No hay evidencia experimental de la **asignación óptima** de tiempo entre táctica/finales/aperturas por nivel; es consenso experto.
- Casi **ningún principio de ciencia del aprendizaje está validado específicamente en ajedrez** con ensayos controlados; se infiere de otros dominios.
- No hay estudios revisados por pares de eficacia de las apps; la única cita (Aimchess/University of British Columbia) no está publicada ni verificada.
- El peso causal real de la práctica deliberada vs. talento sigue en disputa (Ericsson vs. Macnamara/Hambrick).
- Se desconoce si entrenar el "disparador de táctica" con puzzles mixtos transfiere realmente a partidas.

## Diseño de experimento n=1 (autotest del propio usuario)
- **Línea base (2-3 semanas):** registrar rating de partidas clásicas, errores graves/partida (análisis con motor de ≥15 partidas) y calibración (Stoyko en 5 posiciones fijas).
- **Intervención (mínimo 12-16 semanas):** aplicar FORGE con dosis constante y registrada (horas por modalidad).
- **Métricas:** primaria = rating de partida; secundarias = errores graves/partida, calibración (Brier), batería de transferencia no entrenada.
- **Confounds a controlar:** sueño, estrés laboral, cambios en tiempo de juego, efecto de familiaridad con el instrumento (usar posiciones nuevas), regresión a la media, efecto placebo/expectativa (no autoengañarse: preinscribir el criterio de éxito).
- **Diseño reforzado:** alternar bloques (p. ej., 4 semanas con énfasis táctico vs. 4 con énfasis en análisis/cálculo) en diseño ABAB para atribuir cambios; duración mínima 3 meses por la alta varianza del rating a corto plazo.
- **Interpretación honesta:** un n=1 no establece causalidad general; solo indica si el programa funciona **para ti**, que es exactamente la pregunta relevante.