// E2E de las prescripciones que se hacen fuera de la sesión (E11, principio 1)
// y del catálogo de ejercicios (principio 8). Antes de esto, cuatro de los
// ejercicios con más respaldo vivían en pantallas que el Prescriptor nunca
// nombraba —Cálculo era una de las cuatro pestañas de la navegación y ninguna
// prescripción la mencionaba—, y no había forma de que el usuario distinguiera
// "no me apareció porque no me corresponde" de "no existe".
import { expect, test, type Page } from '@playwright/test';

async function seedProfileDiagnosticado(page: Page, extra: Record<string, unknown> = {}) {
  await page.evaluate(
    (perfil) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const tx = request.result.transaction('profile', 'readwrite');
          tx.objectStore('profile').put(perfil);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    { id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: new Date().toISOString(), ...extra },
  );
}

/** Fecha ISO hace `n` días, para salir de la ventana de escalonamiento inicial. */
function haceDias(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

test('Hoy prescribe los ejercicios que se hacen en otra pantalla, con su porqué', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  // Diagnóstico hace 4 días: el primer Stoyko ya salió de su espera inicial.
  await seedProfileDiagnosticado(page, { diagnosticoCompletadoEn: haceDias(4) });
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  // La partida lenta y el Stoyko son semanales por definición: van en "Esta
  // semana", no en la lista de hoy. Pedirlos todos los días es lo que hacía
  // que el primer día sumara ~83 minutos, casi el plan semanal completo.
  await page.getByRole('heading', { name: 'Esta semana' }).waitFor();
  const seccionSemanal = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Esta semana' }) });
  await expect(page.getByRole('link', { name: /Tu partida lenta de la semana/ })).toBeVisible();
  // Encabeza igual dentro de su lista: es el ejercicio con más respaldo.
  await expect(seccionSemanal.locator('li').first()).toContainText('Tu partida lenta de la semana');
  await expect(seccionSemanal).toContainText('Stoyko de la semana');

  // Lo que sí vence día a día —las técnicas de final— queda en la lista de
  // hoy, topeada al presupuesto: dos técnicas, no el catálogo entero.
  const seccionHoy = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'También te toca hoy' }) });
  await expect(seccionHoy).toContainText('Finales teóricos');
  await expect(seccionHoy).toContainText('2 técnica(s)');
  await expect(seccionHoy).not.toContainText('Tu partida lenta de la semana');

  // Stoyko deja de descubrirse solo entrando a la pestaña Cálculo. El enlace
  // tiene que aterrizar en el modo Stoyko visible, no en Línea comprometida
  // (el modo por defecto de la pantalla): comprobar solo la URL dejaba pasar
  // ese bug.
  const stoyko = page.getByRole('link', { name: /Stoyko de la semana/ });
  await expect(stoyko).toBeVisible();
  await stoyko.click();
  await expect(page).toHaveURL(/#\/calculo\/stoyko$/);
  await expect(page.getByRole('radio', { name: 'Stoyko semanal' })).toBeChecked();
  await expect(page.getByText('Stoyko semanal: anotás todas tus candidatas', { exact: false })).toBeVisible();
});

test('el primer Stoyko se escalona: recién diagnosticado, avisa cuándo se suma en vez de invitar', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  // Diagnóstico de hoy y ningún Stoyko hecho: dentro de la espera inicial.
  await seedProfileDiagnosticado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.getByRole('heading', { name: 'Esta semana' }).waitFor();
  await expect(page.getByText(/Se suma a tu plan el /)).toBeVisible();
  await expect(page.getByRole('link', { name: /Stoyko de la semana/ })).toHaveCount(0);
});

test('el plan semanal gobierna la carga: con poco tiempo declarado, los finales pasan a la semana', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  // Plan mínimo: 2 sesiones de ~8 minutos. La sesión del día ya se los come,
  // así que ninguna técnica de final entra hoy.
  await seedProfileDiagnosticado(page, {
    diagnosticoCompletadoEn: haceDias(4),
    planSemanal: { sesionesObjetivo: 2, minutosObjetivo: 16 },
  });
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.getByRole('heading', { name: 'Esta semana' }).waitFor();
  await expect(page.getByText('Finales teóricos')).toBeVisible();
  // No desaparece ni se presenta como deuda de hoy: dice por qué no es de hoy.
  await expect(page.getByText('No entra en los minutos que declaraste para hoy.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'También te toca hoy' })).toHaveCount(0);
});

test('Stoyko ya hecho esta semana sigue listado, con la fecha en que vuelve', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedProfileDiagnosticado(page, { stoykoUltimaCompletadaEn: new Date().toISOString() });
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  // En enfriamiento no invita a entrar (no es un enlace), pero se ve: el
  // usuario tiene que poder saber que el ejercicio existe y cuándo vuelve.
  await expect(page.getByText('Stoyko de la semana')).toBeVisible();
  await expect(page.getByText(/Vuelve el /)).toBeVisible();
  await expect(page.getByRole('link', { name: /Stoyko de la semana/ })).toHaveCount(0);
});

test('Ajustes explica qué ejercicios existen y qué dispara cada uno', async ({ page }) => {
  await page.goto('./#/ajustes');
  await page.getByRole('heading', { name: 'Ajustes' }).waitFor();

  await page.getByRole('heading', { name: 'Qué ejercicios existen y cuándo aparecen' }).waitFor();

  // Los que son invisibles por diseño son justamente los que hay que declarar.
  await expect(page.getByText('¿Hay algo mejor?')).toBeVisible();
  await expect(page.getByText('al azar, en aproximadamente 1 de cada 4 o 5 posiciones del Radar.')).toBeVisible();
  await expect(page.getByText('Doble solución')).toBeVisible();
  await expect(page.getByText('Nunca se avisa: avisarlo arruinaría el ejercicio.', { exact: false })).toBeVisible();
  await expect(page.getByText('Errores de tus partidas reciclados')).toBeVisible();
  await expect(page.getByText('Batería de transferencia')).toBeVisible();
});

test('conversión de ventajas: sin partidas analizadas lo dice, sin inventar posiciones', async ({ page }) => {
  await page.goto('./#/jugar/conversion');
  await page.getByRole('heading', { name: 'Conversión de ventajas' }).waitFor();

  // La limitación de RF-8.3 se declara siempre, no solo al terminar.
  await expect(page.getByText('Defendés contra el motor local, no contra una persona', { exact: false })).toBeVisible();
  await expect(page.getByText('No encontramos partidas tuyas con una ventaja clara desperdiciada.', { exact: false })).toBeVisible();

  // Es un modo más de Jugar, alcanzable por enlace directo y por el selector.
  await page.getByRole('radio', { name: 'Partida libre' }).click();
  await expect(page).toHaveURL(/#\/jugar$/);
});
