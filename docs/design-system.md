# Design System — ELOmax (v2.2)

Documento vivo. Los tokens de esta página son la única fuente de estilos: se implementan en la configuración de Tailwind y ningún componente usa valores sueltos. Cambiar la estética = cambiar tokens acá, con entrada en el changelog.

> **Cambios v2.2:** el CTA diario recupera la primera pantalla, el diagnóstico inicial pasa a ser un recorrido editorial de tres etapas y los datos asíncronos tienen estados explícitos de carga, demora, error y reintento sin vaciar toda la vista.

## 1. Dirección estética: "Sala de estudio"

ELOmax no es un juguete ni un casino de puzzles: es el escritorio de un club de ajedrez de noche. Oscuro cálido, materiales nobles, tipografía con carácter, cero confeti.

Principios visuales:
1. **El tablero manda.** Siempre el elemento de mayor jerarquía visual; nada compite en tamaño ni saturación.
2. **Una acción primaria por pantalla.** La sesión del día tiene un botón; el resto es secundario.
3. **Feedback sobrio.** Acierto y error se comunican con color y microanimación ≤200 ms; las celebraciones se reservan para las métricas de verdad.
4. **Densidad según dispositivo.** Celular: una cosa por pantalla. Escritorio: tablero + panel contextual, nunca tres paneles.
5. **Modo oscuro primero.** El modo claro es fase futura; se diseña con tokens desde el día uno.
6. **Nada depende solo del color.** Todo estado tiene una segunda señal: borde, forma, ícono o texto (RNF-6).

## 2. Tokens

### 2.1 Color (modo oscuro)

#### Fondos y bordes
| Token | Valor | Uso |
|---|---|---|
| `bg-base` | `#171310` | Fondo de la app |
| `bg-surface` | `#211c17` | Tarjetas, paneles |
| `bg-elevated` | `#2b241d` | Modales, menús, hover de superficies |
| `border-subtle` | `#3a3128` | Bordes y divisores |
| `border-strong` | `#544636` | Borde en hover/activo de controles |

#### Texto (jerarquía de 4 niveles)
| Token | Valor | Uso |
|---|---|---|
| `text-primary` | `#ece5da` | Texto principal |
| `text-secondary` | `#a89c8c` | Apoyo, porqués del Prescriptor |
| `text-tertiary` | `#998a77` | Metadatos, timestamps, deshabilitado; AA aun sobre `bg-elevated` |
| `text-on-accent` | `#1a1105` | Texto sobre `accent` (botón primario) |

#### Acento y semánticos
| Token | Valor | Uso |
|---|---|---|
| `accent` | `#d9a441` | Acción primaria, foco, latón/ámbar |
| `accent-hover` | `#e2b356` | Hover del primario |
| `accent-pressed` | `#b8862f` | Presionado |
| `accent-subtle` | `#d9a4411f` (12%) | Fondo de selección (chips, tabs, filas) |
| `success` | `#7fa66a` | Acierto, salvia apagado |
| `success-subtle` | `#7fa66a1a` (10%) | Fondo de FeedbackPanel acierto |
| `error` | `#c2604f` | Fallo, ladrillo (nunca rojo puro) |
| `error-subtle` | `#c2604f1a` (10%) | Fondo de FeedbackPanel fallo |
| `info` | `#6f8fa6` | Neutro, igualdad, sin conexión |
| `info-subtle` | `#6f8fa61a` (10%) | Fondo informativo |
| `focus-ring` | `#e2b356` | Anillo de foco, 2 px + 2 px offset |

Reglas de estado (aplican a todo componente):
- **hover**: fondo sube un nivel (`base→surface→elevated`) o `accent→accent-hover`; borde `subtle→strong`. 120 ms.
- **pressed**: `accent-pressed` o fondo baja un nivel. Sin animación de escala.
- **focus visible**: `outline: 2px solid focus-ring; outline-offset: 2px`. Nunca se suprime.
- **disabled**: `text-tertiary` sobre `bg-elevated`, sin borde, `cursor: not-allowed`. Nunca opacidad sola.
- **selected**: `accent-subtle` + borde `accent` de 1.5 px. Nunca relleno pleno de accent (eso es solo del botón primario).

Contraste: `text-primary`/`text-secondary` sobre los tres fondos, `text-tertiary` sobre `bg-elevated` y `text-on-accent` sobre `accent` cumplen AA. `text-tertiary` sigue reservado para metadatos y contenido auxiliar por jerarquía, no por falta de contraste.

### 2.2 Tipografía

| Token | Fuente | Fallback | Uso |
|---|---|---|---|
| `font-display` | Newsreader (variable, óptico) | Georgia, serif | Títulos de pantalla, números grandes del panel de verdad |
| `font-ui` | Instrument Sans (variable) | system-ui, sans-serif | Todo el resto de la interfaz |
| `font-mono` | IBM Plex Mono | ui-monospace, monospace | Notación, PGN, FEN, relojes, evaluaciones |

Escala: 12 / 14 / 16 (base) / 20 / 24 / 32 / 44. Cuerpo mínimo en celular: 16. Display usa peso 500 y line-height ≤1.1; los números del panel de verdad pueden usar 44 con itálica opcional para las lecturas en lenguaje claro.

### 2.3 Espaciado y forma
Escala: 4 / 8 / 12 / 16 / 24 / 32 / 48. Radio: `r-sm` 6 (chips, inputs), `r-md` 10 (botones, tarjetas internas), `r-lg` 16 (tarjetas de nivel de pantalla). Elevación = `bg-elevated` + borde, no sombras dramáticas.

### 2.4 Movimiento
120 ms micro (hover, chips), 200 ms transiciones de panel, `ease-out`. Nada anima más de 200 ms salvo el deslizamiento de piezas (provisto por chessground). Sin animaciones de celebración por ítem.

## 3. Tablero y piezas

### 3.1 Piezas
Set **Staunty** (Lichess, autor sadsnake1, licencia CC BY-NC-SA 4.0 — ver `public/piece/staunty/README.md`): siluetas rotundas de relleno sólido con contorno, máxima diferenciación de formas a tamaños chicos. La pieza ocupa el 90% de la casilla (5% de aire por lado). Sin sombras proyectadas.

### 3.2 Casillas
| Token | Valor | Uso |
|---|---|---|
| `board-light` | `#e8d9b7` | Casilla clara (crema) |
| `board-dark` | `#a67c52` | Casilla oscura (nogal) |

Coordenadas: `font-mono` 10–11 px, peso 600, en una franja fina fuera del tablero (ranks a la izquierda, files abajo — chessground `coordinates: true`), en `text-secondary`. *(Corregido 2026-07-18: la versión anterior de esta línea describía coordenadas dentro de la casilla; nunca se implementó así — chessground las pone dentro de la casilla solo con `coordinatesOnSquares`, y ahí escribe el nombre completo de cada casilla (p. ej. "a1") en las 64, no una sola letra/número solo en el borde. Se corrigió el texto para que describa lo que la app realmente muestra.)*

### 3.3 Estados del tablero (velos sobre la casilla, nunca reemplazo del fondo)
| Estado | Especificación | Segunda señal (RNF-6) |
|---|---|---|
| Última jugada | velo `accent` al 34% en origen y destino | dos casillas marcadas (patrón) |
| Selección | velo `accent` al 46% + borde interior 2 px `accent-pressed` | borde |
| Destino legal | punto central Ø 26% de la casilla, `#171310` al 28% | forma |
| Destino con captura | anillo de 3 px `#171310` al 28%, inscripto en la casilla | forma |
| Jaque | velo radial `error`: 85% centro → transparente al 82% del radio | gradiente radial, solo bajo el rey |
| Flecha de análisis | `accent` al 85%, grosor 3% del tablero, punta triangular | — |
| Flecha de jugada correcta | `success` al 85% (revelación post-respuesta) | — |
| Casilla de error | velo `error` al 34% (revelación post-respuesta) | ícono ✕ opcional en esquina |

### 3.4 Reglas
- El tablero nunca baja de 320 px; escala fluida (RF-1.2).
- Movimiento por arrastre y por toque-toque, targets ≥44 px (RNF-1).
- Modo a ciegas: piezas fantasma al 25% de opacidad → solo coordenadas (RF-6.5).

## 4. Layouts responsive

| Contexto | Composición |
|---|---|
| Celular vertical (<640 px) | Tablero arriba a ancho completo; panel de acción abajo; navegación inferior de 4 ítems: Hoy / Jugar / Cálculo / Panel |
| Celular horizontal / tablet (640–1024) | Tablero a la izquierda (≤60%), panel a la derecha; navegación colapsada |
| Escritorio (>1024) | Tablero centrado (máx. 640 px), panel contextual a la derecha, navegación lateral izquierda fina |

Rotación re-acomoda sin recargar (RNF-1); entrada por teclado en notación algebraica en escritorio.

La navegación persiste cada destino como hash (`#/hoy`, `#/jugar`, `#/calculo`, `#/panel`) para admitir enlaces directos, recarga e historial aun bajo GitHub Pages. Al cambiar de pantalla, el contenido vuelve arriba y el foco pasa al título principal. En celular, el destino activo combina fondo, texto y una barra superior: nunca depende solo del color.

### 4.1 Pantalla "Tu sesión de hoy" (decisión)
Layout **"bloque héroe"** (validado en prototipo, 2026-07): el siguiente bloque de la sesión es una tarjeta destacada con borde `accent`, su porqué y el único botón primario de la pantalla ("Empezar sesión"); los bloques restantes se listan debajo como tarjetas secundarias. Encabezado: fecha en `font-mono` tertiary + título en `font-display` + duración total. En celular el héroe y su CTA aparecen antes de cualquier bloque de constancia, plan semanal o recordatorio: la acción diaria debe entrar en el primer viewport. Alternativa "línea de tiempo" descartada como default; queda documentada como variante B en el prototipo (`docs/prototipos/sesion-de-hoy.dc.html`).

Para un perfil nuevo, el diagnóstico ocupa ese mismo lugar prioritario con una bienvenida editorial: estimación honesta de 20–40 minutos, recorrido numerado (dos partidas sin reloj + 20 posiciones del Radar), aviso local-first y salida secundaria no bloqueante. Durante el recorrido se muestra progreso global 1/3–3/3; puede pausarse y reanudarse sin perder la etapa actual mientras la pestaña siga abierta. La interfaz no presenta esa pausa en memoria como persistencia entre recargas.

### 4.2 Flujo del Radar (validado en prototipo)
1. Evaluación rápida (EvalPicker) con el tablero en solo lectura — "¿Cómo está la posición?".
2. Jugada por toque-toque con destinos legales marcados.
3. (Muestreo 1 de 4–5) ConfidenceSlider antes de revelar.
4. FeedbackPanel con porqué obligatorio + nota de Cola si hubo fallo; jugada del usuario y jugada correcta reveladas con velos `success`/`error` sobre el tablero.
5. Cierre de bloque: resumen sobrio en `font-display`, sin confeti.

### 4.3 Panel

El Panel separa tres intenciones mediante un control segmentado:

- **Resumen:** verdad, próximo paso y actividad. El próximo paso aparece inmediatamente después de las métricas principales en celular y en la columna derecha en escritorio.
- **Medición:** transferencia, experimento N=1 y señales de sobreajuste.
- **Partidas y datos:** historial, análisis pendiente, importación, exportación y restauración.

Cada vista conserva una sola acción primaria. En escritorio puede aprovechar hasta dos columnas; en celular mantiene una secuencia vertical guiada por prioridad.

### 4.4 Carga y recuperación asíncronas

- Una carga inicial reserva la geometría del contenido final con skeletons de la misma familia visual; no usa una pantalla vacía ni desplaza la estructura al resolver.
- `status` y `aria-busy` anuncian la espera sin robar el foco. Tras 4 segundos se explica la demora y aparece un reintento manual; el error usa `alert` y conserva una salida recuperable.
- El Panel carga cada fuente de datos de forma independiente. Un repositorio lento o fallido solo reemplaza su sección; el resto de las métricas permanece visible y los datos previos se conservan durante una recarga.
- Los arranques que dependen del motor o del almacenamiento vuelven a un estado estable si fallan y ofrecen reintento; nunca dejan un tablero o botón aparentemente listo pero inerte.

## 5. Componentes núcleo

Cada componente lista sus **estados obligatorios**; un componente sin todos sus estados especificados no se considera terminado.

| Componente | Estados obligatorios | Notas de diseño |
|---|---|---|
| `Board` | interactivo / solo lectura / a ciegas | envoltorio de chessground; ver §3 |
| `Button` | default / hover / pressed / focus / disabled | primario (accent pleno, único por pantalla), secundario (borde), peligro (fondo `-subtle`, para acciones irreversibles como rendirse) |
| `SegmentedControl` | default / seleccionado / focus | selección mutuamente excluyente con semántica `radiogroup`, foco único y flechas/Home/End; `accent-subtle` + borde `accent`, nunca relleno pleno |
| `WeeklyPlanCard` | sin actividad / en curso / cumplido / editando | barra por sesiones, minutos como contexto; cumplido usa `success-subtle`, edición siempre secundaria al CTA de la sesión |
| `SessionCard` | pendiente / en curso / completado / salteado | siempre con su porqué en `text-secondary`; en curso = borde `accent`; completado = tachado + opacidad .75; salteado = borde punteado |
| `EvalPicker` | default / seleccionado | 3 chips "mejor blancas / igual / mejor negras" (RF-5.2, evaluación rápida del Radar antes de jugar); selección = `accent-subtle` + borde `accent` |
| `EvalScalePicker` | default / seleccionado | 5 chips `+− ± = ∓ −+` en `font-mono` (RF-3.1c, escala de evaluación de la fase 1 del análisis); mismo criterio de selección que `EvalPicker` |
| `ConfidenceSlider` | default / arrastrando / confirmado | 0–100, aparece solo por muestreo; nunca descartable |
| `FeedbackPanel` | acierto / fallo / no-había-táctica (info) | fondo `-subtle` + borde 35%; el porqué es obligatorio, también sin táctica (RF-5.3) |
| `MoveList` | default / jugada activa / colapsado (celular) | `font-mono`; error grave/error/imprecisión con marca de color |
| `EvalGraph` | default / con marcadores usuario vs motor | línea `info`; errores como puntos `error` |
| `TruthPanel` | con datos / sin datos suficientes | números en `font-display` 44; lectura en lenguaje claro debajo |
| `ActivityPanel` | siempre secundario | chico, sin celebración, `text-secondary` |
| `LineComposer` | ingresando / ply inválido / línea completa | validación de legalidad por ply; plies en `font-mono` |
| `Toast` | informativo / error | nunca celebración; fondo `bg-elevated` + borde |

## 6. Voz y tono
Español rioplatense, directo, sin exclamaciones infladas. Los porqués citan datos del usuario ("tus errores graves en finales triplican tu promedio"), no motivación vacía. Los estados vacíos explican qué hacer.

## 7. Proceso de cambio
(1) ¿existe token? usarlo; (2) ¿no existe? proponerlo acá vía pull request; (3) nunca valores sueltos en componentes. Excepciones = deuda registrada en el changelog.
