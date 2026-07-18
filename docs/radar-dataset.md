# Dataset del Radar

Este documento describe cómo se genera el catálogo offline del Radar de ELOmax. Cumple RF-5.6 y la decisión de [ADR-0005](adr/0005-datos-puzzles-lichess.md): la aplicación no consulta puzzles durante una sesión; incorpora un lote versionado y funciona sin conexión.

## Lote publicado

`radar-84639d96e9b3` contiene 100 posiciones: 20 ofensivas, 20 defensivas, 20 tranquilas, 20 de oferta genuina y 20 de oferta envenenada. Las 80 tácticas se tomaron del export oficial de puzzles de Lichess; las 20 tranquilas se extrajeron de partidas estándar reales y se verificaron con Stockfish 18.

Los exports de base de datos de Lichess son CC0 y su formato oficial explica que el FEN del puzzle es anterior a la jugada de armado; por eso el pipeline aplica la primera UCI antes de guardar la posición que ve el usuario. Fuente: [Lichess open database](https://database.lichess.org/).

## Subtipo doble solución (RF-5.7)

Sobre ese lote base, `radar-97561c841622` agrega 7 posiciones con el subtipo anti-Einstellung (RF-5.7): una jugada "familiar" que también gana con claridad, pero es objetivamente peor que la superior. No se sacaron del export de puzzles de Lichess (curados justamente para tener una sola solución: minar ese catálogo con MultiPV de Stockfish, sobre 15 posiciones probadas, dio 0 candidatas) ni de partidas reales (sin acceso de red en este entorno de desarrollo — ver limitación documentada en `docs/roadmap.md`, Fase 2).

En su lugar, `scripts/mine-doble-solucion.mjs` genera posiciones por autojuego del motor local (profundidad 7, para variedad realista sin gastar tiempo de más) y criba cada una con MultiPV a profundidad 14 — mismo estándar que las tranquilas. Esa criba sola resultó insuficiente para esta afirmación más fina ("esta jugada específica es la segunda mejor", no solo "la mejor es buena"): sobre 10 candidatas iniciales, una reconfirmación a profundidad 17 descartó 3 por no sostener el margen a mayor profundidad (una vio colapsar la diferencia a 60 cp, otra terminó empatada con la mejor). Las 7 que sobrevivieron se agregaron al lote con `scripts/finalize-doble-solucion.mjs`, tras una verificación final de legalidad con chess.js. Ninguna tiene rating calibrado (no hay una comunidad detrás, a diferencia de los puzzles de Lichess): usan un valor fijo de 1500, documentado como simplificación v1.

Es un lote chico a propósito: la tasa de acierto de este método (~0.3–1% de las posiciones revisadas sostienen la afirmación a profundidad 17) hace que sumar más sea una cuestión de tiempo de cómputo, no de otra técnica. Reproducible con:

```sh
node scripts/mine-doble-solucion.mjs --target 6 --max-checked 1200 --checkpoint /ruta/checkpoint.json
# revisar a mano las candidatas del checkpoint, reconfirmar a profundidad 17
# las que sobrevivan, sumarlas a CANDIDATOS en finalize-doble-solucion.mjs
node scripts/finalize-doble-solucion.mjs
```

## Catálogo de Stoyko semanal (RF-7.2)

El ejercicio de Stoyko (E7) usa un catálogo aparte, `stoykoItems` (no es un subtipo de `RadarItem`: no hay "una" solución, sino una línea del motor contra la que se comparan las candidatas del usuario). `stoyko-v1-8` tiene 8 posiciones "ricas" — varias jugadas genuinamente competitivas, sin ganador claro — generadas por `scripts/mine-stoyko.mjs` con el mismo método que doble solución: autojuego del motor local, criba con MultiPV a profundidad 14 y reconfirmación a 17. Acá el criterio de aceptación es distinto: no "hay una jugada claramente mejor" sino lo opuesto — el hueco entre la mejor y la tercera candidata en MultiPV(3) debe ser ≤50 cp y la evaluación de la mejor jugada debe estar entre −150 y 150 cp (ni ganada ni perdida, para que valga la pena pararse a calcular).

La primera corrida (con muestreo cada 2 plies desde el ply 10 de una sola partida de autojuego) encontró el objetivo casi de inmediato, pero 5 de las 8 candidatas venían de la misma partida — jugadas consecutivas de una posición que cambia poco de un ply al siguiente, muy poca variedad real para un ejercicio pensado para durar meses. La corrida final limita a 1 candidata aceptada por partida de autojuego y aleatoriza las primeras 8 jugadas de cada partida (elige al azar entre las 3 mejores del motor, en vez de siempre la mejor) para que las partidas diverjan de verdad; las 8 posiciones resultantes vienen de aperturas y estructuras distintas. `mejorLinea` guarda los primeros 3 plies de la variante principal del motor a profundidad 17, verificados legales con chess.js de forma independiente (nunca se confía en la notación del motor sin re-verificar).

Sin fuente de dificultad calibrada (igual que doble solución) y sin rating: Stoyko no puntúa una jugada "correcta", así que no aplica. Reproducible con:

```sh
node scripts/mine-stoyko.mjs --target 8 --max-checked 800
```

## Generación reproducible

Requisitos: Node 20+, `zstd`, y `script` (util-linux; da un pseudo-terminal al binario WASM de Stockfish). Los archivos de entrada no se versionan en este repositorio.

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
- El generador aborta si no alcanza la cuota de los cinco tipos, si duplica FEN/ID o si algún item no tiene solución.

## Validación de uso real

La validación técnica no reemplaza el criterio humano de salida de Fase 1. Durante siete días, una persona debe hacer una sesión diaria de al menos 15 minutos y verificar:

1. Los fallos reaparecen al comienzo de sesiones posteriores desde la Cola.
2. El Panel muestra la tasa de las últimas 50 respuestas; tras suficiente práctica debe acercarse y mantenerse en 60–80%.
3. Una exportación e importación en otro dispositivo conserva tarjetas, calibración, progreso adaptativo y el historial de respuestas del Radar.

Las respuestas del Radar se guardan localmente y se exportan, para que esta validación pueda auditarse sin telemetría de terceros.
