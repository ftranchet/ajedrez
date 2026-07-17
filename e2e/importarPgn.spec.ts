// E2E de RF-2.2 (E2, Fase 2): importar un PGN pegado a mano — la única vía de
// importación de historial que no depende de red (Lichess/Chess.com quedan
// bloqueados en este entorno sin acceso a esas APIs). Un PGN inválido no
// rompe nada y avisa; uno válido aparece en el Panel listo para analizar.
import { expect, test } from '@playwright/test';

const PGN_VALIDO = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';

test('importar PGN: un texto inválido avisa y un PGN válido aparece en el Panel', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
  await page.getByText('Importar PGN').waitFor();

  // Texto inválido: no debe crear ninguna partida ni romper la pantalla.
  await page.locator('textarea').fill('esto no es un pgn');
  await page.getByRole('button', { name: 'Importar partida' }).click();
  await page.getByText('Ese texto no es un PGN válido.').waitFor();
  await expect(page.getByText('Todavía no jugaste ninguna partida')).toBeVisible();

  // PGN válido con ritmo "Clásica" elegido a mano.
  await page.locator('textarea').fill(PGN_VALIDO);
  await page.getByRole('button', { name: 'Clásica' }).click();
  await page.getByRole('button', { name: 'Importar partida' }).click();
  await page.getByText('Partida importada.').waitFor();

  // La partida aparece en la lista, sin analizar todavía, y el formulario se vació.
  await expect(page.locator('textarea')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Analizar' })).toBeVisible();
});
