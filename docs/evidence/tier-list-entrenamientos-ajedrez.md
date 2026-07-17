# Tier list: ejercicios de entrenamiento de ajedrez según la evidencia

**Fuentes evaluadas:** Training Room de Aimchess (15 ejercicios), suite de juegos de Chessly (Levy Rozman, 8 juegos), más los formatos de Chess.com, Lichess, Chesstempo, Chessable, CT-ART, Listudy y Maia analizados en el informe previo.

## Criterios de ranking (y una advertencia honesta)

Ningún ejercicio de ninguna aplicación tiene ensayos controlados publicados que demuestren su eficacia. Esta tier list ordena por **plausibilidad mecanística**: cuánto se alinea cada ejercicio con lo que sí está validado. Cinco criterios:

1. **Solapamiento con el juego real.** La transferencia es función del solapamiento de elementos (Thorndike & Woodworth, 1901). Cuanto más se parece el ejercicio a decidir jugadas en una partida, más transfiere.
2. **Mecanismos de aprendizaje validados:** práctica de recuperación (g≈0,50–0,61), repetición espaciada, práctica intercalada, feedback inmediato, dificultad deseable (fallo objetivo 20–40%).
3. **Cobertura de habilidades que el formato estándar omite:** decidir *cuándo* calcular, defensa, gestión del reloj, conversión de ventajas.
4. **Personalización sobre errores propios** (feedback dirigido a tus fugas reales, no a un temario genérico).
5. **Riesgos de diseño:** premiar velocidad sobre profundidad (cálculo superficial), entrenar el instrumento de medición en lugar de la habilidad, reconocimiento pasivo (opción múltiple) en vez de producción libre.

**Fe de erratas de mi informe anterior:** presenté el "modo ¿hay táctica?" como hueco del mercado e innovación de la app ideal. Falso a medias: el 360 Trainer de Aimchess y el Anti Puzzle de Chessly ya lo implementan. El hueco existe en Chess.com y Lichess, no en el mercado entero.

---

## Tier S — El núcleo: máximo solapamiento + mecanismos correctos

**Partidas lentas + análisis propio en dos fases** (Lichess / Chess.com, contra humanos o Maia) — No figura como "juego" en ninguna suite y es el patrón oro. Jugar es el único ejercicio con solapamiento 1:1 con la habilidad objetivo; el análisis sin motor primero convierte cada partida en práctica de recuperación sobre tu propio proceso de pensamiento, y el motor después cierra el bucle de feedback. *Estimula:* integración de todo (evaluación, planificación, cálculo, gestión de reloj, control emocional). *A mejorar en todas las apps:* ninguna bloquea el motor hasta que registres tu evaluación y plan; el "análisis en dos fases forzado" sigue sin existir.

**360 Trainer (Aimchess) + Anti Puzzle (Chessly)** — Mismo concepto, los agrupo: posiciones variadas (tácticas ofensivas, defensivas, posiciones iguales y, en Aimchess, errores de tus propias partidas) donde primero hay que decidir **si existe una táctica o no**. *Estimula:* el disparador de decisión (cuándo calcular), control inhibitorio, evaluación estática. *Por qué tier S:* corrigen el defecto estructural del puzzle clásico —la metaseñal de que "hay algo"— que en partida real no existe. La versión de Aimchess suma personalización con tus errores. *A mejorar:* pedir confianza declarada antes de resolver y computar calibración (puntuación de Brier); repetición espaciada de los fallos; cuando no hay táctica, explicar *por qué* no la hay (feedback conceptual, no solo acierto/error).

**Retry Mistakes (Aimchess)** — Reintentar posiciones donde erraste habiendo pensado más de 10 segundos. El filtro es inteligente: separa errores de juicio y cálculo (entrenables con reintento reflexivo) de descuidos por velocidad. Es el diario de errores automatizado más práctica de recuperación sobre el material de máxima relevancia personal. *Estimula:* metacognición, corrección de patrones defectuosos propios. *A mejorar:* convertir cada error en tarjeta con repetición espaciada (un solo reintento desperdicia el material); pedir que categorices el error (táctico / posicional / tiempo / psicológico) para construir estadísticas de fugas — sin eso se pierde la mitad del valor del diario de errores.

---

## Tier A — Alta alineación con los mecanismos validados

**Advantage Capitalization (Aimchess) + Think Fast (Chessly)** — Jugar posiciones ganadoras hasta convertirlas (en Aimchess, extraídas de partidas que perdiste teniendo ventaja; Think Fast agrega presión de reloj). La conversión de ventajas es una fuga masiva en aficionados y una habilidad real del resultado. *Estimula:* técnica de conversión, simplificación, profilaxis; con reloj, decisión bajo presión. *Riesgo de diseño:* el motor defiende de forma inhumana (resistencia perfecta, sin las trampas prácticas que pondría un humano). *A mejorar:* usar Maia como defensor para resistencia humana-realista al rating del usuario.

**Blunder Preventer (Aimchess)** — Evaluar posiciones y elegir la jugada correcta evitando la que pierde. Los errores graves deciden la mayoría de las partidas por debajo de ~1800 Elo, así que apunta a la habilidad de mayor rentabilidad. *Estimula:* chequeo de seguridad, detección de amenazas. *Por qué no es S:* la descripción sugiere formato de reconocimiento (elegir entre opciones), y la recuperación por producción libre es más potente que el reconocimiento. *A mejorar:* obligar a marcar las amenazas del rival antes de mostrar opciones; formato de producción ("¿qué jugarías?") con verificación posterior.

**Checkmate Patterns (Aimchess) + táctica con repetición espaciada (Chesstempo) + CT-ART (Chess King)** — Construcción del vocabulario de patrones, el mecanismo central de la pericia (Chase & Simon, 1973; Gobet & Simon). Los patrones de mate están entre los chunks más rentables por frecuencia y decisividad. Chesstempo implementa espaciado explícito sobre motivos y fallos; CT-ART aporta progresión estructurada (~20.000 ejercicios con verificación completa de variantes). *Estimula:* reconocimiento de patrones, memoria a largo plazo específica del dominio. *A mejorar:* en Aimchess, asegurar que las flashcards exijan resolver (recuperación activa), no releer; en todos, intercalar motivos en lugar de bloques por tema — la práctica intercalada mejora la discriminación (d≈0,67), que es exactamente lo que la partida exige: reconocer *qué* patrón aplica sin que te lo anuncien.

**Tactics con "Force full calculation" (Aimchess)** — Cuenta regresiva de 5 segundos tras tu primer movimiento, reiniciada en cada jugada: o calculaste la secuencia completa antes de tocar, o no llegás. Ataca el vicio de "mover y ver qué pasa" que los puzzles normales permiten (resolver por partes usando el feedback del tablero). *Estimula:* disciplina de cálculo completo, visualización dentro del dominio, memoria de trabajo visoespacial. Es la implementación digital más fiel al principio del cálculo íntegro de la escuela soviética (Kotov). *A mejorar:* el diseño castiga también a quien calculó bien pero ejecuta lento con el mouse; una alternativa más limpia sería confirmar la línea completa por adelantado.

**Endgame (Aimchess) + Drills (Chess.com) + Practice (Lichess)** — Finales teóricos jugados contra el motor hasta demostrar la técnica. Aquí el motor sí es el rival correcto: en finales teóricos la defensa perfecta es exactamente lo que querés enfrentar. Conocimiento discreto, ideal para repetición espaciada, de alta rentabilidad en nivel bajo-intermedio. *Estimula:* técnica de finales, cálculo preciso, conocimiento teórico. *A mejorar:* programar reapariciones espaciadas de cada final hasta la automatización; medir tiempo hasta técnica correcta como métrica de dominio.

**Guess the Move (Chesstempo / Listudy)** — Adivinar la jugada del maestro a lo largo de partidas completas. Convierte el "estudio serio individual" —el predictor dominante del rating en Charness et al. (2005)— en práctica de recuperación activa en lugar de lectura pasiva. *Estimula:* evaluación posicional, planificación, patrones estratégicos de medio juego (justo lo que la repetición espaciada de líneas no cubre bien). *A mejorar:* sistemas de puntuación que acepten jugadas alternativas igual de buenas (los actuales penalizan jugadas tan buenas como la de la partida); feedback conceptual sobre el plan, no solo acierto/error.

**Defender (Aimchess) + Defense (Chessly) + puzzles defensivos (Chesstempo)** — Encontrar la mejor defensa en posiciones difíciles. Corrige el sesgo ofensivo de los sets tácticos: en partida real defendés la mitad del tiempo, pero casi ningún set lo refleja. *Estimula:* cálculo defensivo, búsqueda de recursos, control emocional en posiciones peores. *A mejorar:* mezclar posiciones defensivas con ofensivas sin avisar — si sabés que "toca defensa", ya te regalaron media respuesta; es el mismo problema del puzzle clásico en versión defensiva.

**Time Trainer (Aimchess)** — Practicar cuándo calcular en profundidad y cuándo jugar una jugada "suficientemente buena". Única implementación que conozco de la gestión metacognitiva del reloj como ejercicio, y las fugas de tiempo son una categoría real de derrotas. *Estimula:* metacognición, triage de decisiones, satisficing deliberado. *Advertencia:* la descripción no revela la mecánica exacta; el valor depende de que el trade-off profundidad/reloj sea genuino. *A mejorar:* retroalimentar con tus propios datos de gestión de tiempo (Aimchess ya los recolecta): "en posiciones de este tipo gastás X segundos de más".

---

## Tier B — Útiles con condiciones o en dosis controladas

**Intuition Trainer (Aimchess)** — Dada una secuencia de movimientos jugada, identificar cuál fue el error. Entrena la detección de momentos críticos y la evaluación continua — darse cuenta de que la evaluación cambió es una habilidad real de partida. Mecanismo plausible, formato novedoso, sin antecedente de evidencia. *A mejorar:* pedir también *por qué* es el error y qué era mejor (producción, no solo detección); espaciar los fallados.

**Poisoned Pawn (Chessly)** — ¿Capturar el peón es gratis o es una trampa? Evaluación riesgo-recompensa en formato binario. Es un subconjunto acotado del disparador de decisión (el pariente estrecho de 360 Trainer y Anti Puzzle), enfocado en el patrón "material ofrecido" — frecuente y real, pero más angosto que sus primos de tier S. *A mejorar:* expandir a otras decisiones de riesgo (sacrificios de calidad, capturas en b2/b7); agregar calibración de confianza.

**Opening Improver + Opening Trainer (Aimchess) + MoveTrainer (Chessable)** — El mecanismo (recuperación + espaciado sobre secuencias discretas) es de lo más sólido de todo este documento; están en tier B no por el mecanismo sino por la **rentabilidad relativa**: por debajo de ~1500 Elo el retorno marginal de estudiar aperturas es bajo frente a táctica y finales. Dos aciertos de Aimchess sobre Chessable: entrena tus errores frecuentes reales (no teoría abstracta) y el Opening Trainer te enfrenta a las respuestas *más populares en tu rango de rating* — realismo estilo Maia: preparás contra lo que efectivamente te juegan, no contra la línea principal de gran maestro que no verás nunca. *A mejorar en Chessable:* dosis recomendada por nivel; su modelo de negocio (vender cursos de aperturas) empuja a sobreinvertir exactamente donde menos rinde.

**Blindfold Tactics (Aimchess)** — Táctica sin ver las piezas. Visualización *dentro* del dominio táctico: muy superior a los ejercicios de visualización abstracta, y funciona como dificultad deseable si tu tasa de fallo queda en 20–40%. Contexto: Chabris & Hearst (2003) sugieren que la visualización es en gran medida subproducto del reconocimiento de patrones, no el cuello de botella — no esperes que sea la palanca principal. *A mejorar:* progresión gradual (piezas fantasma → solo coordenadas → nada) para mantener la dificultad en zona útil y no en frustración.

**Tactics Challenge, modos Calculation (120 s) y Pattern Recognition (30 s) (Aimchess)** — La descomposición en tres presupuestos de tiempo mapea razonablemente el debate reconocimiento-rápido versus búsqueda-lenta. El modo Calculation es el valioso para juego clásico; el de reconocimiento es táctica estándar con reloj razonable. *A mejorar:* recomendar el modo según el formato que jugás (blitz → velocidad; clásico → cálculo), y advertirlo.

---

## Tier C — Rendimiento decreciente o riesgo de sobreuso

**Puzzle Rush / Puzzle Storm / Puzzle Battle y Racer (Chess.com / Lichess) + Tactics Challenge modo Accuracy 10 s (Aimchess)** — Resolución a máxima velocidad con puntuación por racha. Divertidos y motivadores (la adherencia importa, y esto retiene usuarios), y entrenan reconocimiento instantáneo útil para blitz. El problema: si dominan tu dieta, refuerzan el cálculo superficial y el hábito de jugar la primera idea — exactamente lo contrario del control del sesgo de Einstellung. *Uso correcto:* postre, no plato principal (orientativo: ≤15% del tiempo táctico si tu objetivo es juego lento). *A mejorar:* separar el rating de estos modos del rating táctico serio para no contaminar la métrica de progreso.

**Practice Visualization (Aimchess) + Visualization Trainer (Chessly)** — Ejercicios de visualización aislada (reproducir secuencias, retos varios). La evidencia sugiere que la visualización acompaña a la pericia más que causarla; entrenarla descontextualizada tiene retorno dudoso frente a entrenarla dentro del cálculo, donde ya la trabajan con más solapamiento Force Full Calculation y Blindfold Tactics. *A mejorar:* que toda secuencia a reproducir termine en una decisión ("¿y ahora qué jugás?") para reconectarla con el juego.

**Flash Memory (Chessly)** — Ver una posición unos segundos y responder preguntas. Es el paradigma experimental de de Groot y Chase & Simon convertido en ejercicio — pero aquello era un *instrumento de medición* de la pericia, no un método para construirla. Los chunks se forman con exposición significativa (resolver, jugar, estudiar), no memorizando fotos de tableros. Riesgo clásico de entrenar para el test. *Se salva parcialmente si* las preguntas apuntan a relaciones funcionales ("¿qué pieza está colgando?", "¿quién está mejor?"), lo que roza la visión de tablero. *A mejorar:* reformular todas las preguntas hacia amenazas y relaciones entre piezas, nunca hacia ubicaciones sueltas.

**Traveling Knight (Chessly)** — Llevar el caballo por el tablero esquivando capturas. Automatiza la geometría de la pieza menos intuitiva y algo de visión de tablero. Útil para principiantes absolutos durante un par de semanas; el rendimiento marginal cae rapidísimo después. Es un microcomponente perceptivo-motor, no una habilidad de juego. *A mejorar:* retirarlo del menú una vez superado un umbral de dominio, para que no ocupe minutos de práctica con lo ya automatizado.

---

## Tier D — Marginales para la fuerza de juego

**Coordinate Spotter (Chessly) + Coordinates (Chess.com / Lichess) + Vision (Chess.com)** — Localizar casillas o movimientos rápido. Alfabetización del tablero: sirve para leer notación y comunicarte, casi nada para jugar mejor — ninguna decisión de partida requiere nombrar la casilla a velocidad. Un principiante absoluto lo usa unas semanas y listo. Que existan en cuatro aplicaciones distintas dice más de lo fácil que es programarlos que de su valor formativo.

---

## Qué no cubre ninguna suite (los huecos reales del mercado)

1. **Anti-Einstellung:** problemas de doble solución (una familiar, otra mejor) con seguimiento de si te conformás con la primera idea. El fenómeno tiene la mejor base experimental de todo el ajedrez cognitivo (Bilalić, McLeod & Gobet, con seguimiento ocular) y nadie lo entrena.
2. **Calibración del juicio:** ningún ejercicio pide confianza declarada ni computa calibración (puntuación de Brier). Es barato de implementar y convertiría cualquier ejercicio en entrenamiento metacognitivo.
3. **Análisis en dos fases forzado:** ninguna aplicación bloquea el motor hasta que registres tu evaluación y plan.
4. **Repetición espaciada transversal:** Chesstempo y Chessable la tienen en sus silos; ninguna suite la aplica a *todos* los fallos (tácticos, de apertura, de final, de decisión) en un solo sistema.
5. **Sparring humano-realista integrado al ciclo:** Maia existe, pero ninguna suite la usa como defensor en conversión de ventajas ni como rival que comete los errores típicos de tu rating.

## Cómo usar esta tier list (nota de dieta)

El orden refleja valor esperado por minuto, no una instrucción de "hacé solo tier S". Dieta razonable para mejorar en juego lento: el grueso en S y A (partidas + análisis, disparador de decisión, errores propios, patrones espaciados, finales), tier B como complemento según tus fugas detectadas, tier C como postre dosificado, tier D solo si sos principiante absoluto. La distribución concreta por nivel y el microciclo semanal están en el programa FORGE del informe anterior.

## Tabla resumen

| Ejercicio | App | Tier | Capacidad principal | Mejora clave |
|---|---|---|---|---|
| Partidas lentas + análisis en dos fases | Lichess / Chess.com / Maia | S | Integración total | Bloquear motor hasta registrar evaluación propia |
| 360 Trainer / Anti Puzzle | Aimchess / Chessly | S | Disparador de decisión | Calibración + espaciar fallos |
| Retry Mistakes | Aimchess | S | Corrección de fugas propias | Espaciado + categorización de errores |
| Advantage Capitalization / Think Fast | Aimchess / Chessly | A | Conversión de ventaja | Defensor Maia (resistencia humana) |
| Blunder Preventer | Aimchess | A | Prevención de errores graves | Producción libre + marcar amenazas |
| Checkmate Patterns / táctica espaciada / CT-ART | Aimchess / Chesstempo / Chess King | A | Vocabulario de patrones | Intercalar motivos |
| Tactics: Force Full Calculation | Aimchess | A | Disciplina de cálculo | No castigar la lentitud de ejecución |
| Endgame / Drills / Practice | Aimchess / Chess.com / Lichess | A | Técnica de finales | Reapariciones espaciadas |
| Guess the Move | Chesstempo / Listudy | A | Evaluación y planes | Aceptar alternativas igual de buenas |
| Defender / Defense | Aimchess / Chessly / Chesstempo | A | Cálculo defensivo | Mezclar con ofensivos sin avisar |
| Time Trainer | Aimchess | A | Gestión metacognitiva del reloj | Feedback con tus datos de tiempo |
| Intuition Trainer | Aimchess | B | Detección de momentos críticos | Pedir el porqué del error |
| Poisoned Pawn | Chessly | B | Evaluación riesgo-recompensa | Ampliar tipos de decisión |
| Opening Improver / Trainer / MoveTrainer | Aimchess / Chessable | B | Memoria de repertorio | Dosis según nivel |
| Blindfold Tactics | Aimchess | B | Visualización en dominio | Progresión gradual |
| Tactics Challenge (30 s / 120 s) | Aimchess | B | Reconocimiento / cálculo | Modo según formato de juego |
| Puzzle Rush / Storm / Accuracy 10 s | Chess.com / Lichess / Aimchess | C | Velocidad de reconocimiento | Dosificar; separar ratings |
| Practice Visualization / Visualization Trainer | Aimchess / Chessly | C | Visualización aislada | Terminar cada secuencia en una decisión |
| Flash Memory | Chessly | C | Memoria de posiciones | Preguntas funcionales, no de ubicación |
| Traveling Knight | Chessly | C | Geometría del caballo | Retirar tras automatizar |
| Coordinate Spotter / Coordinates / Vision | Chessly / Chess.com / Lichess | D | Alfabetización del tablero | Solo principiantes, y breve |
