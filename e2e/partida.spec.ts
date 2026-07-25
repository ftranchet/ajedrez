// E2E del criterio de salida de Fase 0 (roadmap): en celular y en
// computadora se juega contra el motor, la partida queda guardada y
// sobrevive a la recarga. Corre sobre el build de producción (preview),
// también con BASE_PATH=/ajedrez/ para cubrir GitHub Pages.
import { expect, test, type Locator, type Page } from '@playwright/test';

async function clickSquare(page: Page, board: Locator, file: string, rank: number) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Tablero sin bounding box');
  const x = box.x + (('abcdefgh'.indexOf(file) + 0.5) * box.width) / 8;
  const y = box.y + ((8 - rank + 0.5) * box.height) / 8;
  await page.mouse.click(x, y);
}

async function empezarPartida(page: Page) {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.locator('nav:visible button', { hasText: 'Jugar' }).first().click();
  await page.getByRole('button', { name: 'Empezar partida' }).click();
  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 30_000 });
  await page.getByText('Te toca').waitFor({ timeout: 30_000 });
  return board;
}

async function esperarRespuestaDelMotor(page: Page) {
  // La primera fila de la lista muestra jugada blanca y negra: "1. e4 Nf6"
  await page.waitForFunction(
    () => {
      const li = document.querySelector('ol li');
      return li ? (li.textContent ?? '').trim().split(/\s+/).length >= 3 : false;
    },
    undefined,
    { timeout: 30_000 },
  );
}

test.describe('partida contra el motor', () => {
  test('celular: jugar, guardar y sobrevivir a la recarga', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const board = await empezarPartida(page);

    // Las piezas Staunty cargan (la CSS se inyecta con la base correcta)
    const pieceImage = await page
      .locator('piece.pawn.white')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(pieceImage).toContain('piece/staunty/wP.svg');

    // 1.e4 por toque-toque; el motor responde
    await clickSquare(page, board, 'e', 2);
    await page.waitForTimeout(300);
    await clickSquare(page, board, 'e', 4);
    await esperarRespuestaDelMotor(page);
    await expect(page.locator('ol li').first()).toContainText('e4');

    // Rendirse → la partida queda guardada
    await page.getByRole('button', { name: 'Rendirse' }).click();
    await page.getByRole('button', { name: 'Sí, abandonar' }).click();
    await page.getByText('Partida guardada en tu dispositivo').waitFor();

    // Recargar (cierre del navegador) conserva la ruta Jugar; la partida
    // persiste y aparece al abrir Partidas y datos.
    await page.reload();
    await page.getByRole('heading', { name: 'Jugar' }).waitFor();
    await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
    await page.getByRole('radio', { name: 'Partidas y datos' }).click();
    await page.getByText('Partidas guardadas').waitFor();
    await expect(page.locator('ul li').first()).toContainText('0-1');
  });

  test('escritorio: el motor responde a 1.d4', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const board = await empezarPartida(page);
    await clickSquare(page, board, 'd', 2);
    await page.waitForTimeout(300);
    await clickSquare(page, board, 'd', 4);
    await esperarRespuestaDelMotor(page);
    await expect(page.locator('ol li').first()).toContainText('d4');
  });
});

// Entrar a Jugar y no poder volver era un callejón sin salida: los únicos
// botones durante la partida eran "Rendirse" —que guarda una derrota real y,
// al ser sin reloj, daba por cumplido el compromiso semanal— y nada más.
test('partida libre: se puede abandonar sin que quede registrada', async ({ page }) => {
  await page.goto('./#/jugar');
  await page.getByRole('heading', { name: 'Jugar' }).waitFor();
  await page.getByRole('button', { name: /Nivel 1/ }).click();
  await page.getByRole('button', { name: 'Blancas' }).click();
  await page.getByRole('button', { name: 'Empezar partida' }).click();

  await page.locator('cg-board').waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Abandonar sin guardar' }).click();
  await page.getByRole('button', { name: 'Sí' }).click();

  // Vuelve a la configuración, no a un tablero muerto.
  await expect(page.getByRole('button', { name: 'Empezar partida' })).toBeVisible();

  // Y no quedó ninguna partida guardada. Se consulta con poll porque el service
  // worker de la PWA puede recargar la página y destruir el contexto justo acá.
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open('elomax');
            request.onsuccess = () => {
              const db = request.result;
              // Si nunca se guardó una partida, la tabla puede no existir aún:
              // eso también significa cero.
              if (!db.objectStoreNames.contains('games')) {
                resolve(0);
                return;
              }
              const count = db.transaction('games').objectStore('games').count();
              count.onsuccess = () => resolve(count.result);
              count.onerror = () => reject(count.error);
            };
            request.onerror = () => reject(request.error);
          }),
      ),
    )
    .toBe(0);
});
