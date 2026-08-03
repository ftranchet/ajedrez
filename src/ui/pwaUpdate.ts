// Actualización del service worker sin interrumpir lo que se está haciendo.
//
// **El problema que corrige.** El plugin estaba en `registerType: 'autoUpdate'`,
// que hace `skipWaiting` + `clients.claim` en cuanto termina de bajar una
// versión nueva: la pestaña se recarga sola. A mitad de una sesión eso es una
// interrupción cara — el store vive en memoria, así que la corrida se corta, el
// registro de sesión queda colgado y el usuario ve el contador de repasos
// volver a empezar contra lo que faltaba. Dos de los tres bugs reportados el
// 2026-08-04 tienen esto como causa probable.
//
// **La decisión.** Se conserva la actualización automática —nadie debería tener
// que pensar en versiones de una PWA— pero se aplica cuando **no molesta**: la
// versión nueva queda esperando y entra en el primer momento en que la app está
// ociosa. Si nunca lo está, entra igual al cerrar y volver a abrir, que es como
// se comportaba antes de que el service worker existiera.
//
// La alternativa —un cartel de "hay una versión nueva, recargá"— se descartó:
// traslada al usuario una decisión que no puede tomar con información (no sabe
// qué cambia ni si le conviene) y agrega ruido permanente a una pantalla que
// intenta no tener ninguno.
import { registerSW } from 'virtual:pwa-register';

/** Aplica la actualización pendiente, si la hay. La deja lista el registro. */
let aplicar: (() => Promise<void>) | null = null;
let pendiente = false;

/** ¿Hay una versión nueva esperando a que la app esté ociosa? */
export function hayActualizacionPendiente(): boolean {
  return pendiente;
}

/**
 * Aplica la actualización si hay una pendiente. Recarga la pestaña, así que el
 * llamador es responsable de invocarla solo cuando no haya nada en curso.
 */
export function aplicarActualizacionPendiente(): void {
  if (!pendiente || !aplicar) return;
  pendiente = false;
  // `updateSW(true)` activa el worker nuevo y recarga; un fallo no puede
  // romper la app: se queda con la versión vieja hasta el próximo arranque.
  void aplicar().catch(() => undefined);
}

/**
 * Registra el service worker y engancha la actualización a `estaOcioso`, que
 * se consulta cada vez que llega una versión nueva y cada vez que el estado de
 * la app cambia (ver `observarOcio`).
 */
export function registrarActualizacionDiferida(estaOcioso: () => boolean): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendiente = true;
      if (estaOcioso()) aplicarActualizacionPendiente();
    },
  });
  aplicar = () => updateSW(true);
}
