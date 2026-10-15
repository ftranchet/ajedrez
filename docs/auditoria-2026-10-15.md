# Auditoría de código y documentación — 2026-10-15

Revisión completa del repositorio (código de `src/`, `scripts/`, `e2e/`, CI y toda la documentación) buscando bugs, errores, duplicaciones, incoherencias, contradicciones, optimizaciones, simplificaciones y eliminaciones. **No se cambió código**: este documento propone, y cada hallazgo trae dónde está, cómo se verificó y qué cambio se sugiere.

## Línea base

| Chequeo | Resultado |
|---|---|
| `npm run lint` | ✅ sin errores |
| `npm run typecheck` | ✅ sin errores |
| `npm test` (Vitest) | ✅ 74 archivos, 837 tests |
| `npm run e2e` (Playwright, build de producción, base `/`) | ✅ 53 tests |
| `npm run build` | ✅ — un único chunk JS de 803 kB (235 kB gzip), precache PWA de 8,7 MB |
| `npm audit --omit=dev` | ✅ 0 vulnerabilidades en producción |
| `npm audit` (incluye dev) | ⚠️ 9 (4 moderadas, 5 altas), todas en herramientas de desarrollo |

El proyecto está en buen estado estructural: el dominio (`core/`) es puro y está muy testeado, las migraciones tienen tests y comparten código con la restauración de respaldos, y la documentación es inusualmente honesta sobre sus límites. Los problemas se concentran en tres lugares: **las fronteras entre módulos** (notación, fechas locales, el tope diario de tarjetas), **la documentación que no acompañó los últimos cambios**, y **duplicación estructural** en exportación/importación y en el esquema de Dexie.

## Estado

**Etapa 1 resuelta** (rama `claude/code-docs-audit-ea8fs2`): B1, B2, B3, B4, B7, B8, B9, B10 y B17, cada uno con su test de regresión comprobado contra el código sin arreglar; T1, T2, T3, T5, T6, T7, T8 y T10; D23, y de D22 la copia de `CP_MATE` y el JSDoc de `validateImportBundle`. Decisión de B2 en ADR-0017. Una revisión adversarial del conjunto encontró 17 problemas más en los propios arreglos, todos corregidos en la misma etapa. Los dos de más peso cambiaron el diseño:

- **El modo a ciegas se mide por patrón.** Con el acierto bien medido por posición, RF-6.5 quedaba inalcanzable: una posición deja de servirse al automatizarse (RF-6.3), así que mientras se sirve nunca supera el 80% con tres intentos o más. Se mide sumando las posiciones del mismo patrón, que es lo que dice RF-6.5 (PRD actualizado). Un patrón de una sola posición (hoy, "descubierta") no lo activa.
- **El día de entrada de una tarjeta diferida queda fijo** (`ErrorCard.entraEn`): deducirlo del vencimiento hacía que el mismo error entrara hoy o en tres días según el orden en que el usuario repasaba y analizaba.

Validación al cerrar la etapa: lint, typecheck, 982 tests unitarios (en UTC, UTC+14 y UTC−11) y 53 E2E con las dos bases de despliegue.

**Hallazgos nuevos durante la etapa 1**, para las etapas siguientes:

- **N1.** `FeedbackPanel` muestra "Línea completa: 4.Dxf7#" en vez de "Jugada correcta" para soluciones de una sola jugada: `hayLinea` compara la línea (con número de jugada) contra la jugada suelta y nunca son iguales.
- **N2.** `sanDeJugada` (`ui/state/chessBoardUtils.ts`) cae a UCI si la jugada no es legal en la posición: caso degenerado, pero rompe RNF-9.
- **N3.** `EvalGraph` ubica los marcadores de error en `(i + 1) / puntos.length` y la curva en `i / (puntos.length − 1)`: los puntos quedan corridos respecto de la curva. Su `aria-label` está escrito a mano aunque existe la clave de i18n.
- **N4.** `conversion.perdidaTexto` dice "la ventaja bajó de la mitad de lo que tenías", pero `evaluarConversion` compara contra 1,5 peones fijos (la mitad de `VENTAJA_GANADORA_CP`), no contra la mitad del pico.
- **N5.** El hito "Juicio calibrado" mide calibración en promedio, no resolución: quien declara siempre 70 en la banda 60–80% lo obtiene. El texto ya dice solo lo que mide; un criterio más fuerte (por ejemplo, que la confianza media en los aciertos supere a la de los fallos) queda como opción. Con 15 registros la brecha tiene mucho ruido: subir el mínimo a 30 bajaría los falsos positivos.
- **N6.** El porqué de los bloques congelados en el plan del día se calcula con la dieta de este momento, no con la de cuando se armó el plan: si el motivo cambia durante el día, el texto dice el motivo actual (es cierto, pero puede no ser el que sumó el bloque). Arreglarlo exige guardar el motivo en `DailyAssignment`.

**Cómo se verificaron los bugs.** Los marcados *verificado* se reprodujeron con un test temporal (no incluido en el repo) o con un script sobre el catálogo real. Los marcados *por inspección* surgen de leer el código y, en el caso de Lichess, de la documentación pública de su API: no se pueden ejercitar desde este entorno.

---

## 1. Bugs

### Prioridad 1 — enseñan algo falso o pierden datos

**B1. El Radar y el diagnóstico muestran las jugadas en notación inglesa aunque la preferencia sea español (RNF-9).** *Verificado.*
`core/radarExplicacion.ts` (`formatearLinea`, `explicarPosicion`, `lineaParaMostrar`) arma la línea y el texto con el SAN que emite chess.js, que es inglés, y nunca recibe el idioma. Con la preferencia por defecto (español), `lichess-0000D` se muestra como `27...Rd8 28.Qxd8+ Bxd8`, mientras el mismo panel dice "Jugada correcta: Td8" (esa sí pasa por `aNotacion`). En español **"Rd8" significa rey a d8**: la línea afirma una jugada que no es la que se jugó. Lo mismo vale para `carnada.san` y `refutacionSan`, que viajan en el catálogo en SAN inglés. Además `feedbackConformismo` (`core/dobleSolucion.ts:22`) muestra la jugada superior en **UCI** (`e2e4`), que RNF-9 prohíbe en pantalla. Los tests de `radarExplicacion.test.ts` fijan el comportamiento equivocado (esperan `Bh3`, `Nxe7`, `Qxc6`), y el CHANGELOG del 2026-08-03 afirma que la notación elegida "alcanza a todo lo que muestra jugadas", Radar y diagnóstico incluidos.
*Propuesta:* pasar `IdiomaNotacion` a `explicarPosicion`/`lineaParaMostrar` (o traducir cada SAN con `aNotacion` antes de componer), traducir `carnada.san`/`refutacionSan` al mostrar, usar `sanDeJugada` en `feedbackConformismo` y actualizar los tests para que fijen el español.

**B2. Pasado el tope diario, confirmar un error del análisis lo descarta en silencio.** *Por inspección, determinista.*
`altaErrorCard` devuelve `omitir` cuando ya se crearon 10 tarjetas hoy, y `ui/state/analysisStore.ts:308-312` igual cuenta la confirmación como hecha. En un análisis exprés de un lote (RF-3.5) es fácil pasar de 10 errores: los siguientes se "confirman" y se pierden, y como la partida queda `analizada: true` no se vuelven a ofrecer nunca. El mismo descarte ocurre en `diagnosticoStore.ts:438`, `finalesStore.ts:149` y `sessionStore.ts:1198`. Además el tope cuenta tarjetas de **cualquier** origen: diez fallos del Radar a la mañana bloquean los errores de la partida que se analiza a la noche, que son justamente las tarjetas de las que dependen la fuga táctica (RF-11.2), el reciclaje (RF-5.9) y los errores graves (RF-12.1).
*Propuesta:* el tope de RF-4.5 tiene que limitar cuántas tarjetas nuevas **entran a repaso** por día, no cuántas se **crean** (el criterio de Anki). Crear siempre la tarjeta y diferir su `fsrs.due` al primer día con cupo; como mínimo, avisar en pantalla y no contar la omisión como confirmación. RF-4.5 además pide que el tope sea configurable y no hay dónde configurarlo.

**B3. El tope diario de tarjetas usa el día UTC, no el local.** *Verificado.*
`core/errorCard.ts:63-65` compara `toISOString().slice(0, 10)`. En Buenos Aires (UTC−3) el "día" se reinicia a las 21:00: una tarjeta creada a las 12:00 locales ya no cuenta a las 22:30 del mismo día. El resto de la app usa día local (`dailyAssignmentId`, `localDayIndex`, `startOfLocalWeek`).
*Propuesta:* usar la clave de día local que ya existe (ver S3). Mismo problema, menor, en el encabezado `Date` del PGN (`gameStore.ts:95`) y en el nombre del archivo exportado (`DataBackupCard.tsx:28`).

**B4. El modo a ciegas se activa después de fallar.** *Verificado.*
`nivelCiegas` (`core/curriculum.ts:94-96`) estima el acierto como `(reps − lapses) / reps`, pero ts-fsrs solo cuenta un *lapse* cuando una tarjeta en estado *review* se falla: los fallos en aprendizaje no suman. Tres fallos seguidos desde un patrón nuevo dejan `reps = 3, lapses = 0`, "100% de acierto", y el patrón pasa a piezas fantasma — la dificultad sube justo cuando el usuario demostró que no lo sabe (RF-6.5 pide lo contrario). `finalesPrioridad.ts` usa el mismo cociente para `tasaFallo` y lo subestima por la misma razón (el comentario lo reconoce, pero la tasa se muestra igual).
*Propuesta:* basar `nivelCiegas` en `demostracionesLimpias` (que sí se resetea con cada fallo) o llevar un contador propio de aciertos/intentos en `CurriculumProgress` (campo opcional, migración aditiva).

**B5. En el cálculo con una posición propia, la "profundidad vista" nunca pasa de 1.** *Por inspección, determinista.*
Cuando la posición sale de una partida analizada —el camino principal en cuanto hay alguna—, `stoykoStore.ts:327` arma la referencia con `lineaMotor: [evaluacion.move]`: `EnginePort.evaluate` devuelve solo la mejor jugada, no la variante principal. `evaluarAbierto` compara la rama del usuario contra una línea de un ply, así que una de las tres varas del ejercicio (ADR-0015) queda en 0 o 1 por construcción.
*Propuesta:* exponer la PV en `EngineEvaluation` (el adaptador ya recibe la línea `pv` completa y hoy solo guarda el primer ply) y usar sus primeros plies como referencia, igual que `mejorLinea` del catálogo.

**B6. El cálculo de la semana repite la misma posición propia todas las semanas.** *Verificado.*
`posicionPropiaParaCalculo` (`core/calculoPosicion.ts:63`) es determinista y no excluye las posiciones ya usadas (`CalculoAttempt.origen` guarda `gameId` y `ply`): hasta que se analice otra partida con un error mayor, el ejercicio semanal y la práctica libre sirven exactamente la misma posición, ya con la respuesta vista.
*Propuesta:* excluir las `(gameId, ply)` ya usadas y caer a la siguiente candidata o al catálogo.

**B7. Una ventaja con mate se muestra como "+1000,0".** *Por inspección, determinista.*
El mate se codifica como ±100.000 cp. `computeCpLoss` lo acota (fix v19), pero `lecturaMomentoCritico` (`core/analysis.ts:227`) y `posicionPropiaParaCalculo` devuelven `ventajaAntes/Despues` sin acotar, y `formatVentaja` los imprime tal cual: "tu ventaja pasó de +1000,0 a +5,0 — te costó 20,0 peones". Es el mismo número imposible que el CHANGELOG de 2026-08-03 dice haber corregido, en otro lugar, y es frecuente: el error más caro de una partida suele ser un mate desperdiciado.
*Propuesta:* que `formatVentaja` muestre "mate" (o `#`) a partir de `CP_TOPE`, o acotar en el dominio; test de regresión con un análisis que pierde un mate.

**B8. El hito "juicio calibrado" es inalcanzable para quien está bien calibrado.** *Verificado.*
`core/milestones.ts:47,113` exige Brier ≤ 0,18. RF-10.3 y `brechaCalibracion` explican por qué Brier no sirve como titular: el Radar sostiene el acierto en 70% a propósito, y alguien perfectamente calibrado que declara 70% saca 0,21. Con 30 registros de brecha 0 (calibración perfecta) el hito no aparece.
*Propuesta:* usar la brecha (por ejemplo ≤ 10 puntos con ≥ 15 registros), coherente con el titular del Panel.

**B9. El "porqué" del bloque de criterio puede ser falso.** *Por inspección, determinista.*
Desde ADR-0016 el bloque "¿Calcular o ya alcanza?" se activa por fuga táctica **o** por fuga de cálculo (`dietaPorBanda`), pero Hoy siempre dice "Tus errores recientes de partida son sobre todo tácticos" (`HoyScreen.tsx:216,258`; `i18n/es.ts:264`). Con la fuga de cálculo como único disparador, el texto afirma algo que no pasó: contradice el principio 8 y RF-11.3. El texto del informe del Panel (`triageInformeSinDatos`) también omite el segundo disparador.
*Propuesta:* que `DietaSesion` exponga el motivo (`'tactica' | 'calculo' | 'ambas'`) y que la UI elija el texto.

**B10. Restaurar un respaldo con un registro mal formado termina en una excepción sin mensaje.** *Verificado.*
`validateImportBundle` valida registro por registro solo partidas, tarjetas, calibración, sesiones, transferencia, n=1, planes y tiempos; del resto (`radarAttempts`, `radarProgress`, `curriculumProgress`, `calculoAttempts`, `triageAttempts`, `candidataAttempts`, `dobleSolucionAttempts`, `compromisoAttempts`, `stoykoAttempts`) solo mira que sean arrays. Un intento sin `id` hace fallar el `bulkPut` con `DataError`: `importAllData` **lanza** en vez de devolver `{ ok: false }`, y `DataBackupCard.tsx:37-65` no tiene `catch`, así que el usuario no ve ningún mensaje. Los datos locales quedan intactos (la transacción se revierte), pero la UI no lo dice. `handleExport` (`DataBackupCard.tsx:18-35`) y la importación de PGN (`PanelScreen.tsx:1161`) tienen el mismo `try/finally` sin `catch`.
*Propuesta:* validar al menos `id: string` en todas las tablas y los enums críticos (`categoria`, `origen`, `fsrs.state`, que hoy puede llegar a `indexOf → -1`); envolver `importAllData` en `try/catch` y devolver `{ ok: false }`; agregar `catch` con mensaje en los tres handlers.

### Prioridad 2 — robustez y coherencia

**B11. Maia puede tomar como suya una partida que no es la del desafío, o quedarse esperando para siempre.** *Por inspección y documentación de la API.*
`lichessClient.ts:107-131` abre `/api/stream/event` y toma el **primer** `gameStart`. Lichess emite al conectarse un `gameStart` por cada partida en curso del usuario: con una partida por correspondencia abierta, la app "juega" esa. Si el bot rechaza el desafío (`challengeDeclined`) la pantalla queda en "desafiando" sin límite de tiempo, y si el `POST` del desafío falla, el stream de eventos queda abierto hasta que se aborte.
*Propuesta:* leer el `id` del desafío de la respuesta del `POST` y esperar el `gameStart` con ese id; tratar `challengeDeclined`/`challengeCanceled` como `bot-no-disponible`; timeout; cancelar el body del stream en los caminos de error. Test con `fetch` y `ReadableStream` simulados.

**B12. Un error transitorio al mandar una jugada saca al usuario de la partida contra Maia.** *Por inspección.*
`maiaStore.ts:227` pasa a `phase: 'error'` ante cualquier fallo de `enviarJugada` (un 429, un corte de red) y `JugarScreen.tsx:692` muestra la configuración, aunque la partida sigue en Lichess con el reloj de 30+20 corriendo y el stream la sigue actualizando en memoria.
*Propuesta:* reintentar con espera y mantener `jugando` con un aviso; pasar a error solo ante fallos definitivos (401/403/404).

**B13. La Cola es más estricta que el Radar sobre la misma posición.** *Por inspección.*
Una tarjeta nacida de un fallo del Radar guarda solo `solucion[0]` (`sessionStore.ts:1194`) y el repaso exige igualdad exacta (`sessionStore.ts:966`). En una tranquila, jugar en el repaso una de las `jugadasAceptables` que el Radar acepta cuenta como fallo y reinicia el FSRS; en doble solución, la familiar también. Lo mismo con las tarjetas de finales (K+D contra K tiene muchas jugadas ganadoras).
*Propuesta:* guardar las alternativas aceptables en la tarjeta (campo opcional, migración aditiva) y aceptarlas en `colaUserMove`.

**B14. Importar el mismo PGN dos veces duplica la partida, y un PGN con varias partidas se rechaza como "inválido".** *Verificado (multi-partida).*
`ImportarPartidaSection` (`PanelScreen.tsx:1161`) no deduplica: la partida duplicada cuenta doble en errores graves, sobreajuste, partida lenta semanal y finales de tus partidas. `parsePastedPgn` rechaza un PGN de dos partidas con el error `invalido`, que dice algo falso (es un PGN válido; lo que no se soporta es más de una partida).
*Propuesta:* deduplicar por un hash del PGN normalizado (sin comentarios ni espacios); detectar varias partidas y ofrecer importarlas todas o pedir una sola con un mensaje propio. De paso: prellenar el ritmo con el `TimeControl` del encabezado y leer `[%clk]`, que llenaría `tiemposPorJugadaMs` (ver D21).

**B15. Una partida local se pierde entera si el motor falla a mitad.** *Por inspección.*
Ante `engineError` en una partida libre, `JugarScreen.tsx:144-150` solo ofrece "Nueva partida". El adaptador ya rebootea el worker en la consulta siguiente, así que un "Reintentar" que vuelva a pedir la jugada del motor alcanza. En finales pasa lo mismo (`JugarScreen.tsx:500-505`).

**B16. `sessionRepo.abandonInProgress` cierra sesiones con la hora actual y sin registrar su tiempo.** *Por inspección.*
`sessionRepo.ts:12-20` usa `abandonSessionRecord(record, now)`: una sesión colgada desde ayer queda con `duracionMs` de horas, y no se escribe su tramo en `trainingEvents`. `loadSummary` ya hace esto bien con `cerrarSesionColgada` (corta en el último instante observado) y `registrarTiempoEntrenado`.
*Propuesta:* reutilizar `cerrarSesionColgada` y registrar el tramo.

### Prioridad 3 — menores

- **B17.** `esEsquemaMigrable(17.5)` devuelve `true` (*verificado*); el comentario de `validateImportBundle` dice que un esquema fraccional se rechaza. Agregar `Number.isInteger`.
- **B18.** `URL.revokeObjectURL` inmediatamente después de `a.click()` (`DataBackupCard.tsx:30`) puede cancelar la descarga en algunos navegadores; diferirlo con un `setTimeout`.
- **B19.** `inicioMs` es una variable de módulo en `maiaStore.ts:60`, fuera de la fábrica `createMaiaStore`: dos instancias (tests) la comparten.
- **B20.** `stoykoStore` guarda `stoykoUltimaCompletadaEn` con `profileRepo.get()` + `save()`; `profileRepo.update()` existe justamente para que dos escrituras cercanas no se pisen.
- **B21.** El chequeo anti zip-bomb (`exportImport.ts:185-190`) mide el tamaño **después** de descomprimir todo en memoria. fflate permite rechazar por `originalSize` antes de inflar (opción `filter` de `unzipSync`), y conviene ignorar entradas que no sean las esperadas.
- **B22.** Riesgo latente: la sesión (Cola, patrones, Radar) y la batería de transferencia coronan siempre a dama (`sessionStore.ts:960-963`, sin `PromotionDialog`). Hoy ningún ítem del catálogo pide subpromoción (*verificado* sobre los 141 + 30 + 36), pero `scripts/add-lichess-puzzles.mjs` no filtra el tema `underPromotion` —que `radarExplicacion` incluso nombra—: el día que entre uno, será imposible de resolver.

---

## 2. Documentación: contradicciones e inconsistencias

**D1. README desactualizado sobre lo pendiente.** Dice "Quedan pendientes tres entregables… los bots Maia, la importación automática de historial y la conversión de ventajas"; el roadmap marca Maia como ✅ construida (Ronda B) y la conversión como ✅ con motor local. Solo la importación automática sigue pendiente.

**D2. Roadmap con cifras viejas.** Fase 1: "catálogo `radar-009a3563237b` con 128 posiciones" (el vigente es `radar-61d47692ce33` con 141); Fase 3: "biblioteca inicial de 8 posiciones (una por patrón)" (son 20); "Sigue pendiente… Con 128 posiciones se repite a los 2–4 días". El README sí tiene las cifras correctas (141/20/16/8/30), así que los dos documentos se contradicen.

**D3. El roadmap se contradice sobre Maia.** Fase 2 la marca "⬜️ bloqueado" y la sección de la auditoría 2026-07-25 la lista como "Sigue pendiente", mientras la tercera tanda la declara "✅ construida".

**D4. El roadmap se contradice sobre la conversión.** El estado de Fase 4 dice "solo la conversión de ventajas (E8, P1) queda pendiente por bloqueo de red"; el entregable de la misma fase dice "✅ con motor local".

**D5. El roadmap describe un Cálculo que ya no existe.** Fase 4 dice "Acierto = tener la mejor jugada del motor entre las candidatas", habla de `stoykoAttempts` y de que el tiempo "nunca se muestra". Desde ADR-0015/0016 son tres varas que no se promedian, la tabla es `calculoAttempts`, y PRD RF-7.3 dice que el tiempo **se muestra después** en el Panel (y así está implementado).

**D6. El roadmap da por no empezados RF-11.5 y RF-11.7**, que están implementados (bloque suelto con "Practicar de nuevo"; compromiso semanal de partida lenta en `core/slowGame.ts`). Fase 3 también describe un "Panel de verdad v1" con la banda de Elo que RF-12.1b sacó del panel.

**D7. PRD RF-7.1 contra RNF-9.** RF-7.1 dice que las jugadas se escriben "en **notación algebraica española**"; RNF-9 dice que el idioma es una preferencia. Gana RNF-9 (es lo implementado).

**D8. PRD RF-11.8 contra el design system.** RF-11.8 pide "pulso de velo bajo el rey al fallar"; `design-system.md` §3.3 y el CHANGELOG del 2026-08-02 lo eliminaron por leerse como un jaque.

**D9. PRD RF-1.4b contra la implementación de Maia.** RF-1.4b exige que "una jugada propia no se muestra hasta que Lichess la confirma"; `maiaStore.ts:202` la aplica de forma optimista y lo justifica en un comentario. Es un desvío legítimo, pero CONTRIBUTING (regla 6) pide actualizar el PRD en el mismo cambio, y no se hizo.

**D10. PRD RNF-3 promete lo que no hay.** "Usa multihilo (SharedArrayBuffer) cuando el hosting sirve COOP/COEP" — `copy-engine.mjs` copia siempre el build `lite-single`, y GitHub Pages no sirve esas cabeceras. "Módulos cargados perezosamente por épica" — el bundle es un único chunk de 803 kB (ver O1).

**D11. Detalles del PRD.** §9 nombra "chessops/chess.js" (solo se usa chess.js). La cabecera dice versión 0.3.1 del 2026-07-25, con decenas de cambios posteriores (RNF-9 elegible, RNF-10, RF-5.10, ADR-0015/0016). El orden de los sub-requisitos está alterado (RF-5.3d antes de 5.3c; RF-12.1b antes de 12.1a). §10 no lista `radar-dataset.md`, `niveles-motor.md`, `maia-prueba.md` ni `adherencia-gamificacion.md`.

**D12. RF-6.2b no existe.** El CHANGELOG del 2026-08-04, `core/finalesPrioridad.ts:1` y `core/finalesEnPartidas.ts:1` citan RF-6.2b (orden de los finales); el PRD termina en RF-6.2a. Falta agregarlo al PRD.

**D13. Versionado.** CHANGELOG y PRD §10 dicen "`x` sube al completar una fase"; con cinco fases cerradas, `package.json` sigue en `0.0.1` y todo lo hecho desde el 2026-07-16 está bajo `[Sin publicar]`, en ~40 subsecciones fechadas (varias repetidas el mismo día). O se publica una versión, o se ajusta la política escrita.

**D14. CONTRIBUTING desactualizado.** Describe la CI como "lint + typecheck + test + verificación de finales + build" y omite `verify:patrones`, que sí corre. La lista de comandos no incluye `verify:patrones`, `measure:*`, `build:*` ni `add:puzzles`. Pide "Node 20+", igual que `package.json` (`>=20`), pero Vite 8, ESLint 10 y `@vitejs/plugin-react` 6 exigen `^20.19` o `>=22.12`.

**D15. E14 incompleta sin decirlo.** RF-14.3 (CSV de tarjetas y calibración, P1) y RF-14.4 (recordatorio de respaldo, P1) no están implementados; RF-14.5 (documentar el formato de exportación, P2) tampoco. El roadmap solo lista 14.1/14.2 como ✅, `exportImport.ts` cita "RF-14.3/14.5" como si estuvieran cubiertos, y el README dice que los datos "se exportan enteros en formatos abiertos" (cierto para JSON + PGN, no para lo que pide 14.3).

**D16. RF-13.3 marcado ✅ pero no funciona en ningún navegador estable.** `services/notifications/reminder.ts` depende de `TimestampTrigger` (Notification Triggers), que nunca salió de prueba de origen. La interfaz lo dice con honestidad, pero el roadmap lo da por entregado. *Propuesta:* exportar un evento `.ics` recurrente (funciona en cualquier dispositivo y es local-first) y dejar Notification Triggers como mejora progresiva.

**D17. RF-4.5 pide un tope configurable**; `TOPE_DIARIO_NUEVAS` es una constante y no hay ajuste en la UI.

**D18. 'Rápida' es a la vez "lenta" y "exprés".** `slowGame.ts:11` cuenta `rapida` para el compromiso semanal de partida lenta, y `admiteAnalisisExpres` (`analysis.ts:120`) la admite para el análisis exprés sin fase 1. Resultado: una rápida importada y analizada en exprés da por **completa** la partida lenta de la semana, contra RF-3.5 ("el análisis en dos fases completo se reserva para partidas lentas"). Además el exprés admite bullet, que RF-2.4 declara ruido.

**D19. "Errores graves" cuenta grave + error.** `erroresGravesUsuario` (`panel.ts`) suma las dos clasificaciones; PRD §3.2 y RF-12.1 hablan de "errores graves". Decidir el nombre o la definición, y decirlo igual en pantalla.

**D20. Pregunta pedagógica: ¿una oferta genuina no pide cálculo?** `core/triage.ts` marca `genuina` como "alcanza con una jugada sólida". Pero distinguir una oferta genuina de una envenenada **es** calcular: es la premisa del Radar (RF-5.1). Conviene que lo decida el dueño de producto y quede escrito.

**D21. "Donde consumiste más tiempo" es código muerto.** `calculoPosicion.ts` cae a la jugada con más tiempo cuando no hay errores grandes, y RF-7.2 y el CHANGELOG lo prometen, pero `tiemposPorJugadaMs` se guarda vacío en las tres fuentes (partida local, Maia y PGN importado). O se implementa leyendo `[%clk]` de los PGN importados, o se retira de PRD y código.

**D22. Comentarios que describen código que ya no existe.**

| Dónde | Qué dice | Qué es hoy |
|---|---|---|
| `core/types.ts:41`, `core/game.ts:29` | `jugadorColor` sirve al "perfil de gestión de tiempo (RF-9.1)" | RF-9.1 se retiró |
| `core/types.ts:277-285` | JSDoc de "Cálculo comprometido" huérfano: queda pegado a `PresetCalculoPersistido` | dos bloques de doc sueltos |
| `core/types.ts:518` | la banda "coincide con los 5 niveles del motor" | son 8 niveles |
| `core/types.ts:547` | JSDoc del `Profile` pegado a `FuenteRating` | `Profile` queda sin doc |
| `core/slowGame.ts:13-24`, `HoyScreen.tsx:172-177` | dos JSDoc seguidos; el primero queda huérfano | ídem |
| `core/game.ts:53-58` | `tiemposPorJugadaMs` "tiene datos para partidas jugadas localmente" | siempre vacío |
| `core/ports.ts:63` | `evaluate`: "sin Skill Level limitado" | se usa `UCI_LimitStrength` |
| `core/panel.ts:1-6` | "se muestra la banda de Elo… en vez de inventar un número" | se muestra el rating declarado; la banda salió del panel |
| `core/prescripcionesExternas.ts:1-18, 96-105`, `sessionStore.ts:92-97` | "línea comprometida", "cálculo comprometido" | retirados por ADR-0016 |
| `core/prescripcionesExternas.ts` (`FINALES_POR_DIA`) | "8 técnicas no vistas" | 16 |
| `ui/state/stoykoStore.ts:1-17` | "El estado del corto vive en `compromisoStore`" | ese store se eliminó |
| `core/calculoSummary.ts:1-8` | "un solo ejercicio con dos presets" | un preset vivo y uno histórico |
| `core/exportData.ts:319-324` | "No migra todavía versiones anteriores" | existe `core/importMigrations.ts` |
| `core/importMigrations.ts:137` | "`desde` es la versión que produce" | el campo se llama `version` |
| `core/radar.ts`, `core/radarExplicacion.ts:3-4` | "las 116 posiciones" | 141 |
| `config/engine-levels.json` (`medicion`) | "los escalones intermedios se interpolan" | los niveles 1 y 8 se **extrapolan** (temperaturas 230 y 55, fuera de las anclas 210–60) |

**D23. Nombres retirados que se ven en pantalla.** Los mensajes de error de la restauración dicen "Triage" y "Stoyko" (`exportData.ts:382-386`), nombres que la interfaz ya no usa.

**D24. Textos de interfaz fuera de i18n.** CONTRIBUTING (regla 7) pide los textos en archivos de i18n; hay prosa visible en `core/radarExplicacion.ts`, `core/radar.ts`, `core/dobleSolucion.ts`, `core/exportData.ts`, `services/export/exportImport.ts`, el `aria-label` de `EvalGraph.tsx` y los nombres de días y meses de `HoyScreen.tsx:277-281`. Es también lo que hace difícil arreglar B1.

---

## 3. Duplicaciones y simplificaciones

**S1. Un registro de tablas para exportar, importar y borrar.** La lista de 18 tablas de usuario se repite a mano en al menos siete lugares: `ExportBundle`, `ExportSourceData`, `buildExportBundle`, `validateImportBundle`, `exportAllData` (lectura y archivos), `importAllData` (lectura, parseo y escritura) y `userDataTables`. Agregar una tabla obliga a tocarlos todos, y olvidar uno es pérdida silenciosa de datos en el respaldo. *Propuesta:* un registro único `{ nombre, tabla, validador }` del que salgan las siete; `ExportBundle = { manifest } & ExportSourceData`.

**S2. Esquema de Dexie.** Cada versión de `db.ts` repite el esquema entero (v1–v18). Dexie solo necesita las tablas que cambian, como ya hacen v19 y v20. Sin editar versiones publicadas: adoptar la forma corta de acá en adelante y documentarla en el encabezado.

**S3. Utilidades de fecha y estadística duplicadas.** `DAY_MS` definido en 6 módulos y `24 * 60 * 60 * 1000` en línea en otros 6; `startOfLocalWeek` duplicado idéntico en `adherence.ts` y `slowGame.ts`; tres claves de "día local" distintas (`localDayIndex`, `localDayKey`, `dailyAssignmentId`) más `inicioDelDia` en `curriculum.ts`; dos `median`. Un `core/fechas.ts` y un `core/estadistica.ts` eliminan la duplicación y habrían evitado B3.

**S4. El plan del día se arma en dos lugares.** `sessionStore.loadSummary` (líneas 687-702) y `start` (781-795) construyen el mismo plan con el mismo código. Extraer `armarPlanDelDia()`.

**S5. Dos estilos de repositorio.** La mayoría son clases con la base inyectable; `sessionRepo` y `dailyAssignmentRepo` son objetos atados al `db` global, lo que los hace más difíciles de testear. Además doce repos son casi idénticos (`list` ordenado + `put`): una fábrica genérica los reduce a una línea cada uno.

**S6. Indirecciones sin valor.** `explainFeedback` (`radar.ts`) solo llama a `explicarPosicion`; `calculoAttemptRepo.listPreset` lee todo y filtra aunque existe el índice `preset`.

**S7. Plan de retiro de las tablas viejas de cálculo.** `compromisoAttempts` y `stoykoAttempts` (tablas, repos, tipos, validación y exportación) se conservan "como respaldo" de la migración v18. Mientras existan, cada respaldo lleva el historial de cálculo dos veces. Un ADR que fije cuándo retirarlas cierra la deuda.

**S8. Promoción a dama repetida.** El mismo bloque "promoción a dama por defecto" está tres veces en `sessionStore.ts`; resolverlo una vez (o con el `PromotionDialog`, ver B22) elimina la copia.

---

## 4. Optimizaciones

**O1. Code splitting.** Un solo chunk de 803 kB. `React.lazy` por pantalla (Panel tiene 1255 líneas, Jugar 805, Diagnóstico 601, más N=1 y Transferencia) y carga dinámica de los catálogos semilla (`seedData.ts`, 60 kB de fuente) bajan la carga inicial y cumplen RNF-3.

**O2. Precache de fuentes.** El precache de la PWA incluye 23 archivos `.woff2` (740 kB). El navegador solo descarga los subconjuntos que usa (por `unicode-range`), pero el service worker los precachea todos: cirílico y vietnamita (122 kB) no se usan nunca, y latín extendido (234 kB) tampoco en una interfaz en español —las tildes, la ñ, `±` y el menos tipográfico están en el subconjunto latino—. Excluirlos con `workbox.globIgnores` o importar solo los subconjuntos latinos ahorra ~356 kB por instalación.

**O3. Hash del motor.** `stockfishEngine.ts:153` manda `ucinewgame` antes de **cada** búsqueda, lo que vacía la tabla de transposición. En el análisis de una partida —40–80 posiciones consecutivas— conservarla acelera bastante. Mandarlo solo al empezar una partida o un análisis. De paso, ignorar las líneas `info` con `lowerbound`/`upperbound`, que hoy pueden pisar la evaluación exacta.

**O4. Releer PGN en cada visita a Hoy.** `partidaLentaSemanal` llama a `plyCountFromPgn` (parseo completo) por partida, y Finales reproduce hasta 40 partidas × 40 posiciones. Guardar la cantidad de plies (y, si se quiere, la estructura final) en el `GameRecord` al guardarlo evita el trabajo repetido.

**O5. Exportación consistente.** `exportAllData` lee las 18 tablas en secuencia y fuera de una transacción: una escritura concurrente puede dejar un respaldo inconsistente. Una transacción de solo lectura con `Promise.all` es más rápida y da una foto coherente.

---

## 5. Seguridad

**Sec1. Dependencias de desarrollo.** `npm audit` reporta 9 vulnerabilidades, todas en tooling (vitest/@vitest/mocker, brace-expansion, browserslist, fast-uri, nanoid, postcss, baseline-browser-mapping). Ninguna llega al bundle, pero `npm audit fix` las resuelve sin cambios mayores.

**Sec2. CI y despliegue.** `deploy-pages.yml` publica en cada push a `main` sin correr lint ni tests: si la protección de rama falla o se pushea directo, se despliega una versión rota. Encadenar el deploy a la CI (`workflow_run`) o correr los chequeos en el mismo job. `ci.yml` no declara `permissions:` (conviene `contents: read`), las acciones están fijadas por tag y no por SHA, y `push: ['**']` más `pull_request` corre todo dos veces en cada PR.

**Sec3. Política de contenido (CSP).** El token de Lichess vive en `localStorage` (decisión correcta para un local-first, ADR-0014); el riesgo que queda es un XSS. No hay CSP: una `<meta http-equiv="Content-Security-Policy">` con `default-src 'self'`, `connect-src 'self' https://lichess.org`, `worker-src 'self'`, `img-src 'self' data:` y el hash del script de tema inline acota mucho el daño posible. GitHub Pages no permite cabeceras, pero sí la meta.

**Sec4. Validación de respaldos** (ver B10 y B21): validar por registro y por enumerado en todas las tablas, y rechazar por tamaño declarado antes de descomprimir.

**Sec5. Defensa en profundidad en el cliente de Lichess:** `encodeURIComponent` en los segmentos de ruta (`gameId`, `bot`, `uci`), aunque hoy ningún valor venga del usuario sin validar.

---

## 6. Robustez y experiencia

**R1. Sin `ErrorBoundary`.** Una excepción en cualquier render deja la app en blanco. Un límite de error en `App` con "Volver a Hoy" y "Exportar mis datos" protege lo más importante: que el usuario siempre pueda sacar sus datos.

**R2. Abrir Cálculo bloquea las actualizaciones de la PWA.** `pwaIdle` trata `analizando` como ocupado, y el store queda en esa fase apenas se abre la pestaña Cálculo, aunque no se haya escrito nada. Desde ese momento la versión nueva espera hasta cerrar la pestaña. Contar como ocupado solo si hay ramas o texto cargados.

**R3. Varias pestañas.** `start()` abandona las sesiones `en_curso` de cualquier pestaña, incluida otra que esté activa. Un `BroadcastChannel` o ignorar sesiones con actividad reciente lo evita.

**R4. Accesibilidad.** No hay reglas de lint de accesibilidad (`eslint-plugin-jsx-a11y`); los E2E cubren contraste y foco, pero no roles ni etiquetas. RNF-6 pide "navegación por teclado completa en escritorio (incluida entrada de jugadas en notación algebraica)"; hoy solo se escriben jugadas en Cálculo, y en el resto de los tableros (sesión, partida, finales) una jugada solo se puede hacer con mouse o con el dedo.

---

## 7. Tests que faltan

Cada bug de la sección 1 debería entrar con su test de regresión. Además:

| # | Test | Cubre |
|---|---|---|
| T1 | `explicarPosicion`/`lineaParaMostrar` en español usan R, D, T, A, C (y ajustar los tests que fijan inglés) | B1 |
| T2 | Correr la suite también con `TZ=America/Argentina/Buenos_Aires` (un segundo job de CI o `process.env.TZ` en un setup) | B3 y cualquier fecha futura |
| T3 | `nivelCiegas` después de fallos en aprendizaje | B4 |
| T4 | Cálculo con posición propia: profundidad > 1 con PV; no repite `(gameId, ply)` ya usados | B5, B6 |
| T5 | `formatVentaja` y la lectura del momento crítico con mate | B7 |
| T6 | `hitosLogrados` con un usuario calibrado al 70% | B8 |
| T7 | El porqué del bloque de criterio según su disparador | B9 |
| T8 | `importAllData` con un registro mal formado en cada tabla devuelve `{ ok: false }` | B10 |
| T9 | `lichessClient` con `fetch` y `ReadableStream` simulados: ignora `gameStart` ajenos, maneja `challengeDeclined`, cierra el stream ante errores | B11 |
| T10 | `analysisStore`: confirmar más de 10 errores en un día no pierde ninguno | B2 |
| T11 | `gameStore`: reintento tras error del motor | B15 |
| T12 | `transferStore`: el invariante de ADR-0009 (no revela soluciones ni crea tarjetas) hoy no tiene test unitario | ADR-0009 |
| T13 | `pwaIdle.estaOcioso` sobre la matriz de fases | R2 |
| T14 | **Coherencia de documentación** (`npm run verify:docs`): todo `RF-x.y` citado en código y CHANGELOG existe en el PRD; las cifras del README coinciden con los catálogos | D2, D12 y su recurrencia |

Módulos sin test propio: `lichessClient`, `notifications/reminder`, `gameStore`, `conversionStore`, `transferStore`, `pwaIdle`, `pwaUpdate`, `localNamespace`, `ensureSeededCatalog` y los repos de Dexie (cubiertos en parte por `db.test.ts` y `exportImport.test.ts`). Tampoco hay medición de cobertura: `@vitest/coverage-v8` como reporte (no como barrera) ayudaría a ver huecos.

---

## 8. Plan sugerido

1. **Primero lo que enseña mal o pierde datos (1–2 días):** B1, B2, B3, B4, B7, B8, B9 y B10, cada uno con su test. B2 merece un ADR corto porque cambia la semántica del tope diario.
2. **Después coherencia y robustez:** B5, B6, B11–B16, R1, y sincronizar la documentación (D1–D24) en un solo PR de docs: README, roadmap, PRD (con su versión y fecha), CONTRIBUTING.
3. **Por último, deuda estructural:** S1, S3, S4 y S5; O1, O2 y O3; Sec1–Sec3; y el chequeo automático de documentación (T14), que es lo que evita que esta auditoría haga falta de nuevo.
