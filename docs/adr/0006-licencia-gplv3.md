# ADR-0006 — Licencia del proyecto: GPLv3

- **Estado:** Aceptado
- **Fecha:** 2026-07-16
- **Requisitos relacionados:** RNF-8; ADR-0002

## Contexto
El proyecto distribuye Stockfish (GPLv3) al navegador, lo que constituye distribución de una obra combinada. El dueño del proyecto decidió publicarlo como código abierto. Falta formalizar bajo qué licencia queda el código propio.

## Decisión
Todo el código del repositorio se licencia bajo **GPLv3**, con el texto oficial en `LICENSE` en la raíz (copiado sin modificaciones desde gnu.org). Los datos derivados del dataset de puzzles de Lichess conservan CC0, con atribución de la fuente en la documentación. La documentación del proyecto (docs/) se publica bajo la misma GPLv3 por simplicidad.

## Alternativas consideradas
- **MIT / Apache-2.0** — más permisivas, pero al distribuirse junto a Stockfish la obra combinada queda igualmente bajo términos GPL; un código propio en MIT solo agregaría ambigüedad sin libertad práctica adicional.
- **AGPLv3** — relevante cuando hay servicios de red (cierra el "hueco del SaaS"). Hoy no hay backend; si la Fase 6 agrega servicios en servidor, se evaluará migrar los componentes de servidor a AGPL en un ADR nuevo.

## Consecuencias
Cualquier distribución del proyecto o de un fork debe publicar el código fuente bajo GPL (copyleft); las contribuciones externas entran bajo GPLv3; el repositorio público ya satisface la obligación de fuente. Se gana coherencia legal total con la dependencia principal y con el ecosistema abierto del ajedrez.
