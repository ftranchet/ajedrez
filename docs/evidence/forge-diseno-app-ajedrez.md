# FORGE — Diseño de la app: de la evidencia al producto

Documento de diseño que traduce el informe científico y la tier list en decisiones de producto concretas. Función objetivo declarada: **máximo Elo ganado por minuto invertido**, con adherencia suficiente para que ese minuto exista.

---

## 1. El insight de producto: prescripción, no buffet

Las apps actuales —incluso las buenas, como Aimchess— son **buffets**: 15 ejercicios en un menú y el usuario elige. El problema está documentado en la ciencia del aprendizaje: las dificultades deseables (Bjork) se *sienten* mal, y el desempeño inmediato engaña sobre el aprendizaje real (Soderstrom & Bjork, 2015). Puesto frente a un buffet, el usuario elige sistemáticamente el postre: Puzzle Rush en vez de análisis de sus derrotas, táctica cómoda en vez de defensa incómoda. El buffet optimiza diversión; la evidencia exige lo contrario.

La app ideal, por lo tanto, no es una colección de minijuegos: es un **entrenador que prescribe**. Abrís la app y hay una sola cosa: *"Tu sesión de hoy — 25 minutos"*. La decisión de qué entrenar —que es exactamente donde el usuario autodidacta falla— está delegada en el sistema, que la toma con las reglas de rentabilidad por nivel y las fugas detectadas. El usuario puede ver el porqué de cada prescripción (transparencia total), pero no navega un menú.

## 2. Principios de diseño (derivados de la evidencia)

1. **La partida es el núcleo, no un módulo.** El único ejercicio con solapamiento 1:1 con la habilidad objetivo es jugar partidas lentas y analizarlas. Todo lo demás orbita alrededor de ese ciclo.
2. **Nunca avisar que hay táctica.** El formato por defecto es la posición sin etiqueta (el defecto estructural del puzzle clásico se elimina de raíz, no se parchea con un módulo aparte).
3. **Todo fallo entra a un único sistema espaciado.** Errores de partida, de táctica, de final, de apertura, de decisión: una sola Cola Universal con repetición espaciada. Ninguna app lo hace de forma transversal.
4. **El motor se gana, no se regala.** Análisis en dos fases forzado: primero tu evaluación, después Stockfish.
5. **Dificultad en zona de fallo 20–40%,** adaptada por módulo y por usuario.
6. **Medir con un instrumento distinto al de entrenamiento.** La métrica de verdad es el rating de partidas y los errores graves por partida — nunca el rating de puzzles.

## 3. Arquitectura: el Ciclo y la Cola Universal

**El Ciclo** es la columna vertebral de la app:

*Jugar (partida lenta) → Analizar en dos fases → Extraer y clasificar errores → Entrenar sobre ellos (más el currículo base) → Volver a jugar.*

**La Cola Universal de errores** es el motor pedagógico. Cada fallo —venga de una partida real, del Radar, de un final o de una línea de apertura— se convierte en una tarjeta con: la posición, tu respuesta errónea, la correcta, tu categorización del error (táctico / posicional / tiempo / psicológico, elegida por vos en 5 segundos) y un intervalo de reaparición espaciado (que se reinicia al fallar y crece al acertar). Al inicio de cada sesión, los repasos vencidos tienen prioridad fija: así funciona el espaciado, y así el material de máxima relevancia personal (tus errores reales) nunca se pierde tras un único reintento — la mejora exacta que le falta a Retry Mistakes de Aimchess.

## 4. Los módulos (qué entra de la tier list y cómo se mejora)

### 4.1 El Radar — el formato táctico por defecto (unifica cinco ejercicios de la tier list)

Decisión de diseño central: **360 Trainer, Anti Puzzle, Poisoned Pawn, Defender/Defense y Blunder Preventer no son cinco módulos: son un solo formato.** En la partida real nadie te dice si toca atacar, defender, capturar o jugar tranquilo — separarlos en módulos regala media respuesta (si entrás a "Defensa", ya sabés que toca defender). El Radar mezcla, en proporciones no predecibles: táctica ofensiva, defensa obligada, posiciones tranquilas donde la respuesta correcta es una jugada posicional sólida, ofertas de material envenenadas y genuinas, y tus errores reciclados de la Cola.

Flujo por posición: (1) evaluás quién está mejor; (2) decidís tu jugada — producción libre, nunca opción múltiple (la recuperación por producción supera al reconocimiento); (3) en ~1 de cada 4 posiciones, muestreo aleatorio, declarás confianza (0–100) antes de ver el resultado; (4) feedback que explica el porqué también cuando *no había nada* ("la captura era sana porque…"). Los fallos van a la Cola.

*Capacidades:* disparador de decisión, control inhibitorio, evaluación estática, cálculo defensivo, riesgo-recompensa. *Origen:* tier S + integración de tres tier A/B.

### 4.2 Análisis en dos fases (hueco #3, implementado)

Al terminar una partida (jugada dentro de la app o importada de Lichess/Chess.com), el motor está **bloqueado**. La app te guía una primera pasada liviana —tres preguntas, cinco minutos: ¿dónde estuvo el momento crítico?, ¿cuál era tu plan ahí?, ¿tu evaluación en tres posiciones que la app selecciona?— y recién entonces revela el análisis de Stockfish, comparando tus evaluaciones con las del motor (esto alimenta tu puntuación de calibración). Los errores detectados pasan a la Cola con tu categorización.

La fricción es el riesgo real de este módulo: un análisis exigente mata la retención. Por eso la fase uno es deliberadamente corta y estructurada — es el mínimo que preserva la práctica de recuperación sobre tu propio pensamiento, que es donde está el valor.

### 4.3 Patrones y finales — el currículo base espaciado e intercalado

Mates típicos, motivos tácticos y finales teóricos elementales, con recuperación activa (siempre resolver, nunca releer), repetición espaciada y **motivos intercalados** — nunca bloques de "hoy: clavadas", porque la práctica intercalada (d≈0,67 en discriminación) entrena justo lo que la partida exige: reconocer *qué* patrón aplica sin anuncio previo. Los finales se juegan contra Stockfish (aquí la defensa perfecta es deseable) y reaparecen espaciados hasta automatización. *Origen:* tier A (Checkmate Patterns, Chesstempo, CT-ART, Drills/Practice).

### 4.4 Cálculo comprometido

La versión corregida del "Force full calculation" de Aimchess: en lugar del contador de 5 segundos (que castiga la lentitud de mouse tanto como el cálculo incompleto), **ingresás tu línea principal completa por adelantado** —tu jugada, la respuesta esperada del rival, tu continuación— y recién entonces el tablero se mueve. Entrena disciplina de cálculo íntegro y visualización dentro del dominio (el principio de Kotov, sin el ruido del cronómetro). Una vez por semana, la versión larga: el ejercicio de Stoyko sobre una posición rica, con registro de evaluaciones para calibración. *Origen:* tier A.

### 4.5 Conversión contra Maia (hueco #5, primera mitad)

Advantage Capitalization corregido: tus posiciones ganadoras desperdiciadas, pero defendidas por **Maia calibrada a tu rating** en lugar de Stockfish — resistencia humana-realista, con las trampas prácticas que un humano de tu nivel realmente pondría, no la defensa inhumana perfecta del motor. Variante con reloj corto para entrenar conversión bajo presión (el Think Fast de Chessly, integrado como modificador). *Origen:* tier A + hueco de mercado.

### 4.6 Triage de reloj

El Time Trainer con la mejora que propuse: alimentado por **tus datos reales** de gestión de tiempo (la app los tiene de tus partidas importadas). Te presenta posiciones del tipo donde tu perfil gasta de más o de menos, y el ejercicio es decidir en segundos: ¿esto merece cálculo profundo o una jugada suficientemente buena? Feedback contra la evaluación: si la jugada rápida perdía poco, ganaste tiempo; si perdía mucho, aprendiste dónde frenar. *Origen:* tier A, único en el mercado.

### 4.7 Adiviná la jugada, corregido

Partidas de maestros comentadas jugada a jugada en modo predicción, con la corrección clave: **Stockfish puntúa tu jugada, no la coincidencia** — cualquier movimiento dentro de un margen de centipeones de la jugada de la partida se acepta como bueno. Convierte el estudio serio individual (el predictor dominante de Charness et al., 2005) en recuperación activa sin el defecto de penalizar alternativas correctas. *Origen:* tier A (Chesstempo/Listudy).

### 4.8 Aperturas, dosificadas y con candado

Solo dos fuentes: tus errores de apertura frecuentes (estilo Opening Improver) y práctica contra las respuestas más populares **en tu rango de rating** (el acierto genuino del Opening Trainer de Aimchess). Con candado de rentabilidad: por debajo de ~1500, el módulo está minimizado y la app te lo dice sin vueltas: "a tu nivel, cada minuto acá rinde menos que en el Radar". Sin cursos que vender, sin incentivo a inflarlo — el conflicto de interés de Chessable, resuelto por diseño. *Origen:* tier B.

### 4.9 Modificador a ciegas

El blindfold no es un módulo: es un **modificador de dificultad progresivo** (piezas fantasma → solo coordenadas → nada) que la app aplica sobre táctica ya dominada cuando tu tasa de acierto supera el 80% — una dificultad deseable para mantenerte en zona 20–40% de fallo, no un fin en sí mismo. *Origen:* tier B, con la advertencia de Chabris & Hearst incorporada.

## 5. Los huecos restantes, implementados

**Anti-Einstellung (hueco #1).** Dos mecanismos: (a) un subtipo del Radar con **problemas de doble solución** — una línea familiar que funciona y una mejor menos obvia; se puntúa encontrar la segunda, y la app rastrea tu tasa de "conformismo con la primera idea"; (b) la regla de candidatas: en posiciones críticas del Radar, tras tu respuesta, la app a veces pregunta "¿hay algo mejor?" *antes* de revelar — institucionaliza el hábito que el efecto Einstellung bloquea (Bilalić, McLeod & Gobet). Nadie en el mercado entrena el fenómeno con mejor base experimental del ajedrez cognitivo; esta app sí.

**Calibración del juicio (hueco #2).** Confianza declarada **muestreada** (~1 de cada 4-5 respuestas, para no arruinar el flujo con un slider en cada jugada), puntuación de Brier acumulada, y un panel que te muestra dónde estás sobreconfiado (¿en posiciones tácticas? ¿evaluando finales?) y dónde infraconfiado. Baratísimo de implementar, transversal a todos los módulos, y convierte la app entera en entrenamiento metacognitivo.

**Espaciado transversal (hueco #4).** La Cola Universal de la sección 3.

**Maia integrada al ciclo (hueco #5, segunda mitad).** Además de defensora en conversión: sparring principal para las partidas lentas dentro de la app (rival que comete errores humanos plausibles de tu nivel, no un Stockfish capado que juega perfecto y de golpe regala una pieza), y **selectora de posiciones**: las posiciones donde Maia-de-tu-rating se equivoca son, por construcción, las posiciones de máximo valor de entrenamiento para vos — el criterio de selección de contenido más inteligente disponible, y ninguna app lo usa.

## 6. El Prescriptor

**Diagnóstico inicial (30–40 minutos):** importación de tu historial vía las interfaces públicas de Lichess/Chess.com y análisis en lote de tus últimas ~100 partidas → perfil de fugas (errores graves por fase, gestión de reloj, conversión, aperturas problemáticas) + banda de Elo. Sin historial: dos partidas cortas contra Maia escalonada + una batería del Radar.

**La sesión diaria:** el Prescriptor arma cada sesión con reglas simples y visibles, no con una caja negra: (1) primero, los repasos vencidos de la Cola; (2) después, la dieta base por banda de Elo (del programa FORGE: por debajo de ~1500, 60–70% en Radar + finales + seguridad; por encima, más cálculo comprometido y estructuras); (3) ajustada por tus fugas del último mes (si el 40% de tus derrotas son por reloj, sube el triage). Cada bloque muestra el porqué: "Radar 12 min — tu tasa de errores graves en posiciones tranquilas duplica tu promedio". La transparencia no es cosmética: educa el criterio del usuario, que es lo que un buen entrenador hace.

**Sesión mínima viable:** 15 minutos (Cola + Radar) para los días malos. La consistencia le gana al volumen.

## 7. Medición y honestidad epistémica

**Panel de verdad vs. panel de actividad.** Grandes y al frente: rating de partidas lentas (la métrica primaria), errores graves por partida (media móvil), calibración (Brier). Chicas y atrás: rachas, minutos, volumen. Las apps actuales invierten esta jerarquía porque las métricas de actividad retienen mejor; acá el diseño se alinea con el objetivo declarado.

**Batería de transferencia:** un set fijo de posiciones nunca entrenadas, cada 6–8 semanas — el examen con instrumento independiente.

**Detector de sobreajuste:** si tu rating táctico interno sube 8–10 semanas sin que el rating de partida acompañe, alerta explícita y rebalanceo automático hacia partidas + análisis. Es la regla del informe FORGE, automatizada.

**El experimento n=1, instrumentado.** La app registra línea base, dosis por modalidad y todas las métricas — o sea, ejecuta sola el diseño de autoexperimento del informe original. Diferenciador honesto de posicionamiento: *la primera app de ajedrez que mide si funciona para vos*, con las advertencias de un n=1 escritas en la pantalla, no en la letra chica. Y a escala: con consentimiento, cohortes agregadas permitirían lo que ninguna app tiene — evidencia propia de eficacia.

## 8. Adherencia sin corromper el aprendizaje

La adherencia es el multiplicador de todo lo anterior: la app perfecta que abandonás al día 12 rinde cero. Pero la gamificación estándar optimiza engagement *contra* el aprendizaje (velocidad, rachas de resultado, confeti por lo fácil). Reglas acá: rachas de **proceso** (sesiones completadas), nunca de resultado; celebración atada a las métricas de verdad ("tus errores graves por partida bajaron 30% este mes" vale confeti; 50 puzzles seguidos, no); cero presión de velocidad fuera del triage de reloj; y sin Puzzle Rush en la versión 1 — si la demanda lo exige después, entra etiquetado como recreo, con rating separado que no contamina ninguna métrica.

## 9. Viabilidad técnica (nota para vibe coding)

Todo el contenido crítico existe abierto: la **base de puzzles de Lichess** (millones de posiciones etiquetadas por tema, licencia CC0, descargable) alimenta el Radar y el currículo; **Stockfish compilado a WebAssembly** corre en el navegador (análisis client-side, sin costo de servidor); los **pesos de Maia son públicos** (niveles ~1100–1900) y, atajo pragmático para la primera versión, los bots maia1/maia5/maia9 corren en Lichess y se los puede desafiar automáticamente vía su interfaz de programación; las **tablebases de finales** de Lichess también son consultables. Una aplicación web progresiva puede montar el MVP casi sin backend.

**Hoja de ruta:** v0.1 — Radar con calibración + Cola Universal + importador de partidas con análisis en dos fases guiado (jugás en Lichess; la app orquesta todo lo demás). Ya es diferencial y construible en semanas con tu flujo de Claude Code. v0.2 — currículo espaciado de patrones y finales + perfil de fugas + Prescriptor. v1.0 — Maia integrada (sparring, defensa, selección de posiciones), triage de reloj, batería de transferencia.

## 10. Qué queda afuera, deliberadamente

Visualización aislada, Flash Memory, recorridos de caballo y entrenadores de coordenadas (tiers C–D): retorno marginal bajo o entrenamiento del instrumento de medición. Opción múltiple en cualquier módulo: la producción libre es superior y siempre es implementable. Puzzle Rush en v1: ver sección 8. Explicaciones automáticas en lenguaje natural del motor: el problema documentado de DecodeChess ("las explicaciones no se acumulan") sugiere que es costoso y de valor dudoso; preferible feedback estructurado corto + el porqué en posiciones sin táctica.

## 11. Límites honestos

Primero: **cada mecanismo tiene base; el conjunto, no.** Ningún ensayo controlado validó esta combinación — por eso la app se mide a sí misma (sección 7). Segundo: **el techo de una app existe.** La evidencia de Charness et al. incluye torneos y entrenadores entre los predictores; la presión de un torneo presencial no se replica en pantalla, y un coach humano diagnostica conceptos que un motor no explica. Esta app optimiza el componente entrenable en solitario —que es la mayor parte—, no lo reemplaza todo. Tercero: **el mercado objetivo es chico.** El diseño prescriptivo y honesto selecciona mejoradores serios y repele al usuario casual que quiere confeti; Aimchess, el intento más cercano, tiene tracción modesta. Como producto comercial es un nicho; como la mejor app para subir Elo por minuto invertido —que fue la pregunta— es exactamente este diseño.
