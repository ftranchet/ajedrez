// Modo claro/oscuro (design system §2.1): el toggle vive en Ajustes, se aplica
// al instante, persiste sin parpadeo y "Sistema" sigue al sistema operativo.
import { expect, test } from '@playwright/test';

test('tema: el toggle de Ajustes cambia el tema, persiste y "Sistema" sigue al SO', async ({ page }) => {
  // Sin preferencia guardada, sigue al sistema; emulamos un SO en claro.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./#/ajustes');
  await page.getByRole('heading', { name: 'Ajustes' }).waitFor();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Elegir "Oscuro" explícito gana sobre el sistema y persiste tras recargar.
  await page.getByRole('radio', { name: 'Oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#171310');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Oscuro' })).toBeChecked();

  // Volver a "Sistema" retoma la preferencia del SO (claro).
  await page.getByRole('radio', { name: 'Sistema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#efe6d6');
});
