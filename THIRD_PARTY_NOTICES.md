# Avisos de terceros

El código de ELOmax es **GPLv3** (`LICENSE`, ADR-0006). Lo que se distribuye
junto con él —dependencias, tipografías, contenido y el set de piezas— tiene sus
propias licencias, y no todas dicen lo mismo. Este archivo las lista para que
nadie tenga que deducirlas del `package.json`.

## ⚠️ Restricción vigente: el set de piezas prohíbe el uso comercial

El set **Staunty** (`public/piece/staunty/`, autor sadsnake1, vía
[lichess-org/lila](https://github.com/lichess-org/lila)) está bajo
[**CC BY-NC-SA 4.0**](https://creativecommons.org/licenses/by-nc-sa/4.0/), que:

- **prohíbe el uso comercial** de esos archivos;
- exige atribución, enlace a la licencia e indicación de los cambios;
- obliga a compartir las obras derivadas del set bajo la misma licencia.

Consecuencia práctica: **la distribución completa tal como se publica hoy no se
puede usar comercialmente**, aunque el código sí sea GPLv3. Es más restrictivo
que la GPL en ese punto, y por eso figura primero.

Para levantar la restricción alcanza con reemplazar el set por uno de licencia
libre —`cburnett` (CC BY-SA 3.0), también en lila, es el candidato directo— y
actualizar este archivo. Es una decisión de diseño abierta, no un descuido:
Staunty se eligió en el design system v2 (§3.1) por su diferenciación de formas
a tamaños chicos.

## Contenido

| Contenido | Origen | Licencia |
|---|---|---|
| Posiciones del Radar `lichess-*` | [Lichess open database](https://database.lichess.org/) | CC0 1.0 |
| Posiciones generadas por el pipeline (`scripts/`) | Este proyecto | GPLv3 |
| Patrones, finales, Stoyko y batería de transferencia | Este proyecto | GPLv3 |

## Motor

| Componente | Licencia | Nota |
|---|---|---|
| [Stockfish](https://stockfishchess.org/) (WASM, `public/engine/`) | GPL-3.0 | Copia binaria publicada por `scripts/copy-engine.mjs`; misma licencia que ELOmax. |

## Dependencias de ejecución

| Paquete | Licencia |
|---|---|
| `chess.js` | BSD-2-Clause |
| `chessground` | GPL-3.0-or-later |
| `dexie` | Apache-2.0 |
| `fflate` | MIT |
| `react`, `react-dom` | MIT |
| `stockfish` | GPL-3.0 |
| `ts-fsrs` | MIT |

## Tipografías

Newsreader, Instrument Sans e IBM Plex Mono se distribuyen vía `@fontsource*`
bajo la **SIL Open Font License 1.1**, que permite uso comercial con atribución
y sin sublicenciamiento del archivo de fuente por separado.

## Cómo mantener este archivo

Al agregar una dependencia de ejecución, un asset o una fuente de contenido,
sumarla acá con su licencia. Si la licencia nueva restringe más que la GPLv3
—como el `NC` de Staunty—, decirlo arriba de todo, no en la tabla.
