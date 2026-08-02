# ELOmax — entrenador de ajedrez basado en evidencia

Aplicación web progresiva (PWA) que **prescribe** tu entrenamiento de ajedrez en vez de ofrecerte un menú infinito de ejercicios. La pregunta que intenta responder no es "¿cuánto entrenaste?" sino **"¿esto te está haciendo mejor jugador?"**.

**App en vivo:** https://ftranchet.github.io/ajedrez/ — se despliega sola desde `main`.

## La idea

La mayoría de las apps de ajedrez optimizan el enganche: rachas, puntos, cofres, miles de puzzles. Vos entrenás mucho y tu Elo no se mueve. ELOmax parte de lo contrario:

- **Te dice qué hacer hoy, y por qué.** Cada bloque de la sesión trae su motivo en una línea, derivado de tus datos, no de una promoción. Si tus errores recientes son sobre todo tácticos, la sesión lo refleja.
- **Mide mejora, no actividad.** El Panel separa el "panel de verdad" (rating en partidas lentas, errores graves por partida, calibración del juicio) de los totales de actividad, que están al fondo y aclaran que describen volumen, no progreso.
- **Es honesta con lo que no sabe.** Cuando faltan datos comparables lo dice, en lugar de dibujar un gráfico que aparente saber.
- **No gamifica.** Sin puntos, monedas, cofres ni rankings. Los hitos aparecen cuando demostrás una capacidad nueva, nunca por volumen. Como máximo cuenta una sesión por día.
- **Tus datos son tuyos.** Todo vive en tu dispositivo (IndexedDB), funciona sin conexión y se exporta entero en formatos abiertos cuando quieras. No hay backend ni cuenta de ELOmax: nadie más que vos ve tu entrenamiento. La única excepción es opcional y la activás vos — si conectás tu cuenta de Lichess para jugar contra Maia (RF-1.4), tu token, los desafíos, las jugadas y el PGN de esa partida viajan a lichess.org. El token se guarda solo en este dispositivo, nunca entra en la exportación, y "Eliminar todos mis datos" lo borra.

## Cómo funciona el ciclo

1. **Jugás** una partida lenta, contra el motor local o importando el PGN de una partida real (Lichess, Chess.com, un club).
2. **La analizás en dos fases**: primero registrás tu propio juicio —dónde se definió, cuál era tu plan, cómo evaluás las posiciones clave—, y recién después habla Stockfish. El orden importa: comparar tu juicio con el del motor es lo que enseña.
3. **Tus errores se convierten en repasos.** Cada error que confirmás entra en una cola con repetición espaciada (FSRS) y vuelve justo cuando estás por olvidarlo.
4. **La sesión diaria** mezcla esos repasos con patrones del currículo, el Radar (posiciones mezcladas, sin avisarte si hay táctica) y, según tus fugas, un bloque de criterio de cálculo.
5. **Se mide aparte.** Una batería de 30 posiciones reservadas, que nunca se entrenan ni se muestran resueltas, se repite cada siete semanas para ver si lo entrenado transfiere a contenido nuevo.

Todo el contenido es local y se generó con verificación programática: 141 posiciones de Radar, 20 patrones, 16 finales teóricos, 8 posiciones de Stoyko y 30 de la batería de transferencia. Ninguna se escribió "de memoria": los scripts de `scripts/` las validan con chess.js y Stockfish. En cada push, CI vuelve a correr la verificación de los 20 patrones y los 16 finales; el catálogo del Radar y los niveles del motor se verifican al generarlos y con los tests unitarios, no re-midiendo con Stockfish en cada push (`measure:niveles` tarda demasiado para CI y se corre a mano).

## Documentación

| Documento | Qué contiene |
|---|---|
| **`docs/PRD.md`** | Requisitos de producto: la fuente de verdad. **Empezar por acá.** |
| **`CONTRIBUTING.md`** | Reglas de trabajo para cualquier colaborador, persona o agente de IA. |
| **`docs/roadmap.md`** | Fases de construcción con sus criterios de salida. |
| **`docs/design-system.md`** | Identidad visual, tokens y componentes. |
| **`docs/adr/`** | Decisiones de arquitectura: qué se decidió, por qué y qué se descartó. |
| **`docs/evidence/`** | La investigación que justifica cada módulo del producto. |
| **`docs/radar-dataset.md`** | Origen, generación y validación del catálogo del Radar. |
| **`docs/niveles-motor.md`** | Cómo se piden los niveles del oponente local y cómo se midieron. |
| **`docs/maia-prueba.md`** | Guía para verificar a mano la partida contra Maia (la red a Lichess no es alcanzable desde CI). |
| **`docs/prototipos/`** | Referencia visual del design system (se abre en el navegador). |
| **`CHANGELOG.md`** | Historia de cambios. |

## Desarrollo

Requiere Node 20 o superior (CI corre en 22).

```bash
npm install    # instala dependencias y copia el motor a public/engine/
npm run dev    # servidor de desarrollo
```

| Comando | Para qué |
|---|---|
| `npm test` | Tests unitarios (Vitest) |
| `npm run e2e` | Tests end-to-end (Playwright) |
| `npm run typecheck` | TypeScript en modo estricto |
| `npm run lint` | ESLint |
| `npm run verify:patrones` | Revalida las posiciones del currículo con chess.js |
| `npm run verify:finales` | Revalida los finales con Stockfish |
| `npm run measure:niveles` | Mide los niveles del motor jugándolos entre sí (RF-1.3b) |
| `npm run build` | Build de producción |

La arquitectura separa `core/` (dominio puro, sin React ni base de datos), `services/` (adaptadores: almacenamiento, motor, análisis) y `ui/`. Los detalles y las reglas de contribución están en `CONTRIBUTING.md`.

## Estado

Las cinco fases del roadmap están **funcionalmente implementadas y verificadas mecánicamente** (tests unitarios, E2E y verificación de contenido en CI). Eso es una afirmación acotada a propósito: un E2E en verde demuestra que el flujo funciona, no que el prescriptor acierte ni que el entrenamiento mueva el Elo. Para no confundir una cosa con la otra, cada entregable se lee en cuatro estados:

1. **Implementado** — el código existe y hace lo que dice.
2. **Verificado mecánicamente** — tests, E2E y verificación de contenido lo respaldan. *(Es donde está hoy el producto entero.)*
3. **Validado con usuarios** — alguien lo usó varios días seguidos y el flujo se sostiene. *(Pendiente.)*
4. **Validado pedagógicamente** — hay evidencia longitudinal de que mejora el juego. *(Pendiente: es el objetivo del experimento ABAB y de la batería de transferencia, que necesitan meses de datos reales.)*

Las fases, en el estado 2:

- **Fase 0 — Fundaciones** ✅
- **Fase 1 — Radar + Cola Universal** ✅ *(falta la validación de uso real durante siete días, que no se puede automatizar)*
- **Fase 2 — Partidas y análisis en dos fases** ✅
- **Fase 3 — Prescriptor y currículo base**, con finales teóricos contra Stockfish ✅
- **Fase 4 — Módulos avanzados**: criterio de cálculo, regla de candidatas, modificador a ciegas, doble solución y cálculo comprometido con Stoyko semanal ✅
- **Fase 5 — Medición**: batería de transferencia, detector de sobreajuste, adherencia honesta (plan semanal, constancia de ocho semanas, hitos por capacidad, recordatorio opcional) y experimento individual ABAB ✅

Quedan pendientes tres entregables que dependen de acceso de red bloqueado en el entorno de desarrollo: los bots Maia, la importación automática de historial y la conversión de ventajas. El detalle entregable por entregable está en `docs/roadmap.md`.

## Licencia y autoría

El **código** es **GPLv3** (ver `LICENSE` y ADR-0006). El archivo `LICENSE` contiene el texto oficial de gnu.org, sin modificaciones.

La distribución completa no es solo el código: **`THIRD_PARTY_NOTICES.md`** lista las licencias de dependencias, tipografías, contenido y assets. Ahí está la restricción que conviene conocer antes de reutilizar el proyecto — el set de piezas Staunty es CC BY-NC-SA 4.0 y **prohíbe el uso comercial**, que es más restrictivo que la GPLv3.

Por [Francisco Tranchet](https://www.linkedin.com/in/ftranchet/) + IA.
