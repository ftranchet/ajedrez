# PRD — ELOmax: entrenador de ajedrez basado en evidencia

| Campo | Valor |
|---|---|
| Documento | Documento de Requisitos de Producto (PRD) |
| Versión | 0.2.5 |
| Estado | Borrador para validación del dueño de producto |
| Dueño | Fran Tranchet |
| Última actualización | 2026-07-18 |
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
- **RF-1.4 (P0)** El usuario puede jugar partidas contra los bots Maia (maia1/maia5/maia9) a través de la interfaz de programación de Lichess, con su token personal (ver ADR-0004).
- **RF-1.5 (P0)** Toda partida jugada se persiste localmente con: PGN completo, tiempos por jugada, fuente, resultado y fecha.
- **RF-1.6 (P1)** Controles de partida: relojes configurables (mínimo: 15+10 y 30+0 predefinidos), rendirse, ofrecer tablas (contra bots: tablas automáticas por regla).
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
- **RF-3.5 (P2)** Modo "análisis exprés" para partidas rápidas importadas en lote: solo fase 2 automática con revisión de tarjetas candidatas (el análisis en dos fases completo se reserva para partidas lentas).

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
- **RF-5.2 (P0)** Flujo por posición: el usuario primero declara evaluación rápida (mejor blancas / igual / mejor negras), luego produce su jugada en el tablero.
- **RF-5.3 (P0)** El feedback explica el porqué **también cuando no había táctica** ("la captura era sana porque no existe la descubierta en…"). Sin esta explicación, las posiciones tranquilas frustran en lugar de enseñar.
- **RF-5.4 (P0)** Los fallos del Radar generan tarjetas para la Cola Universal.
- **RF-5.5 (P0)** Dificultad adaptativa: el selector mantiene la tasa de acierto del usuario en 60–80% (zona de fallo 20–40%) ajustando el rating de las posiciones servidas.
- **RF-5.6 (P1)** Fuentes de contenido: base de puzzles de Lichess (licencia CC0, ver ADR-0005) para tácticas y defensas; posiciones tranquilas generadas por pipeline propio: posiciones de partidas reales donde el motor confirma que ninguna jugada gana material ni cambia la evaluación en más de X centipeones (umbral configurable en el pipeline).
- **RF-5.7 (P1)** Subtipo anti-Einstellung: problemas de **doble solución** (una línea familiar que funciona, otra superior). Se puntúa encontrar la superior; el sistema registra la tasa de "conformismo con la primera idea" del usuario.
- **RF-5.8 (P1)** Regla de candidatas: en un subconjunto aleatorio de posiciones, tras la respuesta del usuario y antes de revelar, el sistema pregunta "¿hay algo mejor?" y permite cambiar la jugada. Se registra si el cambio mejora o empeora.
- **RF-5.9 (P1)** Posiciones provenientes de errores propios del usuario se reciclan dentro del Radar (integración con E4).

*Criterios de aceptación E5:* en una muestra de 100 posiciones servidas, ningún patrón trivial predice el tipo (p. ej., "las tranquilas nunca vienen después de dos tácticas"); la tasa de acierto de un usuario estable converge a la banda 60–80% en ≤50 posiciones.

### E6 — Currículo base: patrones y finales

- **RF-6.1 (P0)** Biblioteca de mates típicos y motivos tácticos organizada por patrón, servida con recuperación activa (resolver en el tablero) y **motivos intercalados** — el sistema nunca sirve bloques monotemáticos.
- **RF-6.2 (P0)** Biblioteca de finales teóricos elementales (rey y peón, torre básicos: Lucena, Philidor, oposición, regla del cuadrado) que se **juegan contra Stockfish** hasta demostrar la técnica (aquí la defensa perfecta del motor es deseable).
- **RF-6.3 (P0)** Cada patrón y final tiene estado en el planificador espaciado: reaparece con intervalos crecientes hasta automatización (3 demostraciones espaciadas sin error).
- **RF-6.4 (P1)** Verificación de finales contra tablebases vía interfaz de Lichess cuando hay conexión (sello de "jugada perfecta").
- **RF-6.5 (P2)** Modificador a ciegas progresivo (piezas fantasma → solo coordenadas) que se activa automáticamente sobre patrones con acierto >80% para mantener la dificultad deseable.

### E7 — Cálculo comprometido

- **RF-7.1 (P0)** Modo donde el usuario **ingresa su línea completa por adelantado** (su jugada, la respuesta esperada, su continuación; profundidad configurable 3–7 plies) antes de que el tablero se mueva. Se puntúa la línea entera, no solo la primera jugada.
- **RF-7.2 (P1)** Ejercicio de Stoyko semanal: una posición rica, sin reloj; el usuario registra todas las líneas candidatas con evaluación; al finalizar, comparación con el motor y registro para calibración (E10).
- **RF-7.3 (P2)** Sin cronómetro visible por defecto en este modo (el objetivo es profundidad); tiempo registrado en silencio para métricas.

### E8 — Conversión de ventajas

- **RF-8.1 (P1)** El sistema detecta en el historial del usuario posiciones ganadoras desperdiciadas (ventaja ≥ +3 que terminó en tablas o derrota) y las ofrece para rejugar **contra Maia** al nivel del usuario (defensa humano-realista, no Stockfish).
- **RF-8.2 (P2)** Variante con reloj corto (conversión bajo presión).
- **RF-8.3 (P2)** Fallback sin conexión/sin Lichess: motor local con fuerza limitada, señalando la limitación ("la resistencia del motor no es humana").

### E9 — Triage de reloj

- **RF-9.1 (P1)** El sistema construye el perfil de gestión de tiempo del usuario desde sus partidas (tiempos por jugada del PGN) e identifica sobregasto e infragasto por tipo de posición.
- **RF-9.2 (P1)** Ejercicio: dada una posición, decidir en pocos segundos "calcular en profundidad" o "jugada suficientemente buena ya". Feedback contra la evaluación: cuánto costaba la jugada rápida.
- **RF-9.3 (P2)** Informe mensual de fugas de tiempo integrado al panel (E11).

### E10 — Calibración del juicio

- **RF-10.1 (P0)** En ~1 de cada 4–5 respuestas (muestreo aleatorio, para no arruinar el flujo), el sistema pide confianza declarada (0–100) antes de revelar el resultado.
- **RF-10.2 (P0)** El sistema computa y persiste la puntuación de Brier acumulada, global y por contexto (Radar, evaluaciones de análisis, Stoyko).
- **RF-10.3 (P1)** Panel de calibración: curva de confianza declarada vs. tasa real de acierto, con lectura en lenguaje claro ("cuando decís 90%, acertás 70%: sobreconfianza en posiciones tácticas").

### E11 — Prescriptor y sesión diaria

- **RF-11.1 (P0)** La pantalla principal es **"Tu sesión de hoy"**: una secuencia de bloques con duración total visible (por defecto 25 min; mínima viable 15; configurable).
- **RF-11.2 (P0)** Composición de la sesión, en orden: (1) repasos vencidos de la Cola; (2) dieta base por banda de Elo (tabla versionada en configuración, no hardcodeada — ver §9); (3) ajuste por fugas del último mes (ejemplo: si >35% de derrotas son por reloj, sube Triage).
- **RF-11.3 (P0)** Cada bloque muestra su **porqué** en una línea ("Radar 12 min — tus errores graves en posiciones tranquilas duplican tu promedio").
- **RF-11.4 (P0)** Diagnóstico inicial: importación + análisis en lote (E2/E3 exprés) → banda de Elo y perfil de fugas → primera dieta. Sin historial: 2 partidas cortas contra Maia escalonada + 20 posiciones de Radar.
- **RF-11.5 (P1)** El usuario puede saltear un bloque (se registra) pero no reordenar la prioridad de la Cola.
- **RF-11.6 (P1)** Las reglas del Prescriptor viven en un archivo de configuración versionado (JSON) con su propio changelog: iterar la dieta no toca código.
- **RF-11.7 (P2)** Modo "partida lenta programada": el Prescriptor reserva bloques semanales para partidas completas + análisis (no todo es ejercicio).

### E12 — Panel de métricas y autoexperimento

- **RF-12.1 (P0)** Panel de verdad (grande, al frente): rating de partidas lentas, errores graves por partida (media móvil), calibración. Panel de actividad (chico, atrás): sesiones, minutos, volumen.
- **RF-12.2 (P1)** Batería de transferencia: set fijo de 30 posiciones nunca entrenadas, ofrecida cada 6–8 semanas, con resultados comparables entre tomas.
- **RF-12.3 (P1)** Detector de sobreajuste: si el rating interno de ejercicios sube durante 8 semanas sin que el rating de partidas acompañe, alerta explícita + rebalanceo sugerido de dieta hacia partidas y análisis.
- **RF-12.4 (P2)** Modo experimento n=1: registro de línea base, dosis por modalidad, y comparación entre bloques de énfasis distinto (diseño ABAB simple), con las advertencias metodológicas escritas en pantalla.

### E13 — Adherencia honesta

- **RF-13.1 (P1)** Rachas de **proceso** (sesiones completadas), nunca de resultado. Sin celebraciones por volumen.
- **RF-13.2 (P1)** Celebración atada a métricas de verdad ("tus errores graves bajaron 30% este mes").
- **RF-13.3 (P2)** Recordatorio diario opcional (notificación local de la PWA), configurable y apagado por defecto.

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
Instalable (manifest + service worker). Sin conexión funcionan: Radar, Cola, currículo, cálculo comprometido y análisis con motor local. Requieren conexión: bots Maia, importación, tablebases. El estado de conexión se comunica sin bloquear lo que sí funciona.

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
Navegación por teclado completa en escritorio (incluida entrada de jugadas en notación algebraica). Contraste AA. Piezas y resaltados distinguibles sin depender solo del color.

### RNF-7 — Idioma (P1)
Interfaz en español rioplatense desde el día uno; textos externalizados (i18n) para habilitar inglés después sin reescritura.

### RNF-8 — Licencia (P0)
El proyecto es de código abierto bajo **GPLv3** (formalizado en ADR-0006, coherente con la dependencia de Stockfish — ver ADR-0002). El texto oficial vive en `LICENSE` en la raíz del repositorio. Los datos de puzzles son CC0 con atribución de fuente en la documentación; los pesos de Maia son de investigación abierta; el set de piezas Staunty es CC BY-NC-SA 4.0 con atribución (ver `public/piece/staunty/README.md`).

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
| `Game` | id, pgn, fuente (local/lichess/chesscom/manual), ritmo, resultado, tiemposPorJugada, analizada (bool), fase1 (respuestas del usuario), fecha |
| `ErrorCard` | id, fen, ladoAMover, jugadaUsuario, jugadaCorrecta, categoría, origen, fsrs {due, stability, difficulty, reps, lapses}, historialRepasos |
| `RadarItem` | id, fen, tipo (ofensiva/defensa/tranquila/genuina/envenenada/dobleSolución), temas[], rating, fuente |
| `CurriculumItem` | id, tipo (patrón/final), contenido, fsrs, demostracionesLimpias |
| `CalibrationRecord` | id, contexto, confianzaDeclarada, acierto, fecha |
| `Session` | id, fecha, bloquesPrescritos[], bloquesCompletados[], duración |
| `Profile` | bandaElo, ratingsExternos, perfilDeFugas, config, versiónEsquema |
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
