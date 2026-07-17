# ELOmax — entrenador de ajedrez basado en evidencia

Aplicación web progresiva (PWA) que prescribe tu entrenamiento de ajedrez para maximizar Elo por hora invertida. Local-first: tus datos viven en tu dispositivo y son exportables siempre, de forma clara y en formatos abiertos.

**App en vivo:** https://ftranchet.github.io/ajedrez/ (se despliega automáticamente desde `main`).

## Mapa de la documentación
- **`docs/PRD.md`** — requisitos de producto: la fuente de verdad. Empezar por acá.
- **`CONTRIBUTING.md`** — reglas de trabajo para cualquier colaborador, persona o agente de IA.
- **`docs/roadmap.md`** — fases de construcción con criterios de salida.
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
Base documental completa. Fase 0 (Fundaciones) implementada: partida local contra el motor, persistencia y CI — criterio de salida verificado en emulación, pendiente de validar en un dispositivo real (ver `docs/roadmap.md`).
