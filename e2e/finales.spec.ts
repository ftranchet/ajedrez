// RF-6.2/RF-6.3: un final se juega en el tablero contra el motor y una
// conversión limpia actualiza el progreso espaciado del currículo.
import { expect, test, type Locator, type Page } from '@playwright/test';

async function clickSquare(page: Page, board: Locator, file: string, rank: number) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Tablero sin bounding box');
  const x = box.x + (('abcdefgh'.indexOf(file) + 0.5) * box.width) / 8;
  const y = box.y + ((8 - rank + 0.5) * box.height) / 8;
  await page.mouse.click(x, y);
}

test('finales: promocionar contra Stockfish registra una demostración limpia', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  // Hoy siembra el catálogo en segundo plano. Esperar el meta evita que esa
  // transacción pise el fixture cuando la suite corre con varios workers.
  await page.waitForFunction(() =>
    new Promise<boolean>((resolve) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const get = request.result.transaction('curriculumDatasetMeta').objectStore('curriculumDatasetMeta').get('catalogo');
        get.onsuccess = () => resolve(Boolean(get.result));
        get.onerror = () => resolve(false);
      };
      request.onerror = () => resolve(false);
    }),
  );
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction(['curriculumItems', 'curriculumDatasetMeta', 'curriculumProgress'], 'readwrite');
        tx.objectStore('curriculumItems').clear();
        tx.objectStore('curriculumProgress').clear();
        tx.objectStore('curriculumItems').put({
          id: 'e2e-final-promocion', tipo: 'final', patternKey: 'final-cuadrado', nombre: 'Final de promoción',
          fen: '8/P7/8/8/8/8/4k3/7K w - - 0 1', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w',
        });
        tx.objectStore('curriculumDatasetMeta').put({
          id: 'catalogo', version: 'curriculo-patrones-finales-v3', seededAt: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );

  await page.locator('nav:visible button', { hasText: 'Jugar' }).first().click();
  await page.getByRole('radio', { name: 'Finales teóricos' }).click();
  await page.getByText('Final de promoción').waitFor();
  await page.getByRole('button', { name: 'Jugar este final' }).click();

  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 30_000 });
  await page.getByText('Te toca').waitFor({ timeout: 30_000 });
  await clickSquare(page, board, 'a', 7);
  await clickSquare(page, board, 'a', 8);
  await page.getByRole('dialog', { name: 'Elegí la pieza de promoción' }).getByRole('button', { name: 'q' }).click();

  await page.getByText('Técnica demostrada').waitFor();
  const progress = await page.evaluate(() =>
    new Promise<number | undefined>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const get = request.result.transaction('curriculumProgress').objectStore('curriculumProgress').get('e2e-final-promocion');
        get.onsuccess = () => resolve(get.result?.demostracionesLimpias);
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
  expect(progress).toBe(1);
});
