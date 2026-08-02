// Una acción asíncrona a la vez.
//
// **El problema que corrige.** Las acciones que guardan un intento hacían su
// guarda contra la fase del store (`if (s.phase !== 'confianza') return`), pero
// la fase recién cambia *después* del primer `await`. Entre el clic y ese
// cambio hay una ventana en la que un segundo clic pasa la guarda entero: dos
// calibraciones y dos intentos guardados por un solo acto del usuario. No es
// una molestia visual —contamina el Brier y el historial con observaciones que
// nunca ocurrieron—.
//
// Envolver la acción cierra la ventana en el punto correcto: la guarda deja de
// depender de un estado que todavía no se escribió. La llamada repetida no se
// descarta en silencio, devuelve la promesa en curso, así que quien la esperaba
// sigue esperando lo mismo.

/**
 * Devuelve una versión de `fn` que, mientras haya una ejecución en curso,
 * devuelve esa misma promesa en vez de arrancar otra. Se libera cuando termina,
 * con éxito o con error: un fallo no puede dejar la acción trabada.
 */
export function singleFlight<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  let enCurso: Promise<void> | null = null;
  return (...args: A) => {
    if (enCurso) return enCurso;
    const promesa = fn(...args).finally(() => {
      enCurso = null;
    });
    enCurso = promesa;
    return promesa;
  };
}
