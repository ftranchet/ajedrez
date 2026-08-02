# PRD — ELOmax: entrenador de ajedrez basado en evidencia

| Campo | Valor |
|---|---|
| Documento | Documento de Requisitos de Producto (PRD) |
| Versión | 0.3.1 |
| Estado | Borrador para validación del dueño de producto |
| Dueño | Fran Tranchet |
| Última actualización | 2026-07-25 |
| Documentos hermanos | `CONTRIBUTING.md`, `roadmap.md`, `design-system.md`, `adr/`, `evidence/` |

> **Cómo usar este documento.** Es la fuente de verdad de producto. Cada épica tiene requisitos numerados (RF = requisito funcional, RNF = no funcional) con criterios de aceptación. Al construirlo —sea una persona o un agente de IA—: implementar de a una épica, citando los números de requisito en los commits; las reglas de trabajo completas están en `CONTRIBUTING.md`. Si una decisión técnica contradice o excede lo escrito acá, se documenta en un ADR antes de codear. Este documento cambia por pull request y cada cambio se refleja en el changelog.

---

## 1. Visión

ELOmax es un entrenador personal de ajedrez, no una colección de minijuegos. Su función objetivo es **maximizar el Elo ganado por hora invertida** en usuarios adultos que quieren mejorar en serio. Se diferencia por tres apuestas: (1) **prescribe** la sesión en lugar de ofrecer un buffet de ejercicios; (2) cierra el ciclo completo *jugar → analizar → extraer errores → entrenar sobre ellos → volver a jugar*, que ninguna app cierra hoy; (3) **se mide a sí misma** con métricas independientes del instrumento de entrenamiento.

La justificación científica de cada decisión está en `docs/evidence/` (informe de investigación, tier list de ejercicios y documento de diseño). Este PRD no repite la evidencia: la referencia.

## 2. Problema

Las apps existentes (Chess.com, Lichess, Aimchess, Chessable, Chessly) tienen buenos ejercicios sueltos pero tres fallas estructurales: dejan que el usuario elija qué entrenar (y el usuario elige sistemáticamente lo cómodo, no lo eficaz), no integran los errores de las partidas reales en un sistema de repaso persistente, y miden el progreso con el mismo instrumento con el que entrenan (rating de puzzles). Además hay cinco huecos que ninguna cubre: entrenamiento anti-Einstellung, calibración del juicio, análisis en dos fases forzado, repetición espaciada transversal y oponentes humano-realistas integrados al ciclo.

## 3. Objetivos y métricas

### 3.1 Métrica estrella (North Star)
**ΔElo por hora de entrenamiento**, medido a 90 días contra línea base, usando el rating de partidas lentas (nunca el rating interno de ejercicios).

### 3.2 Métricas de guardia (guardrails)
- Retención semanal de usuarios activos (una app abandonada rinde cero).
- Tasa de sesiones prescritas completadas (adherencia al Prescriptor).
- Errores graves por partida (media móvil de 10 partidas): debe bajar.
- Calibración (puntuación de Brier): debe bajar (mejor calibración).

### 3.3 Anti-métricas (lo que NO se optimiza)
Minutos en la app, cantidad de puzzles resueltos, rachas. Si una decisión de diseño mejora estas a costa de las de arriba, se rechaza.

## 4. Usuarios

**Persona primaria — "el mejorador serio":** adulto, 900–1900 Elo, juega en Lichess o Chess.com, dispone de 3–6 horas semanales, se frustra con su estancamiento, desconfía del confeti. Usa celular para entrenar en huecos del día y computadora para partidas lentas y análisis.

**Persona secundaria (fase lejana):** entrenadores y docentes que prescriben a alumnos. Fuera de alcance hasta después de v1.0.

## 5. Principios de producto (no negociables)

1. **Prescripción, no buffet.** La pantalla principal es "tu sesión de hoy", no un menú.
2. **Nunca avisar que hay táctica.** El formato por defecto es la posición sin etiqueta.
3. **Todo fallo entra a una única Cola espaciada.** Sin silos por módulo.
4. **El motor se gana.** Análisis propio primero, Stockfish después.
5. **Dificultad en zona de fallo 20–40%,** adaptativa por usuario y módulo.
6. **Medir con instrumento independiente.** Rating de partidas y errores graves, no rating de ejercicios.
7. **El usuario es dueño de sus datos.** Todo exportable de forma clara y fácil (JSON + PGN, E14), sin trackers de terceros.
8. **Transparencia epistémica.** Cada prescripción muestra su porqué; cada módulo declara su nivel de evidencia.

## 6. Alcance

### 6.1 Dentro de alcance (horizonte v1.0)
Jugar partidas (contra bots Maia vía Lichess y motor local), importar historial, análisis en dos fases, Cola Universal con repetición espaciada, el Radar, currículo de patrones y finales, Prescriptor, panel de métricas de verdad, calibración, funcionamiento en celular/tablet/computadora con ambas orientaciones, instalable como aplicación web progresiva (PWA), usable sin conexión para el entrenamiento local, y exportación/restauración completa de los datos del usuario (E14).

### 6.2 Fuera de alcance (explícito)
Funciones sociales, chat, torneos, cursos en video, monetización, apps nativas (iOS/Android compiladas), multijugador propio, cuentas en la nube (hasta fase 6), explicaciones automáticas del motor en lenguaje natural, modo niños.

También quedan fuera de v1.0 tres módulos del documento de diseño (`docs/evidence/forge-diseno-app-ajedrez.md`) que este PRD no adopta como épicas: **"Adiviná la jugada"** (§4.7 del diseño), **aperturas dosificadas con candado de rentabilidad** (§4.8) y **Maia como selectora de posiciones** (§5). Son candidatos a épicas posteriores a v1.0; incorporarlos requiere actualizar este PRD.

---

## 7. Requisitos funcionales por épica

> Convención de identificadores: `RF-<épica>.<número>`. Prioridad: **P0** = imprescindible para que la épica exista, **P1** = importante, **P2** = deseable.

### E1 — Núcleo de tablero y partida

- **RF-1.1 (P0)** El sistema presenta un tablero interactivo que soporta movimiento por arrastre y por toque-toque (origen→destino), promoción con selector, enroques, capturas al paso, y validación completa de legalidad.
- **RF-1.2 (P0)** El tablero escala fluidamente y es utilizable con precisión táctil en pantallas desde 320 px de ancho.
- **RF-1.3 (P0)** El usuario puede jugar partidas locales contra el motor con niveles de fuerza limitada (fallback cuando no hay conexión o cuenta de Lichess).
  - **RF-1.3a (P0)** Los niveles se piden con `UCI_LimitStrength` + `UCI_Elo`, **no** con `Skill Level`: Skill Level no es una curva de dificultad sino fuerza casi plena con errores aleatorios y un piso de ~1350 Elo, así que los niveles no se distinguían entre sí. Por debajo del piso duro de 1320 que impone `UCI_Elo`, la fuerza se baja eligiendo a veces la segunda o tercera línea del motor — nunca una jugada al azar, que no se parece a ningún rival humano.
  - **RF-1.3b (P0)** La progresión de niveles **se mide, no se declara**: `npm run measure:niveles` juega los niveles entre sí y falla si alguno no supera al inferior. Un catálogo de niveles sin medición es una promesa, y esa promesa ya se incumplió una vez sin que nadie lo notara.
  - **RF-1.3c (P0)** Jugar y analizar comparten un único worker de Stockfish. Toda búsqueda fija explícitamente si limita la fuerza o no, en los dos sentidos: si jugar dejara la limitación encendida, el análisis (E3) correría capado en silencio y clasificaría errores contra un motor débil.
- **RF-1.4 (P0)** El usuario puede jugar partidas contra los bots Maia (maia1/maia5/maia9) a través de la interfaz de programación de Lichess, con su token personal (ver ADR-0004 y ADR-0014).
  - **RF-1.4a (P0)** El token es una credencial y **no forma parte de la exportación** (RF-14.1): vive en el dispositivo. Se piden los permisos mínimos (`challenge:write`, `board:play`) y la interfaz declara dónde queda guardado.
  - **RF-1.4b (P0)** El tablero local es un espejo del estado remoto: una jugada propia no se muestra hasta que Lichess la confirma. Mostrarla antes afirmaría algo que el servidor puede rechazar.
  - **RF-1.4c (P0)** Los modos de fallo se nombran por separado (token inválido, permisos faltantes, bot no disponible, límite de tasa, sin conexión). Un bot fuera de línea es un desenlace normal, no un error: la salida ofrece siempre el motor local.
  - **RF-1.4d (P1)** Lichess exige un control de tiempo aunque el producto se juegue sin reloj (E9). Se usa el más largo que entra en una sentada y **se declara en pantalla**: la incoherencia es de la plataforma y no se disimula.
- **RF-1.5 (P0)** Toda partida jugada se persiste localmente con: PGN completo, fuente, resultado y fecha. El campo de tiempos por jugada se conserva en el esquema para partidas **importadas** que los traigan en el PGN, pero las partidas jugadas dentro de la app ya **no se cronometran**: se quitó el cronómetro silencioso junto con la métrica de reloj (ver E9).
- **RF-1.6 (P1)** Controles de partida: rendirse, **abandonar sin guardar** y ofrecer tablas (contra bots: tablas automáticas por regla). Abandonar es distinto de rendirse y no es opcional: rendirse guarda una derrota real, así que si es la única salida, probar el motor y arrepentirse ensucia el historial y —al ser una partida sin reloj— cumple el compromiso semanal de partida lenta. Todo modo con tablero (partida, finales, conversión) debe tener salida visible mientras se juega; dejar un ejercicio a mitad nunca cuenta como intento fallido. Los **relojes configurables** que pedía la versión original de este RF quedan **fuera de alcance** mientras el producto sostenga el juego sin reloj (ver E9): reintroducirlos exigiría revisar esa decisión de forma explícita, no darlos por implícitos.
- **RF-1.7 (P2)** Sonidos discretos de jugada/captura/jaque, desactivables.

*Criterios de aceptación E1:* una partida completa contra el motor local se juega de punta a punta en un celular en orientación vertical y en una computadora, queda guardada, y su PGN exportado abre sin errores en Lichess.

### E2 — Importación de historial

- **RF-2.1 (P0)** El usuario puede vincular su nombre de usuario de Lichess y/o Chess.com e importar sus últimas N partidas (configurable, por defecto 100) vía las interfaces públicas de cada plataforma.
- **RF-2.2 (P0)** El usuario puede importar PGN manualmente (pegar texto o subir archivo) como vía alternativa que no depende de terceros.
- **RF-2.3 (P1)** La importación es incremental: trae solo partidas nuevas desde la última sincronización.
- **RF-2.4 (P1)** Las partidas importadas registran ritmo de juego (bullet/blitz/rápida/clásica); el análisis y la extracción de errores priorizan rápidas y clásicas (los errores de bullet son ruido).

*Criterios de aceptación E2:* con un usuario real de Lichess, la importación trae las partidas correctas, no duplica en re-sincronización, y una caída de la interfaz externa muestra error claro con alternativa manual.

### E3 — Análisis en dos fases

- **RF-3.1 (P0)** Al abrir una partida propia sin analizar, el motor está **bloqueado**. La fase 1 guía al usuario: (a) marcar el momento crítico percibido, (b) escribir su plan en ese momento (texto corto), (c) evaluar tres posiciones que el sistema selecciona (escala: +− / ± / = / ∓ / −+).
- **RF-3.2 (P0)** Completada la fase 1, la fase 2 corre Stockfish local (ver ADR-0002), muestra la curva de evaluación, clasifica jugadas (error grave / error / imprecisión) y compara las evaluaciones del usuario con las del motor (alimenta calibración, E10).
- **RF-3.3 (P0)** Cada error grave o error detectado genera una tarjeta candidata para la Cola Universal (E4); el usuario la confirma y categoriza en un toque: táctico / posicional / tiempo / psicológico.
- **RF-3.4 (P1)** La fase 1 está diseñada para durar ≤5 minutos; el sistema mide y ajusta la cantidad de preguntas si el usuario abandona.
- **RF-3.5 (P1)** Modo "análisis exprés" para partidas rápidas importadas en lote: solo fase 2 automática con revisión de tarjetas candidatas (el análisis en dos fases completo se reserva para partidas lentas). **Sube de P2 a P1**: de las tarjetas con `origen: 'partida'` dependen la fuga táctica (RF-11.2), el reciclaje de errores propios (RF-5.9) y la métrica de errores graves (RF-12.1), así que sin un camino practicable a ellas media app queda apagada. Las partidas analizadas por exprés quedan con `analisis` y **sin** `fase1`: no se simula una fase 1 que no ocurrió.

*Criterios de aceptación E3:* es imposible ver la evaluación del motor de una partida propia sin haber pasado la fase 1 (salvo modo exprés en importaciones masivas); el flujo completo toma <10 minutos en una partida de 40 jugadas en un celular de gama media.

### E4 — Cola Universal de errores (repetición espaciada)

- **RF-4.1 (P0)** Existe una única cola de tarjetas de repaso. Cada tarjeta contiene: posición (FEN), lado a mover, respuesta del usuario en el evento original, respuesta correcta, origen (partida/Radar/final/apertura), categoría de error y estado del planificador.
- **RF-4.2 (P0)** El planificador implementa FSRS (ver ADR-0003): acierto espacia la reaparición, fallo la reinicia. Parámetros por defecto de la librería; recalibrables a futuro sin migración de datos.
- **RF-4.3 (P0)** Al responder una tarjeta, el usuario produce la jugada en el tablero (nunca opción múltiple).
- **RF-4.4 (P0)** Los repasos vencidos tienen prioridad fija al inicio de cada sesión prescrita.
- **RF-4.5 (P1)** Tope diario de tarjetas nuevas configurable (por defecto 10) para evitar avalanchas de repaso.
- **RF-4.6 (P2)** Estadísticas de la Cola: tasa de retención por categoría de error, tarjetas "sanguijuela" (fallan >5 veces) con sugerencia de estudio dedicado.

*Criterios de aceptación E4:* una tarjeta fallada reaparece antes que una acertada; los intervalos crecen con aciertos consecutivos; el estado sobrevive al cierre del navegador y a una actualización de versión de la app (migraciones, RNF-5).

### E5 — El Radar (formato táctico por defecto)

- **RF-5.1 (P0)** El Radar presenta posiciones **sin etiquetar** de cinco tipos mezclados en proporciones no predecibles: táctica ofensiva, defensa obligada, posición tranquila (la respuesta correcta es una jugada sólida sin ganancia forzada), oferta de material genuina, oferta de material envenenada.
  - **RF-5.1a (P0)** Los cinco tipos siguen siendo **alcanzables a cualquier dificultad**. Que un tipo desaparezca en un tramo de la escala es un patrón trivial tan predictivo como una etiqueta: si a dificultad alta nunca hay ofertas envenenadas, "capturar siempre está bien" acierta el 100% de las veces. El selector rescata los tipos que la banda de dificultad deja afuera, con un tope por tipo para que un tipo escaso no domine la sesión.
- **RF-5.2 (P0)** Flujo por posición: el usuario primero declara evaluación rápida (mejor blancas / igual / mejor negras), luego produce su jugada en el tablero.
- **RF-5.3 (P0)** El feedback explica el porqué **también cuando no había táctica** ("la captura era sana porque no existe la descubierta en…"). Sin esta explicación, las posiciones tranquilas frustran en lugar de enseñar.
  - **RF-5.3a (P0)** La explicación es **de la posición, no del tipo**. Una frase fija por tipo, repartida entre todas las posiciones del catálogo, no cumple RF-5.3: afirma cosas que no siempre son ciertas del caso concreto y no dice cuál era la táctica. El texto se compone de afirmaciones verificables reproduciendo la solución sobre el tablero (mate en N, material al terminar la línea, motivo táctico con nombre, alternativas equivalentes) y **omite la afirmación que no puede respaldar** en vez de rellenar. Cuando no queda nada específico que decir, cae a la frase genérica del tipo.
  - **RF-5.3b (P0)** El feedback muestra la **línea completa** de la solución, no solo su primera jugada.
  - **RF-5.3d (P0)** Cuando la respuesta fue incorrecta, la jugada correcta se **muestra en el tablero**, no solo se nombra: el tablero vuelve a la posición en la que se decidió y dibuja la jugada correcta y la propia. Nombrarla en notación deja el trabajo de ubicarla justo en el momento en que el usuario acaba de demostrar que no la veía. Aplica a todo bloque que se responde jugando —Cola, patrones, Radar, diagnóstico y finales—; el criterio de cálculo, que se responde con un botón, no tiene jugada que señalar.
  - **RF-5.3c (P1)** En una oferta envenenada, el feedback nombra la captura carnada y su refutación. Cuál de las capturas aparentemente ganadoras es la trampa lo decide el motor fuera de línea y viaja en el catálogo; si una posición no lo tuviera, se usa el texto genérico en lugar de deducirlo en la app.
- **RF-5.4 (P0)** Los fallos del Radar generan tarjetas para la Cola Universal.
- **RF-5.5 (P0)** Dificultad adaptativa: el selector mantiene la tasa de acierto del usuario en 60–80% (zona de fallo 20–40%) ajustando el rating de las posiciones servidas.
- **RF-5.6 (P1)** Fuentes de contenido: base de puzzles de Lichess (licencia CC0, ver ADR-0005) para tácticas y defensas; posiciones tranquilas generadas por pipeline propio: posiciones de partidas reales donde el motor confirma que ninguna jugada gana material ni cambia la evaluación en más de X centipeones (umbral configurable en el pipeline).
  - **RF-5.6a (P1)** El intervalo de repetición es **medible y se mide** (`npm run measure:radar`): el catálogo no se sirve entero, porque la banda adaptativa de RF-5.5 restringe el pool efectivo a una fracción del total. La ventana anti-repetición se expresa como fracción del pool **alcanzable**, no como un número fijo de posiciones: una ventana fija mayor que el pool se vacía y termina repitiendo igual, pero perdiendo además el control de dificultad.
- **RF-5.7 (P1)** Subtipo anti-Einstellung: problemas de **doble solución** (una línea familiar que funciona, otra superior). Se puntúa encontrar la superior; el sistema registra la tasa de "conformismo con la primera idea" del usuario.
- **RF-5.8 (P1)** Regla de candidatas: en un subconjunto aleatorio de posiciones, tras la respuesta del usuario y antes de revelar, el sistema pregunta "¿hay algo mejor?" y permite cambiar la jugada. Se registra si el cambio mejora o empeora.
- **RF-5.9 (P1)** Posiciones provenientes de errores propios del usuario se reciclan dentro del Radar (integración con E4).
- **RF-5.10 (P1)** El tablero admite **anotaciones del usuario**: flechas y círculos que se dibujan encima para pensar, sin mover ninguna pieza. Con mouse van por el **botón derecho** (arrastrar dibuja flecha, click dibuja círculo, repetir la misma marca la borra), que es el gesto que ya tienen incorporado quienes analizan en Lichess o chess.com. En pantalla táctil no hay botón derecho, así que hay un **modo dibujo explícito** junto al tablero: mientras está activo el dedo dibuja en vez de mover, con selector de color —sin teclado no hay modificadores— y un botón de borrar. Las marcas son borrador: valen para la posición en la que se dibujaron, no se persisten y se limpian al cambiar de posición, pero **sobreviven a la revelación del feedback**, que es justo cuando sirve compararlas con la respuesta.

*Criterios de aceptación E5:* en una muestra de 100 posiciones servidas, ningún patrón trivial predice el tipo (p. ej., "las tranquilas nunca vienen después de dos tácticas"); la tasa de acierto de un usuario estable converge a la banda 60–80% en ≤50 posiciones.

### E6 — Currículo base: patrones y finales

- **RF-6.1 (P0)** Biblioteca de mates típicos y motivos tácticos organizada por patrón, servida con recuperación activa (resolver en el tablero) y **motivos intercalados** — el sistema nunca sirve bloques monotemáticos.
- **RF-6.2 (P0)** Biblioteca de finales teóricos elementales (rey y peón, torre básicos: Lucena, Philidor, oposición, regla del cuadrado, peón de torre) que se **juegan contra Stockfish** hasta demostrar la técnica (aquí la defensa perfecta del motor es deseable).
  - **RF-6.2a (P0)** "Demostrar la técnica" es llevarla hasta el final, y cada final declara cuál es ese final: en un mate elemental, **dar el mate**; en un final de peón o de Lucena, **coronar y que la posición siga decidida** después de coronar; en uno de tablas, **alcanzarlas o sostener la defensa** durante doce jugadas propias. Que el motor *vea* el mate o que el peón corone no alcanza: cerrar el ejercicio ahí acredita una técnica que el usuario no ejecutó, y es lo mismo que la app dice no querer hacer con el resto de sus métricas. Perder la técnica muestra el punto crítico —posición, jugada propia y la que prefería el motor— además de registrarlo como repaso.
- **RF-6.3 (P0)** Cada patrón y final tiene estado en el planificador espaciado: reaparece con intervalos crecientes hasta automatización (3 demostraciones espaciadas sin error). El **espaciado es parte del requisito, no un detalle**: una interfaz que permita encadenar las tres demostraciones seguidas produce automatización por práctica masiva, que es el mecanismo contrario al que sostiene el currículo. Repetir un elemento antes de que venza está permitido como práctica libre, pero no acumula racha ni mueve el calendario (mismo criterio que RF-7.2).
- **RF-6.4 (P1)** Verificación de finales contra tablebases vía interfaz de Lichess cuando hay conexión (sello de "jugada perfecta").
- **RF-6.5 (P2)** Modificador a ciegas progresivo (piezas fantasma → solo coordenadas) que se activa automáticamente sobre patrones con acierto >80% para mantener la dificultad deseable.

### E7 — Cálculo comprometido

- **RF-7.1 (P0)** Un solo ejercicio de **cálculo declarado**, sin presets ni selector de modo (ADR-0016): el usuario declara lo que ve —candidatas y la línea que calculó para cada una— **antes de que el tablero se mueva**, sobre una posición sin respuesta única, sin reloj, con 2 a 5 ramas y evaluación obligatoria al final de cada rama. Se puntúa lo declarado entero, no solo la primera jugada. Las **dos primeras ramas piden línea** —tu jugada y al menos la respuesta que esperás— y de la tercera en adelante alcanza la candidata suelta: cinco líneas completas en un celular son una carga de datos, no un ejercicio de ajedrez, y la amplitud la sostienen las sueltas. La profundidad se mide sobre la rama que empiece por la mejor jugada del motor, así que calcular más profundo se refleja sin que el formulario lo exija. Las jugadas se escriben y se muestran en **notación algebraica española** (RNF-9).
  - **RF-7.1a (P0)** Se mide con **tres números que se leen por separado y nunca se promedian**: cobertura (la mejor jugada del motor estaba entre las candidatas), profundidad vista (plies coincidentes con la variante principal) y brecha de evaluación (distancia entre el símbolo declarado y el del motor, que alimenta la calibración de E10). En una posición sin respuesta única un binario mide el contenido servido, no el cálculo del usuario.
  - **RF-7.1b (P2)** Los intentos guardados con el preset `forzado`, anterior a ADR-0016, se siguen leyendo y exportando, y el Panel los muestra como historial. Ningún camino de la app escribe ese valor.
- **RF-7.2 (P1)** El ejercicio es **semanal** y su posición sale de las **partidas propias analizadas** cuando hay alguna: la jugada donde el usuario perdió más centipeones o consumió más tiempo. El catálogo minado queda como respaldo para cuentas nuevas. Repetirlo durante el enfriamiento está permitido como práctica libre, sin medir ni resetear la semana.
- **RF-7.3 (P2)** Sin cronómetro visible **durante** el ejercicio (el objetivo es profundidad, no velocidad). El tiempo se registra y **se muestra después**, en la tarjeta de Cálculo del Panel ("le dedicaste 12 min de análisis"), como señal de proceso: guardar en silencio un dato que el usuario nunca puede ver es justamente la incoherencia que se corrigió en E9.

### E8 — Conversión de ventajas

- **RF-8.1 (P1)** El sistema detecta en el historial del usuario posiciones ganadoras desperdiciadas (ventaja ≥ +3 que terminó en tablas o derrota) y las ofrece para rejugar **contra Maia** al nivel del usuario (defensa humano-realista, no Stockfish).
- **RF-8.2 (P2)** Variante con reloj corto (conversión bajo presión).
- **RF-8.3 (P1)** Fallback sin conexión/sin Lichess: motor local con fuerza limitada, señalando la limitación ("la resistencia del motor no es humana"). **Sube de P2 a P1**: el material de esta épica sale del análisis de las partidas propias y nunca dependió de la red, así que tratarla como bloqueada por Maia dejaba sin construir un módulo tier-A que sí se puede entregar. La detección toma el **pico** de ventaja (≥ +3) en una posición donde movía el usuario, en partidas que terminaron en tablas o derrota.

### E9 — Criterio de cálculo ("¿Calcular o ya alcanza?")

> **Revisión 2026-07 — de "Triage de reloj" a criterio de cálculo.** Esta épica nació como gestión del reloj: un perfil de sobregasto/infragasto construido con los tiempos por jugada (RF-9.1) y un informe mensual de fugas de tiempo (RF-9.3). Se retiró por incoherente con el producto: ELOmax se juega **sin reloj** (RF-11.4, E7, E8 y el propio diagnóstico lo dicen explícitamente), y sostener esa métrica obligaba a cronometrar cada jugada en silencio, con datos que el usuario nunca veía ni consentía. Lo que sí tenía valor —y se conserva— es el ejercicio de decidir si una posición merece cálculo profundo: eso es **calibración del esfuerzo**, no del reloj.

- **RF-9.1 (P1)** ~~Perfil de gestión de tiempo desde los tiempos por jugada.~~ **Retirado** (ver nota). El disparador del ejercicio pasa a ser la fuga táctica ya medida sobre errores reales de partida (RF-11.2), que es observable y explicable al usuario.
- **RF-9.2 (P1)** Ejercicio: dada una posición, decidir si **pide cálculo profundo** o **alcanza con una jugada sólida**. Sin cronómetro: se evalúa el criterio, no la velocidad. Recicla los cinco tipos ya verificados del Radar (E5) en vez de pedir contenido nuevo.
- **RF-9.3 (P2)** Informe mensual en el panel (E11): precisión del ejercicio en los últimos 30 días. ~~Fugas de tiempo.~~

### E10 — Calibración del juicio

- **RF-10.1 (P0)** En ~1 de cada 4–5 respuestas (muestreo aleatorio, para no arruinar el flujo), el sistema pide confianza declarada (0–100) antes de revelar el resultado.
- **RF-10.2 (P0)** El sistema computa y persiste la puntuación de Brier acumulada, global y por contexto (Radar, evaluaciones de análisis, Stoyko).
- **RF-10.3 (P1)** Panel de calibración: curva de confianza declarada vs. tasa real de acierto, con lectura en lenguaje claro ("cuando decís 90%, acertás 70%: sobreconfianza en posiciones tácticas"). La métrica **titular** es la brecha (a cuántos puntos queda la confianza del acierto real), no Brier: Brier mezcla calibración con dificultad del material, y como el Radar sostiene el acierto en torno al 70% a propósito (RF-5.5), penaliza a quien está bien calibrado en material difícil. Brier se conserva como detalle porque es métrica de guardia (§3.2).

### E11 — Prescriptor y sesión diaria

- **RF-11.1 (P0)** La pantalla principal es **"Tu sesión de hoy"**: una secuencia de bloques con duración total visible (por defecto 25 min; mínima viable 15; configurable).
- **RF-11.2 (P0)** Composición de la sesión, en orden: (1) repasos vencidos de la Cola; (2) dieta base por banda de Elo (tabla versionada en configuración, no hardcodeada — ver §9); (3) ajuste por fugas del último mes. El ejemplo original de este RF era "si >35% de derrotas son por reloj, sube Triage"; al retirarse la métrica de reloj (ver E9), la fuga que se mide es la **táctica**: si >35% de los errores recientes de partidas propias son tácticos, se refuerza el Radar y se suma el bloque "¿Calcular o ya alcanza?". Ese bloque tiene un **segundo disparador**: la fuga de cálculo —fallar posiciones del Radar cuya solución es una línea forzada de 3+ plies— también lo activa (ADR-0016), porque es la respuesta que entra en el presupuesto del día; el ejercicio de cálculo propiamente dicho es carga semanal (RF-11.3a).
- **RF-11.3 (P0)** Cada bloque muestra su **porqué** en una línea ("Radar 12 min — tus errores graves en posiciones tranquilas duplican tu promedio").
  - **RF-11.3a (P0)** Los ejercicios que **no caben en el formato de la sesión** (partida lenta y su análisis, finales jugados enteros, el ejercicio de cálculo) también se prescriben, con el mismo contrato: qué es, por qué hoy y cuánto dura. Que vivan en otra pantalla no los convierte en un menú opcional — eso contradice el principio 1. Cada uno declara su propio cumplimiento con la señal que le es propia (la semana para los semanales, los finales jugados hoy según el planificador, la fecha del último intento para el cálculo) y no aparece cuando no corresponde. Cumplir la carga del día tiene que verse: una prescripción que sigue diciendo "hoy te toca" después de haberla hecho enseña a no confiar en el plan.
  - **RF-11.3b (P1)** Existe un lugar donde el usuario puede ver **todos** los ejercicios y qué dispara cada uno. Buena parte del producto es invisible por diseño (muestreos aleatorios, subtipos que no se anuncian, modificadores que se activan solos), y sin esa lista el usuario no puede distinguir "no me apareció porque no me corresponde" de "no existe". Es la contracara del principio 8: la app decide, pero declara con qué criterio.
- **RF-11.4 (P0)** Diagnóstico inicial: importación + análisis en lote (E2/E3 exprés) → banda de Elo y perfil de fugas → primera dieta. Sin historial: 2 partidas sin reloj contra Maia escalonada + 20 posiciones de Radar.
  - **RF-11.4a (P0)** El diagnóstico usa **el mismo instrumento** que la sesión: sus posiciones de Radar pasan por el paso de evaluación rápida (RF-5.2) y piden confianza declarada (RF-10.1) en un subconjunto **fijo** de posiciones —no muestreado al azar como en la sesión— para que la línea base de Brier tenga la misma cantidad de observaciones en todos los casos. Sin esto, los números del diagnóstico no son comparables con los de ninguna sesión posterior.
  - **RF-11.4b (P0)** El diagnóstico **no adapta** la dificultad mientras mide (si adaptara, la tasa de acierto convergería a la banda objetivo para cualquier nivel y dejaría de discriminar), pero **sí siembra** el centro adaptativo del Radar (RF-5.5) con la tasa observada, junto al historial de tipos e ids servidos. Sus respuestas se marcan con origen propio y quedan fuera de la lectura de la banda 60–80% y del detector de sobreajuste (RF-12.3).
  - **RF-11.4c (P0)** El diagnóstico produce y persiste un **perfil de fugas** por tipo de posición del Radar (los cinco de RF-5.1). Se guardan los conteos crudos, no una conclusión. Con ~4 observaciones por tipo, señalar una fuga exige observaciones mínimas, acierto bajo en absoluto **y** separación clara del promedio del propio usuario; cuando nada califica, la interfaz dice que todavía no hay señal en vez de nombrar la menos buena.
  - **RF-11.4d (P0)** Las partidas del diagnóstico se registran con su contexto y **no cumplen** el compromiso semanal de partida lenta (RF-11.7): ese compromiso es una partida que el usuario decide jugar. Siguen contando para las métricas de verdad si se analizan. El compromiso exige además un largo mínimo de partida: una rendición temprana es una partida real pero no el ejercicio que el compromiso pide.
  - **RF-11.4e (P0)** El diagnóstico cierra con un **informe**, no con una etiqueta: banda con su significado, valor de arranque de cada métrica de verdad con qué mide y para qué sirve, perfil de fugas, recomendaciones derivadas de esos datos, y cuándo se vuelve a medir. Su acción primaria es analizar una de las partidas recién jugadas —el único camino a la línea base de errores graves y a las tarjetas de origen `partida`, de las que dependen RF-11.2 y RF-5.9—. El análisis nunca se dispara solo: la fase 1 es del usuario (RF-3.1).
- **RF-11.5 (P1)** El usuario puede saltear un bloque (se registra) pero no reordenar la prioridad de la Cola.
- **RF-11.6 (P1)** Las reglas del Prescriptor viven en un archivo de configuración versionado (JSON) con su propio changelog: iterar la dieta no toca código.
- **RF-11.7 (P2)** Modo "partida lenta programada": el Prescriptor reserva bloques semanales para partidas completas + análisis (no todo es ejercicio).
- **RF-11.8 (P2)** El loop diario enlaza sus fases con transiciones sobrias de hasta 200 ms y asienta el resultado sobre el tablero sin filtrar la respuesta antes de confianza: flecha sobre la jugada aceptada al acertar y pulso de velo bajo el rey al fallar. Sonido y vibración son canales independientes, opcionales y apagados por defecto; nunca cambian la semántica del feedback ni adoptan patrones de premio.

### E12 — Panel de métricas y autoexperimento

- **RF-12.1 (P0)** Panel de verdad (grande, al frente): rating de partidas lentas, errores graves por partida (media móvil), calibración. Panel de actividad (chico, atrás): sesiones, minutos, volumen.
  - **RF-12.1b (P0)** Las métricas de verdad se muestran como **serie**, no como valor puntual: la pregunta del producto es si algo mejora, y un número solo no la responde. La lectura de tendencia solo aparece con puntos suficientes. La banda de Elo **no** es una métrica de verdad —es un insumo del Prescriptor que no cambia después del diagnóstico— y no ocupa lugar entre ellas.
  - **RF-12.1a (P0)** El **rating de partidas lentas** necesita una fuente real. Mientras la importación automática de historial siga bloqueada (RF-2.1), la única disponible es el rating que el usuario declara: se pide una vez en el diagnóstico (opcional, no bloqueante), se guarda como **serie** y se puede actualizar desde Ajustes. Lo que se muestra como métrica es el **cambio contra la primera toma**, no el número suelto. Sin esta fuente, la métrica estrella (§3.1) y el detector de sobreajuste (RF-12.3) no tienen instrumento para un usuario que solo juega dentro de la app: sus partidas se guardan sin reloj y sin rating.
- **RF-12.2 (P1)** Batería de transferencia: set fijo de 30 posiciones nunca entrenadas, ofrecida cada 6–8 semanas, con resultados comparables entre tomas.
- **RF-12.3 (P1)** Detector de sobreajuste: si el rating interno de ejercicios sube durante 8 semanas sin que el rating de partidas acompañe, alerta explícita + rebalanceo sugerido de dieta hacia partidas y análisis.
- **RF-12.4 (P2)** Modo experimento n=1: registro de línea base, dosis por modalidad, y comparación entre bloques de énfasis distinto (diseño ABAB simple), con las advertencias metodológicas escritas en pantalla.

### E13 — Adherencia honesta

- **RF-13.1 (P1)** Adherencia de **proceso** mediante un plan semanal personalizado: sesiones completadas, nunca resultado ni volumen; como máximo una sesión por día para la meta.
- **RF-13.2 (P1)** Celebración atada a métricas de verdad ("tus errores graves bajaron 30% este mes").
- **RF-13.3 (P2)** Recordatorio diario opcional (notificación local de la PWA), configurable y apagado por defecto.
- **RF-13.4 (P1)** Plan configurable (Ligero 2/60, Constante 3/90, Intenso 5/150 o personalizado 1–7 sesiones y 15–600 minutos), persistido y exportable.
- **RF-13.5 (P1)** Racha semanal y consistencia de las últimas ocho semanas; la consistencia tiene mayor jerarquía y una semana fallida no borra la historia.
- **RF-13.6 (P2)** Hitos ligados a capacidades o evidencia nueva, con explicación de significado; sin XP, monedas, cofres ni rankings.

### E14 — Exportación e importación de datos

- **RF-14.1 (P0)** Exportación completa en **un solo archivo** desde Ajustes → "Exportar mis datos", alcanzable en ≤3 toques desde la pantalla principal. El archivo (.zip) contiene: manifiesto con versión de esquema y fecha, perfil y configuración (JSON), todas las partidas (PGN estándar + metadatos JSON), Cola Universal y currículo con estado FSRS completo, registros de calibración, sesiones y baterías de transferencia.
- **RF-14.2 (P0)** Importación/restauración desde ese archivo en cualquier dispositivo, con migración automática si la versión de esquema es anterior a la actual.
- **RF-14.3 (P1)** Exportaciones parciales en formatos abiertos: PGN de partidas (compatible con Lichess y cualquier visor), CSV de tarjetas y de registros de calibración.
- **RF-14.4 (P1)** Recordatorio de respaldo configurable (por defecto mensual, no intrusivo): en una app local-first, un dispositivo perdido sin respaldo significa datos perdidos, y el sistema lo comunica con claridad.
- **RF-14.5 (P2)** Documentación del formato de exportación en `docs/` (el usuario nunca queda encerrado: cualquier persona o herramienta puede leer sus datos).

*Criterios de aceptación E14:* exportar en un dispositivo A y restaurar en B deja a B con la misma sesión prescrita que hubiera tenido A al día siguiente; un PGN exportado abre sin errores en Lichess; el flujo completo toma ≤3 toques y termina en un archivo descargado.

---

## 8. Requisitos no funcionales

### RNF-1 — Multiplataforma y responsive (P0)
La app funciona en navegadores modernos de computadora, celular y tablet. Diseño adaptativo con tres layouts: **vertical móvil** (tablero arriba, panel de acción abajo), **horizontal móvil/tablet** (tablero a la izquierda, panel a la derecha), **escritorio** (tablero central, paneles laterales). El cambio de orientación **re-acomoda sin recargar ni perder estado**. Targets táctiles ≥44 px. Respeta las zonas seguras de iOS. El tablero es siempre el elemento dominante de la pantalla.

### RNF-2 — Aplicación web progresiva y sin conexión (P0)
Instalable (manifest + service worker). Sin conexión funcionan: Radar, Cola, currículo, el ejercicio de cálculo y análisis con motor local. Requieren conexión: bots Maia, importación, tablebases. El estado de conexión se comunica sin bloquear lo que sí funciona.

### RNF-3 — Rendimiento (P0)
Interactividad inicial <3 s en un celular de gama media con red 4G. Stockfish corre en Web Worker, nunca en el hilo principal; usa multihilo (SharedArrayBuffer) cuando el hosting sirve las cabeceras COOP/COEP, con fallback a un hilo. Presupuesto de análisis configurable por posición. Valores por defecto, documentados acá porque difieren del borrador original de este RNF ("profundidad 18 o 3 s por posición crítica") — la implementación de E3 evalúa *todas* las posiciones de la partida (RF-3.2), no solo las críticas, y a esa cantidad la prioridad pasó a ser no bloquear la UI por minutos en partidas largas: **profundidad 14** para el análisis de partida completa (`ANALYSIS_DEPTH`, `services/analysis/gameAnalyzer.ts`). Los pipelines offline que sí pueden permitirse más tiempo por posición (posiciones tranquilas, doble solución, Stoyko — todos corren en build time, no en el dispositivo del usuario) usan el mismo criterio entre sí: profundidad 14 de criba + reconfirmación a 17 antes de aceptar una posición al catálogo (`docs/radar-dataset.md`). Módulos cargados perezosamente por épica.

### RNF-4 — Local-first y propiedad de los datos (P0)
Todo el estado del usuario vive en IndexedDB del dispositivo. La exportación e importación completas están especificadas como épica propia (E14): un archivo, ≤3 toques, restauración total. Sin analítica de terceros; la telemetría es el propio panel del usuario. La sincronización en la nube es una fase futura (F6) y será opcional y cifrable.

### RNF-5 — Robustez evolutiva (P0)
Esta es la traducción técnica de "que permita cambios sin romperse":
- **TypeScript estricto** en todo el código (`strict: true`, sin `any` implícito).
- **Migraciones de esquema versionadas** para IndexedDB: toda versión que cambie el modelo de datos incluye migración probada con datos de la versión anterior. Romper los datos guardados del usuario es el bug más grave posible en una app local-first.
- **Tests obligatorios de dominio**: planificador FSRS, extracción de errores del análisis, reglas del Prescriptor, pipeline de posiciones tranquilas, migraciones. (Las reglas del ajedrez no se testean: las provee la librería.)
- **Integración continua en GitHub Actions**: lint + typecheck + tests en cada push; no se mergea en rojo.
- **Arquitectura modular por épica** con fronteras explícitas: `core/` (dominio puro, sin dependencias de interfaz) separado de `ui/` y `services/` (motor, Lichess, almacenamiento). El Radar no importa nada del Prescriptor salvo interfaces compartidas.
- **Feature flags simples** (configuración local) para desplegar épicas incompletas apagadas.
- **Definición de "hecho"**: código + tests + typecheck verde + entrada en changelog + PRD/ADR actualizados si hubo desvío.

### RNF-6 — Accesibilidad (P1)
Navegación por teclado completa en escritorio (incluida entrada de jugadas en notación algebraica). Contraste AA. Piezas y resaltados distinguibles sin depender solo del color. Respeta `prefers-reduced-motion`: corta transiciones decorativas y movimiento de piezas, conserva las señales finales estáticas y responde si la preferencia cambia con la app abierta. El feedback háptico es opt-in y se suprime bajo movimiento reducido.

### RNF-7 — Idioma (P1)
Interfaz en español rioplatense desde el día uno; textos externalizados (i18n) para habilitar inglés después sin reescritura.

### RNF-8 — Licencia (P0)
El proyecto es de código abierto bajo **GPLv3** (formalizado en ADR-0006, coherente con la dependencia de Stockfish — ver ADR-0002). El texto oficial vive en `LICENSE` en la raíz del repositorio. Los datos de puzzles son CC0 con atribución de fuente en la documentación; los pesos de Maia son de investigación abierta; el set de piezas Staunty es CC BY-NC-SA 4.0 con atribución (ver `public/piece/staunty/README.md`).

### RNF-9 — Una sola notación de jugadas, con idioma elegible (P0)
Toda jugada que la app **muestre** o **pida escribir** va en notación algebraica. UCI (`e2e4`) es formato de almacenamiento y de diálogo con el motor, nunca de pantalla; se sigue aceptando al escribir porque no se confunde con ninguna jugada algebraica.

El **idioma de las iniciales de pieza es una preferencia** (Ajustes), con español por defecto: español (R, D, T, A, C) o inglés (K, Q, R, B, N). Las dos son correctas — el Apéndice C de las Leyes del Ajedrez de la FIDE dice que la inicial es la del nombre de la pieza **en el idioma del jugador**— y cuál se usa depende de con qué aprendió a anotar cada uno: mucha gente que juega en español anota en inglés porque así lo vio siempre en Lichess o chess.com. Imponer una sería pelearse con la costumbre de media base de usuarios.

Lo que **no** se admite es que convivan: al validar entrada se acepta solo el idioma configurado, porque "Re1" es rey en español y torre en inglés y las dos pueden ser legales en la misma posición. La entrada en el otro idioma se rechaza con un mensaje que enseña la equivalencia y señala dónde cambiarla. Ajustes explica además cómo se lee la notación, porque la app pasa a **pedir** jugadas escritas y quien nunca anotó una partida quedaría afuera del ejercicio de cálculo. Detalle en `docs/design-system.md`.

### RNF-10 — Las cantidades se dicen en la unidad del usuario (P1)
Las evaluaciones y los costos de una jugada se muestran en **peones con un decimal**, nunca en centipeones: el centipeón es la unidad del motor y obliga a dividir por cien mentalmente. Una evaluación lleva signo (`+1,2`, `−0,8`, `0,0`); lo que **costó** una jugada va sin signo, porque es una magnitud y "perdiste −2,5" es una doble negación. Cuando se informa un costo se acompaña del salto de evaluación (`de +1,2 a −1,3`): perder dos peones desde +6 deja la partida ganada y perderlos desde +1 la entrega, así que la magnitud sola no ubica la jugada.

---

## 9. Arquitectura de referencia

**Stack (decisión en ADR-0001):** Vite + React + TypeScript, Tailwind CSS con tokens propios (ver `design-system.md`), Zustand para estado, Dexie sobre IndexedDB, chessops/chess.js para reglas, chessground (el tablero de Lichess, código abierto) para la interfaz del tablero, Stockfish WASM en worker, ts-fsrs para el planificador, vite-plugin-pwa.

**Capas:**

```
ui/            ← pantallas y componentes (React). No contiene lógica de dominio.
core/          ← dominio puro y testeable: scheduler (FSRS), prescriptor,
                 extractor de errores, calibración, selector del Radar.
services/      ← adaptadores al mundo: engine (Stockfish worker), lichess
                 (import + bots + tablebases), storage (Dexie + migraciones),
                 puzzles (dataset local).
config/        ← dieta del prescriptor (JSON versionado), flags, umbrales.
```

Regla de dependencias: `ui → core → (interfaces de) services`. `core` no importa React ni Dexie: recibe puertos. Esto permite testear el dominio sin navegador y cambiar almacenamiento o motor sin tocar la lógica.

**Modelo de datos (entidades núcleo):**

| Entidad | Campos clave |
|---|---|
| `Game` | id, pgn, fuente (local/lichess/chesscom/manual), ritmo, resultado, tiemposPorJugada, analizada (bool), fase1 (respuestas del usuario), fecha, contexto (diagnóstico) |
| `ErrorCard` | id, fen, ladoAMover, jugadaUsuario, jugadaCorrecta, categoría, origen, fsrs {due, stability, difficulty, reps, lapses}, historialRepasos |
| `RadarItem` | id, fen, tipo (ofensiva/defensa/tranquila/genuina/envenenada/dobleSolución), temas[], rating, fuente |
| `CurriculumItem` | id, tipo (patrón/final), contenido, fsrs, demostracionesLimpias |
| `CalibrationRecord` | id, contexto, confianzaDeclarada, acierto, fecha |
| `Session` | id, fecha, bloquesPrescritos[], bloquesCompletados[], duración |
| `Profile` | bandaElo, ratingsExternos (serie declarada), perfilDeFugas (por tipo del Radar), config, versiónEsquema |
| `TransferBattery` | setId, tomas[{fecha, resultados[]}] |

**Dependencias externas y sus riesgos:** interfaz de Lichess (generosa pero con límites de tasa; mitigación: adaptador con reintentos + import manual de PGN como camino alternativo permanente); interfaz pública de Chess.com (solo lectura; mismo adaptador); bots Maia (solo 3 niveles hoy — 1100/1500/1900; suficiente para v1, self-hosting como evolución en ADR-0004); dataset de puzzles (descarga única, se procesa en pipeline propio, sin dependencia en runtime).

---

## 10. Estructura documental del proyecto

```
/
├── README.md              ← qué es, cómo correr, enlaces a docs
├── CONTRIBUTING.md        ← reglas de trabajo (personas y agentes de IA)
├── LICENSE                ← texto oficial de GPLv3
├── CHANGELOG.md           ← Keep a Changelog + versionado semántico
├── docs/
│   ├── PRD.md             ← este documento (fuente de verdad de producto)
│   ├── roadmap.md         ← fases con criterios de salida (documento vivo)
│   ├── design-system.md   ← tokens, componentes, principios visuales
│   ├── adr/               ← decisiones de arquitectura, numeradas e inmutables
│   │   ├── README.md      ← proceso + índice
│   │   └── NNNN-*.md
│   ├── evidence/          ← informe científico, tier list, diseño de producto
│   └── prototipos/        ← referencia visual y prototipo interactivo del design system
├── public/                ← assets estáticos servidos tal cual (set de piezas, íconos)
└── src/                   ← código (estructura en §9)
```

**Convenciones:**
- **ADRs**: se escriben ANTES de implementar cualquier decisión con costo de reversa alto (elección de librería estructural, formato de datos, dependencia externa, algoritmo del dominio). Son inmutables: para cambiar una decisión se escribe un ADR nuevo que declara al anterior "reemplazado". Formato en `adr/0000-plantilla.md`.
- **Changelog**: formato Keep a Changelog, sección `[Sin publicar]` siempre abierta, versionado semántico 0.x.y durante el MVP (x = fase del roadmap completada, y = correcciones y mejoras menores). Cada pull request toca el changelog.
- **Commits**: convención `tipo(alcance): descripción` (feat/fix/docs/refactor/test/chore), referenciando requisitos (`feat(radar): RF-5.3 feedback en posiciones tranquilas`).
- **Definición de "hecho"**: ver RNF-5.

## 11. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Fricción del análisis en dos fases mata retención | Alto | Fase 1 ≤5 min medida (RF-3.4); modo exprés para lotes |
| Migración de datos rompe estado de usuarios | Alto | Migraciones versionadas + tests + export siempre disponible (RNF-4/5) |
| Pérdida del dispositivo sin respaldo (local-first) | Alto | Exportación en ≤3 toques + recordatorio periódico de respaldo (E14) |
| Cambios o límites en interfaces de Lichess/Chess.com | Medio | Adaptadores aislados + import manual PGN permanente (RF-2.2) |
| Solo 3 niveles de Maia disponibles | Medio | Suficiente para v1; ADR-0004 documenta el camino a self-hosting |
| Scope creep (el proyecto es grande) | Alto | Fases con criterio de salida (roadmap.md); no-objetivos explícitos (§6.2) |
| El pipeline de "posiciones tranquilas" genera falsos positivos | Medio | Umbrales conservadores + validación con motor a mayor profundidad + reporte de usuario |
| El conjunto no está validado empíricamente | — | Honestidad estructural: E12 mide; el producto no promete lo que no puede probar |

## 12. Trazabilidad requisito → evidencia

| Decisión de producto | Base (en `docs/evidence/`) |
|---|---|
| Prescripción, no buffet (E11) | Dificultades deseables; desempeño ≠ aprendizaje (Soderstrom & Bjork) |
| Radar sin etiquetas (E5) | Defecto estructural del puzzle; disparador de decisión |
| Doble solución y candidatas (RF-5.7/5.8) | Efecto Einstellung (Bilalić, McLeod & Gobet) |
| Cola Universal FSRS (E4) | Repetición espaciada + práctica de recuperación (Cepeda; Rowland) |
| Motivos intercalados (RF-6.1) | Práctica intercalada, discriminación (Pan et al.) |
| Producción libre, nunca opción múltiple (RF-4.3) | Recuperación por producción > reconocimiento |
| Análisis en dos fases (E3) | Consenso experto fuerte; preservar el pensamiento propio |
| Maia como oponente/defensora (E1/E8) | Errores humano-plausibles (McIlroy-Young et al.) |
| Métricas independientes del entrenamiento (E12) | Sobreajuste al instrumento; informe de investigación §medición |
| Banda de fallo 20–40% (RF-5.5) | Dificultad deseable (Bjork) |

## 13. Glosario

**Elo/rating**: escala de fuerza de juego. **FEN**: notación de una posición. **PGN**: notación de una partida completa. **FSRS**: algoritmo moderno de repetición espaciada (Free Spaced Repetition Scheduler). **Centipeón**: centésima de peón, unidad de evaluación del motor. **Ply**: media jugada. **Einstellung**: sesgo por el cual la primera idea bloquea la búsqueda de mejores. **PWA**: aplicación web progresiva, instalable y usable sin conexión. **Tablebase**: base de datos de finales resueltos a la perfección.
