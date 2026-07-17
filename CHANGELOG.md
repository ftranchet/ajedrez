# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versionado semántico `0.x.y` durante el MVP: `x` sube al completar una fase del roadmap, `y` con correcciones y mejoras menores. Toda entrada referencia requisitos del PRD (`RF-…`) o ADRs cuando aplica.

## [Sin publicar]
### Agregado
- Base documental del proyecto: PRD v0.2.0, roadmap, design system, plantilla y ADRs 0001–0006, CONTRIBUTING.md.
- Épica E14 (exportación e importación de datos) con criterios de aceptación; primeros entregables en Fase 1 del roadmap (RF-14.1, 14.2).
- ADR-0006: licencia del proyecto GPLv3.
- `LICENSE` con el texto oficial de GPLv3 (RNF-8, ADR-0006).
- Set de piezas **Staunty** (autor sadsnake1, tomado de lichess-org/lila) en `public/piece/staunty/`, licencia CC BY-NC-SA 4.0 con atribución (ver README del set).
### Cambiado
- docs(design-system): v2 — jerarquía de texto de 4 niveles, variantes `-hover`/`-subtle`, anillo de foco, especificación completa de tablero y piezas (§3), estados obligatorios por componente (§5), tipografía Newsreader + Instrument Sans + IBM Plex Mono, layout héroe validado para "Tu sesión de hoy" (§4.1) y flujo del Radar (§4.2).
- El proyecto pasa a llamarse **ELOmax** (antes FORGE); nombre actualizado en README, PRD (v0.2.1), CONTRIBUTING y design system. Los documentos de `docs/evidence/` conservan sus nombres de archivo originales por trazabilidad.
- PRD v0.2.2: el árbol del repo (§10) incluye `public/` y el inventario de licencias de RNF-8 registra el set de piezas.
- Flujo de trabajo generalizado para cualquier persona o agente de IA: CONTRIBUTING.md como única fuente de verdad de proceso, con patrón puntero para archivos de contexto específicos de herramientas.
### Corregido
- README: eliminada la instrucción ya cumplida de agregar `LICENSE` y la guía de volcado inicial del paquete documental (pasos ya ejecutados); queda como pendiente solo copiar los documentos de evidencia.
- Changelog: el enlace de Keep a Changelog apunta a la versión canónica en inglés (la variante `es-AR` no está publicada).
- Licencia del set Staunty precisada como **CC BY-NC-SA 4.0**, verificada en `lichess-org/lila/COPYING.md` (antes decía "licencia libre", impreciso: la cláusula NC restringe el uso comercial). Corregido en design system §3.1 y en el README del set.
- Design system: la nota de v2 ya no referencia archivos de prototipo no versionados en el repo; `CHANGELOG-snippet.md` integrado a este changelog y eliminado.

## [0.0.1] — 2026-07-16
### Agregado
- Inicio del repositorio.
