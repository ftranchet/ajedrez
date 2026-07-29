# Dataset del Radar

Este documento describe cómo se genera el catálogo offline del Radar de ELOmax. Cumple RF-5.6 y la decisión de [ADR-0005](adr/0005-datos-puzzles-lichess.md): la aplicación no consulta puzzles durante una sesión; incorpora un lote versionado y funciona sin conexión.

## Lote publicado

El catálogo vigente contiene 141 posiciones: 80 puzzles del export oficial de Lichess, 20 tranquilas extraídas de partidas estándar reales y 41 generadas por autojuego (8 de doble solución y 33 de oferta envenenada). Todo el contenido no proveniente del export fue verificado con Stockfish 18. Tras reclasificar por evidencia del motor, la distribución semántica actual es 45 ofensivas, 20 defensivas, 20 tranquilas, 22 de oferta genuina y 34 de oferta envenenada.

Los exports de base de datos de Lichess son CC0 y su formato oficial explica que el FEN del puzzle es anterior a la jugada de armado; por eso el pipeline aplica la primera UCI antes de guardar la posición que ve el usuario. Fuente: [Lichess open database](https://database.lichess.org/).

## Subtipo doble solución (RF-5.7)

Sobre el lote base, el catálogo vigente agrega 8 posiciones con el subtipo anti-Einstellung (RF-5.7): una jugada "familiar" que también gana con claridad, pero es objetivamente peor que la superior. No se sacaron del export de puzzles de Lichess (curados justamente para tener una sola solución: minar ese catálogo con MultiPV de Stockfish, sobre 15 posiciones probadas, dio 0 candidatas) ni de partidas reales (sin acceso de red en este entorno de desarrollo — ver limitación documentada en `docs/roadmap.md`, Fase 2).

En su lugar, `scripts/mine-doble-solucion.mjs` genera posiciones por autojuego del motor local (profundidad 7, para variedad realista sin gastar tiempo de más) y criba cada una con MultiPV a profundidad 14 — mismo estándar que las tranquilas. Esa criba sola resultó insuficiente para esta afirmación más fina ("esta jugada específica es la segunda mejor", no solo "la mejor es buena"): la reconfirmación a profundidad 17, automatizada dentro del propio script, descarta cualquier candidata que no sostenga el margen o cambie de jugada "mejor"/"segunda mejor" a mayor profundidad.

**Corregido en la auditoría de 2026-07-18:** el primer lote (7 posiciones) no limitaba cuántas candidatas podía aportar una misma partida de autojuego, y 3 de las 7 terminaron viniendo de la misma partida — casi idénticas entre sí, mismo problema que ya se había encontrado y corregido para el catálogo de Stoyko semanal (más abajo). Este lote aplica el mismo tope (`MAX_POR_JUEGO = 1`, igual que `scripts/mine-stoyko.mjs`) y automatiza la reconfirmación a 17 dentro del script de minado (antes era un paso manual fuera de él, documentado acá pero no codificado). Las 8 posiciones resultantes vienen de 8 partidas de autojuego distintas. Ninguna tiene rating calibrado (no hay una comunidad detrás, a diferencia de los puzzles de Lichess): usan un valor fijo de 1500, documentado como simplificación v1.

Es un lote chico a propósito: la tasa de acierto de este método (~0.3–1% de las posiciones revisadas sostienen la afirmación a profundidad 17, y baja más todavía una vez aplicado el tope de 1 por partida) hace que sumar más sea una cuestión de tiempo de cómputo, no de otra técnica. Reproducible con:

```sh
node scripts/mine-doble-solucion.mjs --target 8 --max-checked 3000 --checkpoint /ruta/checkpoint.json
# las candidatas del checkpoint ya vienen reconfirmadas a profundidad 17 y
# limitadas a 1 por partida: sumarlas a CANDIDATOS en finalize-doble-solucion.mjs
node scripts/finalize-doble-solucion.mjs
```

## Catálogo de Stoyko semanal (RF-7.2)

El ejercicio de Stoyko (E7) usa un catálogo aparte, `stoykoItems` (no es un subtipo de `RadarItem`: no hay "una" solución, sino una línea del motor contra la que se comparan las candidatas del usuario). `stoyko-v1-8` tiene 8 posiciones "ricas" — varias jugadas genuinamente competitivas, sin ganador claro — generadas por `scripts/mine-stoyko.mjs` con el mismo método que doble solución: autojuego del motor local, criba con MultiPV a profundidad 14 y reconfirmación a 17. Acá el criterio de aceptación es distinto: no "hay una jugada claramente mejor" sino lo opuesto — el hueco entre la mejor y la tercera candidata en MultiPV(3) debe ser ≤50 cp y la evaluación de la mejor jugada debe estar entre −150 y 150 cp (ni ganada ni perdida, para que valga la pena pararse a calcular).

La primera corrida (con muestreo cada 2 plies desde el ply 10 de una sola partida de autojuego) encontró el objetivo casi de inmediato, pero 5 de las 8 candidatas venían de la misma partida — jugadas consecutivas de una posición que cambia poco de un ply al siguiente, muy poca variedad real para un ejercicio pensado para durar meses. La corrida final limita a 1 candidata aceptada por partida de autojuego y aleatoriza las primeras 8 jugadas de cada partida (elige al azar entre las 3 mejores del motor, en vez de siempre la mejor) para que las partidas diverjan de verdad; las 8 posiciones resultantes vienen de aperturas y estructuras distintas. `mejorLinea` guarda los primeros 3 plies de la variante principal del motor a profundidad 17, verificados legales con chess.js de forma independiente (nunca se confía en la notación del motor sin re-verificar).

Sin fuente de dificultad calibrada (igual que doble solución) y sin rating: Stoyko no puntúa una jugada "correcta", así que no aplica. Reproducible con:

```sh
node scripts/mine-stoyko.mjs --target 8 --max-checked 800
```

## Agrandar el catálogo: una descarga y un comando

Es lo único que destraba el límite real (el catálogo se repite a los 2–4 días). No regenera nada: **suma** puzzles al lote que ya está, sin tocar las 48 posiciones de autojuego que costaron horas de minado.

```sh
wget -c https://database.lichess.org/lichess_db_puzzle.csv.zst
npm run add:puzzles -- --puzzles lichess_db_puzzle.csv.zst --target 400
npm test && npm run measure:radar
```

Eso es todo. El `.zst` se descomprime con el zstd que Node trae de fábrica (22.15+); en un Node anterior hace falta el binario `zstd` instalado, o descomprimir a mano y pasar el `.csv`. Opciones:

| Opción | Por defecto | Para qué |
|---|---|---|
| `--target` | 400 | cuántas sumar |
| `--rating-min` / `--rating-max` | 600 / 2600 | ancho de la escala de dificultad |
| `--popularidad` | 50 | calidad mínima (votos de la comunidad) |
| `--dry-run` | — | ver el resultado sin escribir |
| `--max-motor` | 300 | tope de posiciones que van al motor |

**Por qué el rango por defecto es más ancho que el del lote original (800–2000).** La dificultad del Radar es un percentil *dentro de cada fuente* (ADR-0007), así que un rango angosto deja los extremos de la escala sin contenido propio. Los puzzles CC0 son la única fuente con dificultad calibrada por miles de personas: son lo único que puede estirar los extremos, y ese es justamente el hueco que el autojuego no cubre.

**Qué garantiza.** Reparto en ocho tramos de rating para que la escala se estire de verdad y no se amontone en el medio; tope del 50% para un mismo tipo dentro de cada tramo, para que la mezcla de RF-5.1 se sostenga por catálogo y no solo por el peso del selector; descarte por FEN e id ya presentes; y **descarte —no etiquetado dudoso— de toda posición que no se pueda clasificar**. Se está eligiendo entre millones: meter una con el tipo equivocado invierte su feedback, que es exactamente el defecto que corrigió la auditoría de 2026-07.

**Por qué ahora tarda segundos y no horas.** La clasificación autoritativa del tipo parecía exigir el motor en cada posición. Medido sobre los 80 puzzles del lote: **1 solo** lo necesita. `defensa` sale de una etiqueta de Lichess, `genuina` es aritmética de material y `ofensiva` es el resto; solo `envenenada` pide una opinión del motor, y **solo puede aplicar** si la solución declina material y además existe una captura que aparente ganarlo. `clasificarPorTablero` aplica ese prefiltro. Corriendo `reclassify-radar-tipos.mjs` con él contra los 80 puzzles reales: **0 cambios** respecto de la versión que buscaba en todas.

Las envenenadas nuevas salen con su carnada ya marcada, aprovechando las líneas de esa misma búsqueda (a profundidad 14; `npm run build:carnadas` las re-verifica a 17 junto con el resto si se quiere uniformidad).

Medido con datos sintéticos de prueba, sumar 154 posiciones llevó el catálogo de 128 a 282 y la repetición de 2–4 días a **5–8**, con la cobertura a 30 días de 39–67 a 75–108.

## Generación reproducible (lote completo, desde cero)

Requisitos: Node 20+ y `script` (util-linux; da un pseudo-terminal al binario WASM de Stockfish). Los `.zst` los abre el zstd de Node (22.15+); con un Node anterior, instalar el binario `zstd`. Los archivos de entrada no se versionan en este repositorio.

```sh
wget -c https://database.lichess.org/lichess_db_puzzle.csv.zst
wget -c https://database.lichess.org/standard/lichess_db_standard_rated_2013-01.pgn.zst
npm install
npm run build:radar-dataset -- \
  --puzzles lichess_db_puzzle.csv.zst \
  --games lichess_db_standard_rated_2013-01.pgn.zst \
  --per-type 20 \
  --depth 14
```

El comando genera `src/services/puzzles/seedData.ts`. Su versión es un hash del contenido, por lo que el mismo lote conserva la misma versión. Al arrancar, la app compara esa versión con IndexedDB y reemplaza únicamente el catálogo si cambió; las tarjetas FSRS y el progreso del usuario no se tocan.

## Reglas del pipeline

- Puzzles: rating 800–2000 y popularidad mínima 50.
- Tipos tácticos: `defensiveMove` → defensa; `hangingPiece` → genuina; `sacrifice` o `trappedPiece` → envenenada; el resto → ofensiva. Las etiquetas originales de Lichess se conservan en cada item para auditoría.
- Tranquilas: posiciones de partidas desde el ply 16, espaciadas cada 8 plies, sin jaque ni final de partida. Stockfish examina todas las variantes legales vía MultiPV a profundidad configurable; se aceptan solo posiciones con evaluación absoluta ≤120 cp, diferencia entre las dos mejores jugadas ≤70 cp y una mejor jugada que no sea captura, promoción ni jaque.
- **Jugadas aceptables (RF-5.3, corrección de auditoría 2026-07):** como una posición tranquila se acepta justamente porque *no* tiene un golpe único, casi siempre hay varias jugadas prácticamente equivalentes. El pipeline guarda en `jugadasAceptables` todas las que están dentro de `maxAcceptableGapCp` (50 cp) de la mejor, y el entrenamiento cuenta cualquiera de ellas como acierto — exigir la primera jugada exacta marcaba fallo (y generaba una tarjeta de error espuria) una segunda jugada igual de buena. Las tranquilas ya embebidas se enriquecieron con `scripts/backfill-tranquilas-aceptables.mjs`, que re-corre MultiPV a profundidad 14 anclando en la jugada canónica ya validada sin cambiarla.
- El generador aborta si no alcanza la cuota de los cinco tipos, si duplica FEN/ID o si algún item no tiene solución.

## Reclasificación de tipos con el motor (RF-5.1, corrección de auditoría 2026-07)

El mapeo por etiqueta de tema (`classifyPuzzleThemes`) resultó **semánticamente inválido** para las categorías de oferta de material: `sacrifice`/`trappedPiece` describen un sacrificio *correcto del solucionador* (la jugada que hay que jugar), no una carnada a rechazar. En el lote viejo, 10 de 20 `envenenada` tenían una captura como `solucion[0]`, y el feedback ("detectaste la trampa y no capturaste") quedaba invertido.

El lote publicado ahora re-deriva el tipo de cada puzzle con Stockfish local (`scripts/reclassify-radar-tipos.mjs`, profundidad 14), no por etiqueta:

- **defensa** — tema `defensiveMove` (etiqueta explícita y fiable de Lichess).
- **genuina** — la solución captura material que queda de arriba sin recaptura adecuada (pieza realmente colgada).
- **envenenada** — hay una captura que *parece* ganar material (neto ≥1 a 1 ply) pero el motor la condena (≥ el margen de trampa) **y la solución la declina** (no es una captura). Los puzzles tácticos casi no cumplen esto (su solución suele ser activa), así que —igual que las tranquilas— la envenenada se **genera aparte** por autojuego: `scripts/mine-envenenada.mjs` (criba a 14 + reconfirmación a 17, 1 por partida) y se agrega con `scripts/finalize-envenenada.mjs`. `fuente: 'pipeline-envenenada'`, rating fijo 1500.
- **ofensiva** — el resto (combinaciones, sacrificios, golpes forzados).

`classifyPuzzleThemes` queda como un fallback grueso solo para arrancar la generación; la clasificación autoritativa del lote es la del motor. `validateRadarDataset` usa mínimos por-tipo (`MIN_POR_TIPO`): `genuina`/`envenenada` no se pueden forzar a 20 desde puzzles sin volver a inventar etiquetas.

### Escala de dificultad normalizada (ADR-0007)

El `rating` crudo mezcla magnitudes que no son comparables: rating de puzzle de Lichess, Elo promedio de los jugadores de una partida y un 1500 fijo para contenido generado. Se conserva para trazabilidad, pero el selector adaptativo (RF-5.5) ya no lo usa como una escala única: calcula un percentil 0–100 dentro de cada `fuente`, con percentil medio para empates y 50 para cohortes constantes. El progreso personal y cada intento nuevo guardan esa dificultad normalizada. La migración a esquema v12 reinicia únicamente el centro adaptativo en 50 y conserva todo el historial previo. La decisión y sus límites están documentados en [ADR-0007](adr/0007-dificultad-normalizada-radar.md).

## Explicación por posición (RF-5.3, ronda C)

Hasta la ronda C, el feedback del Radar era **una frase fija por tipo**: las 116 posiciones se repartían cinco textos, y el panel mostraba solo la primera jugada de la solución. Fallabas y leías "había una combinación ganadora que no se jugó" sin enterarte de cuál era. Peor, la frase afirmaba cosas que no siempre eran ciertas de esa posición concreta.

Ahora `core/radarExplicacion.ts` compone el texto por posición, y **solo afirma lo que puede comprobar reproduciendo la línea sobre el tablero** con chess.js:

- **Mate en N** — la posición final es mate; N cuenta jugadas del solucionador, no plies.
- **Material al terminar la línea** — contado pieza por pieza. La pieza se nombra solo si el número es exactamente el suyo (3 = una pieza, 5 = una torre); 4 peones netos se dicen "4 peones", no "una pieza".
- **Motivo táctico** — solo las etiquetas de Lichess que describen un mecanismo (`fork`, `pin`, `backRankMate`…), ordenadas de más a menos específica. Las genéricas (`crushing`, `short`, `middlegame`) no aportan nada que el usuario no vea. Las que el tipo ya declara (`defensiveMove` en una defensa) no se repiten.
- **Alternativas equivalentes** en las tranquilas, con la lista recortada: una posición del lote tiene 23 y enumerarlas convertía el feedback en una pared de notación.
- **La línea completa**, numerada desde la jugada real de la posición.

**Lo que deliberadamente no se afirma.** Ocho posiciones del lote terminan su línea con el solucionador *abajo* en material, porque la línea se corta cuando la ventaja ya es clara y la compensación llega después. Ahí no se dice nada de material: contar "perdés una pieza" sería cierto del tablero y falso de la partida.

### La carnada de las envenenadas

Lo único que el tablero no puede decidir solo es **cuál** de las capturas aparentemente ganadoras es la trampa: en la mitad de las envenenadas del lote hay dos o más (`enven-07` tiene cuatro, las cuatro promociones de `dxc8`). Lo decide el motor fuera de línea y viaja en el catálogo, en `RadarItem.carnada`:

```sh
npm run build:carnadas   # profundidad 17, refutación de 4 plies re-verificada con chess.js
```

Se guarda la captura, su material aparente, la continuación del motor y cuánto cuesta. Cuando el costo llega al centinela de mate, la explicación cambia de forma: la carnada no cuesta material, tira un mate que ya estaba. Si una posición no tuviera carnada identificable, el texto cae a la frase genérica del tipo — no se inventa.

**Corolario que apareció midiendo esto:** el catálogo tenía una solución cortada a la mitad. `lichess-004LZ` corona con `c2c1q`, y el código que reproducía líneas UCI emparejaba solo origen y destino: chess.js devolvía primero `c1=N`, que da jaque donde la dama no lo da y volvía ilegal el resto de la línea. Estaba igual en `ui/state/chessBoardUtils.ts#sanDeLinea`, que alimenta los feedback de Cálculo comprometido y Stoyko.

## Cuánto aguanta el catálogo antes de repetirse

```sh
npm run measure:radar
```

Simula sesiones reales contra el catálogo publicado, para cada banda de la dieta, y reporta el pool efectivo, a los cuántos días vuelve una posición ya vista y qué porción del catálogo se llegó a ver en 30 días. El catálogo **no se sirve entero**: el selector filtra por una banda de ±15 percentiles alrededor del centro adaptativo, así que el pool efectivo de un usuario concreto son 30–57 de las 128.

Medido antes de la ronda C, evitando solo los 8 ids más recientes (una sesión):

| Banda | Pool efectivo | Repite a los | Visto en 30 días |
|---|---:|---:|---:|
| principiante | 30 | 2 días | 33/116 |
| elemental | 44 | **1 día** | 44/116 |
| intermedio | 45 | **1 día** | 45/116 |
| avanzado | 45 | **1 día** | 48/116 |
| experto | 31 | **1 día** | 36/116 |

Una táctica que uno recuerda no entrena nada: verla al día siguiente es tiempo tirado. La ventana anti-repetición pasó a ser una **fracción del pool alcanzable** (60%) en vez de un número fijo, porque el pool depende de la dificultad del usuario y una ventana fija demasiado grande se vacía y termina repitiendo igual, pero encima perdiendo el control de dificultad. Después del cambio:

| Banda | Repite a los | Visto en 30 días |
|---|---:|---:|
| principiante | 3 días | 36/116 |
| elemental | 3 días | 50/116 |
| intermedio | 4 días | 54/116 |
| avanzado | 3 días | 54/116 |
| experto | 2 días | 39/116 |

Y con las 12 envenenadas nuevas (catálogo de 128), que además engordan el pool efectivo de las bandas medias de 44–45 a 56–57:

| Banda | Pool efectivo | Repite a los | Visto en 30 días |
|---|---:|---:|---:|
| principiante | 30 | 3 días | 36/128 |
| elemental | 56 | 4 días | 62/128 |
| intermedio | 57 | 4 días | 67/128 |
| avanzado | 57 | 4 días | 67/128 |
| experto | 31 | 2 días | 39/128 |

Con las 13 de la ronda de 2026-07-29 (catálogo de 141, envenenadas 21 → 34) las bandas medias ganan **dos días** de separación y el pool efectivo pasa de 56–57 a 69–70:

| Banda | Pool efectivo | Repite a los | Visto en 30 días |
|---|---:|---:|---:|
| principiante | 30 | 3 días | 36/141 |
| elemental | 69 | **6 días** | 77/141 |
| intermedio | 70 | **5 días** | 81/141 |
| avanzado | 70 | 4 días | 81/141 |
| experto | 31 | 2 días | 39/141 |

Los extremos (principiante y experto) no se movieron, y ese es justo el punto del párrafo siguiente: el contenido de autojuego entra todo en el percentil 50.

**El límite que queda es el tamaño del catálogo, y es real.** Con 141 posiciones y 8–10 por sesión, las bandas medias ya aguantan 5–6 días pero los extremos siguen repitiendo a los 2–3. Las dos vías para agrandarlo:

- **Puzzles CC0 de Lichess** — la vía buena, y la única que agranda los extremos de dificultad, porque traen rating calibrado por la comunidad. Requiere descargar el export oficial (ver "Generación reproducible"); el entorno de desarrollo donde se hizo esta ronda no tiene salida a `database.lichess.org`, así que quedó pendiente de correrse en una máquina con red.
- **Autojuego local** — funciona, pero es caro y solo engorda el medio de la escala. En la ronda de 2026-07-27 se minaron **12 envenenadas nuevas** (de 9 a 21 en total, el tipo más escaso del catálogo) revisando 871 posiciones de autojuego: **1 candidata cada ~73 revisadas**, unas dos horas de cómputo. La de 2026-07-29 sumó **13 más** (21 → 34) revisando 915 posiciones —1 cada ~70, unos 45 minutos de autojuego más 10 de marcado de carnadas—. Receta completa, en tres pasos:

  ```sh
  node scripts/mine-envenenada.mjs --target 12 --checkpoint ruta.json
  node scripts/finalize-envenenada.mjs --checkpoint ruta.json --conservar
  npm run build:carnadas && npm test && npm run measure:radar
  ```

  El minador guarda checkpoint después de cada partida de autojuego, así que se puede cortar y retomar. Sin `--conservar`, `finalize` **reemplaza** el lote entero en vez de sumar. El tercer paso no es opcional y un test lo hace cumplir: cada envenenada necesita su carnada marcada por el motor (RF-5.3), y sin eso `radarExplicacion.test.ts` falla con "enven-NN sin carnada".

**Y ojo con una interacción:** todo el contenido de autojuego lleva rating fijo 1500 y, por ADR-0007, una cohorte constante queda en el percentil 50. Sumar más posiciones generadas **no ayuda a un usuario cuyo centro adaptativo esté lejos del medio**: sigue siendo invisible salvo por el rescate por tipo descrito abajo. Darles una dificultad medida (por ejemplo, a qué profundidad se estabiliza la mejor jugada del motor) sería una decisión de diseño nueva, no un ajuste.

### Cobertura de tipos fuera de la banda (RF-5.1)

Consecuencia directa de lo anterior, encontrada midiendo: las 8 envenenadas y las 8 de doble solución viven exactamente en el percentil 50, así que con la banda de ±15 **solo eran alcanzables con el centro adaptativo entre 35 y 65**. Fuera de esa ventana el Radar servía **cero** ofertas envenenadas. Un usuario que mejora —y cuyo centro sube a 70— dejaba de ver trampas para siempre, con lo cual "capturar siempre está bien" pasaba a ser cierto el 100% de las veces: justo el patrón trivial que RF-5.1 prohíbe.

`selectNextRadarItem` ahora rescata, para cada tipo que la banda dejó afuera, sus 3 posiciones más cercanas al centro. Chico a propósito: garantiza que el tipo siga apareciendo sin que 8 posiciones inunden la sesión.

## Validación de uso real

La validación técnica no reemplaza el criterio humano de salida de Fase 1. Durante siete días, una persona debe hacer una sesión diaria de al menos 15 minutos y verificar:

1. Los fallos reaparecen al comienzo de sesiones posteriores desde la Cola.
2. El Panel muestra la tasa de las últimas 50 respuestas; tras suficiente práctica debe acercarse y mantenerse en 60–80%.
3. Una exportación e importación en otro dispositivo conserva tarjetas, calibración, progreso adaptativo, sesiones/bloques y el historial de respuestas del Radar.

Las respuestas del Radar se guardan localmente y se exportan, para que esta validación pueda auditarse sin telemetría de terceros.
