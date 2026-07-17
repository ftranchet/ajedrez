# Prototipos del design system

Artefactos de validación visual del design system v2 (julio 2026). **No son código del producto**: ilustran las decisiones; la fuente de verdad es `docs/design-system.md`, y ante cualquier divergencia gana el documento.

| Archivo | Qué es |
|---|---|
| `design-system.dc.html` | Referencia visual renderizada: tokens de color, tipografía, tablero con estados (§2–3 del design system) |
| `sesion-de-hoy.dc.html` | Prototipo interactivo del flujo "Tu sesión de hoy" → Radar (§4.1–4.2); incluye el selector A/B entre el layout "bloque héroe" (elegido) y la variante "línea de tiempo" (descartada) |
| `support.js` | Runtime generado que renderiza los `.dc.html` (no editar a mano) |
| `ios-frame.jsx` | Componente de marco de dispositivo iOS usado por el prototipo interactivo |

**Cómo verlos:** abrir el `.dc.html` en un navegador. Requieren conexión (React, Babel y las fuentes se cargan desde CDN) y deben abrirse desde esta carpeta dentro del repo: las piezas del tablero se cargan por ruta relativa desde `public/piece/staunty/`.
