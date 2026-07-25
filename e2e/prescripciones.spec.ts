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

test('Hoy prescribe los ejercicios que se hacen en otra pantalla, con su porqué', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedProfileDiagnosticado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.getByRole('heading', { name: 'También te toca hoy' }).waitFor();

  // La partida lenta encabeza: es el ejercicio con más respaldo documentado.
  const prescripciones = page.locator('li a, li div').filter({ hasText: /min|Ya lo hiciste/ });
  await expect(page.getByRole('link', { name: /Tu partida lenta de la semana/ })).toBeVisible();
  await expect(prescripciones.first()).toContainText('Tu partida lenta de la semana');

  // Stoyko deja de descubrirse solo entrando a la pestaña Cálculo.
  const stoyko = page.getByRole('link', { name: /Stoyko de la semana/ });
  await expect(stoyko).toBeVisible();
  await stoyko.click();
  await expect(page).toHaveURL(/#\/calculo$/);
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
