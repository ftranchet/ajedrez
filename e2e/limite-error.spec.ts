// R1: una excepción al dibujar una pantalla no deja la app en blanco. Se rompe
// a propósito el render de Ajustes —su plan semanal fecha las semanas con
// `toLocaleDateString`— y se comprueba que siguen andando la exportación, la
// navegación y la vuelta a Hoy. Corre también bajo /ajedrez/ en CI.
import { expect, test, type Page } from '@playwright/test';

const ROMPER = 'e2e-romper-render';

async function romperRender(page: Page, romper: boolean) {
  await page.evaluate(
    ([clave, activo]) => (activo ? window.sessionStorage.setItem(clave, '1') : window.sessionStorage.removeItem(clave)),
    [ROMPER, romper] as const,
  );
}

test('un error al dibujar una pantalla deja exportar, navegar y volver a Hoy', async ({ page }) => {
  await page.addInitScript((clave) => {
    const original = Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString = function (this: Date, ...args: Parameters<Date['toLocaleDateString']>) {
      if (window.sessionStorage.getItem(clave) === '1') throw new Error('render roto a propósito (e2e)');
      return original.apply(this, args);
    };
  }, ROMPER);
  await page.goto('./');
  await page.getByRole('heading', { name: 'Tu sesión de hoy', exact: true }).waitFor();

  await romperRender(page, true);
  await page.locator('button[aria-label="Ajustes"]:visible').click();
  const titulo = page.getByRole('heading', { name: 'Esta pantalla no se pudo mostrar', exact: true });
  await expect(titulo).toBeVisible();
  await expect(titulo).toBeFocused();

  // Exportar no pasa por ningún store: lee la base directo.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar mis datos' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^elomax-export-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByText('Descarga lista')).toBeVisible();

  // La navegación quedó en pie, y la otra pantalla se dibuja limpia.
  await romperRender(page, false);
  await page.locator('nav:visible button', { hasText: 'Jugar' }).first().click();
  await expect(page.getByRole('heading', { name: 'Jugar', exact: true })).toBeVisible();

  // "Volver a Hoy" recarga la app desde lo guardado.
  await romperRender(page, true);
  await page.locator('button[aria-label="Ajustes"]:visible').click();
  await titulo.waitFor();
  await romperRender(page, false);
  await page.getByRole('button', { name: 'Volver a Hoy' }).click();
  await expect(page).toHaveURL(/#\/hoy$/);
  await page.getByRole('heading', { name: 'Tu sesión de hoy', exact: true }).waitFor();
});
