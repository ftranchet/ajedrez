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

/** Un único final en el catálogo, para que la lista y las prescripciones sean
 * deterministas. Espera el sembrado de fondo antes de pisar la tabla. */
async function seedFinalUnico(page: Page) {
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
          objetivo: 'coronar',
        });
        tx.objectStore('curriculumDatasetMeta').put({
          id: 'catalogo', version: 'curriculo-patrones-finales-v4', seededAt: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
}

async function seedProfileDiagnosticado(page: Page) {
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const tx = request.result.transaction('profile', 'readwrite');
        tx.objectStore('profile').put({ id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: new Date().toISOString() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
}

test('finales: promocionar contra Stockfish registra una demostración limpia', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedFinalUnico(page);

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

// RF-6.2: los finales dejan de estar "descolgados" en Jugar — Hoy los surge con
// un enlace directo cuando hay técnicas pendientes.
test('finales: Hoy los surge con un enlace directo al modo finales', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedProfileDiagnosticado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  // Los finales aparecen entre las prescripciones de hoy (hay técnicas nuevas,
  // todas pendientes), con su enlace directo.
  await page.getByRole('heading', { name: 'También te toca hoy' }).waitFor();
  await page.getByRole('link', { name: /Finales teóricos/ }).click();

  // El enlace entra directo al modo finales (deep-link #/jugar/finales).
  await expect(page).toHaveURL(/#\/jugar\/finales$/);
  await page.getByRole('radio', { name: 'Finales teóricos' }).waitFor();
  await expect(page.getByText('Mate de rey y torre contra rey')).toBeVisible();
});

// RF-11.3a: la prescripción de finales tenía el estado 'pendiente' escrito a
// mano, así que jugar uno no cambiaba nada en Hoy — decía "hoy te toca
// demostrar N técnicas" con las de hoy ya jugadas (reporte de uso 2026-07-29).
test('finales: jugar el final del día lo marca como cumplido en Hoy', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedFinalUnico(page);
  await seedProfileDiagnosticado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  // Antes de jugarlo: prescripción pendiente, con su enlace.
  await expect(page.getByText('Hoy te toca demostrar 1 técnica(s)')).toBeVisible();
  await page.getByRole('link', { name: /Finales teóricos/ }).click();
  await page.getByRole('button', { name: 'Jugar este final' }).click();

  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 30_000 });
  await page.getByText('Te toca').waitFor({ timeout: 30_000 });
  await clickSquare(page, board, 'a', 7);
  await clickSquare(page, board, 'a', 8);
  await page.getByRole('dialog', { name: 'Elegí la pieza de promoción' }).getByRole('button', { name: 'q' }).click();
  await page.getByText('Técnica demostrada').waitFor();

  // Al volver a Hoy, la prescripción reconoce lo hecho.
  await page.locator('nav:visible button', { hasText: 'Hoy' }).first().click();
  await page.getByText('Tu sesión de hoy').waitFor();
  await expect(page.getByText('Jugaste 1 hoy')).toBeVisible();
  await expect(page.getByText('Hoy te toca demostrar')).toHaveCount(0);
});
