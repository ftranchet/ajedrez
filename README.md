# ELOmax — entrenador de ajedrez basado en evidencia

Aplicación web progresiva (PWA) que prescribe tu entrenamiento de ajedrez para maximizar Elo por hora invertida. Local-first: tus datos viven en tu dispositivo y son exportables siempre, de forma clara y en formatos abiertos.

**App en vivo:** https://ftranchet.github.io/ajedrez/ (se despliega automáticamente desde `main`).

## Mapa de la documentación
- **`docs/PRD.md`** — requisitos de producto: la fuente de verdad. Empezar por acá.
- **`CONTRIBUTING.md`** — reglas de trabajo para cualquier colaborador, persona o agente de IA.
- **`docs/roadmap.md`** — fases de construcción con criterios de salida.
- **`docs/radar-dataset.md`** — origen, generación y validación del catálogo offline del Radar.
- **`docs/design-system.md`** — identidad visual, tokens y componentes.
- **`docs/prototipos/`** — referencia visual y prototipo interactivo del design system (abrir en navegador).
- **`docs/adr/`** — decisiones de arquitectura (qué se decidió, por qué, qué se descartó).
- **`docs/evidence/`** — la investigación que justifica el producto.
- **`CHANGELOG.md`** — historia de cambios.

## Cómo correr
Requiere Node 20+.

```
npm install    # instala dependencias y copia el motor a public/engine/
npm run dev    # servidor de desarrollo
```

Más comandos (build, test, lint, typecheck) en `CONTRIBUTING.md`.

## Licencia
**GPLv3** (ver `LICENSE` y ADR-0006). El archivo `LICENSE` contiene el texto oficial, sin modificaciones, tomado de gnu.org/licenses/gpl-3.0.txt.

## Estado
Fase 0 (Fundaciones) está completa. Fase 1 (Radar + Cola Universal) está completa técnicamente, con un catálogo offline de 116 posiciones y datos adaptativos persistentes; falta su validación de uso real durante siete días antes de declararla cerrada. Fase 2 (Partidas y análisis en dos fases), Fase 3 (Prescriptor + currículo base, incluidos finales teóricos contra Stockfish) y Fase 4 (módulos avanzados: triage de reloj con informe mensual de fugas de tiempo, regla de candidatas, modificador a ciegas, doble solución y cálculo comprometido con Stoyko semanal) tienen su criterio de salida cumplido y verificado end-to-end; algunos entregables quedan pendientes (bots Maia, importación automática de historial y conversión de ventajas, bloqueados por falta de acceso de red en el entorno de desarrollo). Fase 5 (Medición completa) tiene todos sus entregables cumplidos: batería reservada de transferencia, detector de sobreajuste, adherencia honesta completa (plan semanal, racha y consistencia de ocho semanas, hitos por capacidad y recordatorio diario opcional) y experimento individual ABAB; queda —como en Fase 1— la validación de uso real, que no se puede automatizar. Detalle completo, entregable por entregable, en `docs/roadmap.md`.
