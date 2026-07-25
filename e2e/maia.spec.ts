// E2E de la conexión con Maia (RF-1.4, ADR-0004/0014).
//
// Lo que se puede verificar sin red: que el modo exista, que sin token guíe a
// conectarse en vez de fallar, que la limitación del reloj esté dicha, y que el
// token nunca salga del dispositivo dentro de la exportación. Jugar de verdad
// contra el bot exige `lichess.org`, que no es alcanzable desde CI — esa parte
// la verifica una persona en su navegador (ver docs/maia-prueba.md).
import { expect, test } from '@playwright/test';

test('Maia: sin token conectado, guía a Ajustes en vez de fallar', async ({ page }) => {
  await page.goto('./#/jugar/maia');
  await page.getByRole('heading', { name: 'Partida contra Maia' }).waitFor();

  await expect(page.getByText('Maia aprende de partidas humanas', { exact: false })).toBeVisible();
  await expect(page.getByText('Para jugar contra Maia hace falta conectar tu cuenta de Lichess.')).toBeVisible();

  await page.getByRole('link', { name: 'Conectar Lichess en Ajustes' }).click();
  await expect(page).toHaveURL(/#\/ajustes$/);
  await page.getByRole('heading', { name: 'Tu cuenta de Lichess' }).waitFor();
});

test('Maia: el token se declara device-local y fuera de la exportación', async ({ page }) => {
  await page.goto('./#/ajustes');
  await page.getByRole('heading', { name: 'Tu cuenta de Lichess' }).waitFor();

  // La promesa de privacidad es parte del producto, no una nota al pie: un
  // respaldo es un archivo para mover y compartir.
  await expect(page.getByText('NO entra en la exportación de tus datos', { exact: false })).toBeVisible();

  // Que el token no viaje en el paquete se comprueba en core/exportData.test.ts,
  // donde se puede inspeccionar el bundle sin depender del empaquetado.
});

test('Maia: es un modo más de Jugar, alcanzable desde el selector', async ({ page }) => {
  await page.goto('./#/jugar');
  await page.getByRole('heading', { name: 'Jugar' }).waitFor();

  await page.getByRole('radio', { name: 'Maia' }).click();
  await expect(page).toHaveURL(/#\/jugar\/maia$/);

  // La incoherencia del reloj se declara: la app juega sin reloj, Lichess exige uno.
  await expect(page.getByText('Lichess exige reloj', { exact: false })).toBeVisible();
});
