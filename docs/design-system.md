# Design System — FORGE

Documento vivo. Los tokens de esta página son la única fuente de estilos: se implementan en la configuración de Tailwind y ningún componente usa valores sueltos. Cambiar la estética = cambiar tokens acá, con entrada en el changelog.

## 1. Dirección estética: "Sala de estudio"

FORGE no es un juguete ni un casino de puzzles: es el escritorio de un club de ajedrez de noche. Oscuro cálido, materiales nobles, tipografía con carácter, cero confeti. La estética comunica la promesa del producto: acá se viene a trabajar bien, no a farmear rachas.

Principios visuales:
1. **El tablero manda.** Es siempre el elemento de mayor jerarquía visual; nada compite en tamaño ni saturación.
2. **Una acción primaria por pantalla.** La sesión del día tiene un botón; el resto es secundario.
3. **Feedback sobrio.** Acierto y error se comunican con color y microanimación ≤200 ms; las celebraciones se reservan para las métricas de verdad (mensual, no por puzzle).
4. **Densidad según dispositivo.** Celular: una cosa por pantalla. Escritorio: tablero + panel contextual, nunca tres paneles.
5. **Modo oscuro primero.** El modo claro es una fase futura; se diseña con tokens desde el día uno para no dolerse después.

## 2. Tokens

### 2.1 Color (modo oscuro, valores iniciales — iterar acá)

| Token | Valor | Uso |
|---|---|---|
| `bg-base` | `#171310` | Fondo de la app |
| `bg-surface` | `#211c17` | Tarjetas, paneles |
| `bg-elevated` | `#2b241d` | Modales, menús |
| `border-subtle` | `#3a3128` | Bordes y divisores |
| `text-primary` | `#ece5da` | Texto principal |
| `text-secondary` | `#a89c8c` | Texto de apoyo, porqués del Prescriptor |
| `accent` | `#d9a441` | Acción primaria, foco, latón/ámbar |
| `accent-pressed` | `#b8862f` | Estado presionado |
| `success` | `#7fa66a` | Acierto, verde salvia apagado |
| `error` | `#c2604f` | Fallo, ladrillo (nunca rojo puro) |
| `info` | `#6f8fa6` | Estados neutros, evaluación igualada |
| `board-light` | `#e8d9b7` | Casilla clara (crema) |
| `board-dark` | `#a67c52` | Casilla oscura (nogal) |
| `board-highlight` | `#d9a44166` | Última jugada / selección (accent al 40%) |
| `board-check` | `#c2604f80` | Jaque |

Contraste: `text-primary` sobre `bg-base` y `accent` sobre `bg-base` deben cumplir AA. Verificar en CI de diseño (manual al inicio).

### 2.2 Tipografía

| Token | Fuente | Uso |
|---|---|---|
| `font-display` | Fraunces (o Lora) | Títulos, números grandes del panel de verdad |
| `font-ui` | Inter | Todo el resto de la interfaz |
| `font-mono` | JetBrains Mono | Notación, PGN, FEN, relojes |

Escala: 12 / 14 / 16 (base) / 20 / 24 / 32 / 44. Cuerpo mínimo en celular: 16.

### 2.3 Espaciado y forma
Escala de espaciado: 4 / 8 / 12 / 16 / 24 / 32 / 48. Radio: `r-sm` 6, `r-md` 10, `r-lg` 16 (tarjetas). Sombras mínimas: la elevación se comunica con `bg-elevated` + borde, no con sombras dramáticas.

### 2.4 Movimiento
Duraciones: 120 ms (micro), 200 ms (transiciones de panel). Curva estándar `ease-out`. Nada anima más de 200 ms salvo el deslizamiento de piezas (que provee chessground). Sin animaciones de celebración por ítem.

## 3. Layouts responsive

| Contexto | Composición |
|---|---|
| Celular vertical (<640 px) | Tablero arriba a ancho completo; panel de acción (pregunta, confianza, botones) abajo; navegación inferior de 3 ítems: Hoy / Jugar / Panel |
| Celular horizontal / tablet (640–1024) | Tablero a la izquierda (≤60% del ancho), panel a la derecha; navegación colapsada |
| Escritorio (>1024) | Tablero centrado (máx. 640 px), panel contextual a la derecha, navegación lateral izquierda fina |

Reglas: la rotación re-acomoda sin recargar (RNF-1); el tablero nunca queda por debajo de 320 px; los targets táctiles ≥44 px; en escritorio, entrada de jugadas por teclado en notación algebraica.

## 4. Componentes núcleo (inventario inicial)

| Componente | Estados obligatorios |
|---|---|
| `Board` (envoltorio de chessground) | interactivo / solo lectura / a ciegas (fantasma, coordenadas) |
| `SessionCard` (bloque de la sesión del día) | pendiente / en curso / completado / salteado — siempre con su "porqué" en `text-secondary` |
| `EvalPicker` (evaluación rápida +−/±/=/∓/−+) | selección única, táctil |
| `ConfidenceSlider` (calibración 0–100) | aparece solo cuando el muestreo lo pide; descartable nunca |
| `FeedbackPanel` | acierto / fallo / "no había táctica, y por qué" |
| `MoveList` | notación con navegación; en celular, colapsable |
| `EvalGraph` (curva de evaluación post-análisis) | con marcadores de momento crítico del usuario vs. del motor |
| `TruthPanel` (métricas de verdad) | grande; números en `font-display` |
| `ActivityPanel` (métricas de actividad) | chico, secundario, sin celebración |
| `LineComposer` (cálculo comprometido) | ingreso de línea completa con validación de legalidad por ply |
| `Toast` | informativo / error; nunca celebración |

## 5. Voz y tono
Español rioplatense, directo, sin exclamaciones infladas. Los porqués del Prescriptor citan datos del usuario ("tus errores graves en finales triplican tu promedio"), no motivación vacía ("¡vos podés!"). Los estados vacíos explican qué hacer, no decoran.

## 6. Proceso de cambio
Cualquier estilo nuevo pasa por: (1) ¿existe token? usarlo; (2) ¿no existe? proponerlo acá vía pull request; (3) nunca valores sueltos en componentes. Las excepciones son deuda registrada en el changelog.
