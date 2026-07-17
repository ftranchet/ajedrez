# Dataset del Radar

Este documento describe cómo se genera el catálogo offline del Radar de ELOmax. Cumple RF-5.6 y la decisión de [ADR-0005](adr/0005-datos-puzzles-lichess.md): la aplicación no consulta puzzles durante una sesión; incorpora un lote versionado y funciona sin conexión.

## Lote publicado

`radar-84639d96e9b3` contiene 100 posiciones: 20 ofensivas, 20 defensivas, 20 tranquilas, 20 de oferta genuina y 20 de oferta envenenada. Las 80 tácticas se tomaron del export oficial de puzzles de Lichess; las 20 tranquilas se extrajeron de partidas estándar reales y se verificaron con Stockfish 18.

Los exports de base de datos de Lichess son CC0 y su formato oficial explica que el FEN del puzzle es anterior a la jugada de armado; por eso el pipeline aplica la primera UCI antes de guardar la posición que ve el usuario. Fuente: [Lichess open database](https://database.lichess.org/).

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
