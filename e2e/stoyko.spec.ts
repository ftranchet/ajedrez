// E2E de Stoyko semanal (E7, RF-7.2): se anotan candidatas antes de revelar
// y se compara con la línea del motor. La lógica (acierto, enfriamiento) ya
// está probada en core/stoyko.test.ts y src/ui/state/stoykoStore.test.ts —
// acá se verifica que la UI (sub-modo de "Cálculo") está bien conectada.
import { test, type Page } from '@playwright/test';
import { STOYKO_DATASET_VERSION } from '../src/services/puzzles/stoykoSeedData';

// Mismo fixture (posición y línea) que stoykoStore.test.ts, ya verificado
// con chess.js: 1.e4 e5 2.Nf3 Nc6, y la línea 3.Bc4 Bc5 4. O-O.
const fixture = {
  id: 'e2e-stoyko-1',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  mejorLinea: ['f1c4', 'f8c5', 'e1g1'],
  evaluacionMotor: '=',
  fuente: 'seed-dev',
};

async function seedStoykoFixture(page: Page) {
  await page.evaluate(
    ({ item, version }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['stoykoItems', 'stoykoDatasetMeta'], 'readwrite');
          transaction.objectStore('stoykoItems').clear();
          transaction.objectStore('stoykoItems').put(item);
          transaction.objectStore('stoykoDatasetMeta').put({ id: 'catalogo', version, seededAt: new Date().toISOString() });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      }),
    { item: fixture, version: STOYKO_DATASET_VERSION },
  );
}

test('Stoyko semanal: anotar la jugada del motor entre las candidatas acierta y revela la línea', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedStoykoFixture(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.locator('nav:visible button', { hasText: 'Cálculo' }).first().click();
  await page.getByRole('radio', { name: 'Stoyko semanal' }).click();

  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 15_000 });

  // Anota dos candidatas: una que no es, y la que coincide con la línea del motor.
  await page.getByPlaceholder('p. ej. e2e4').fill('b1c3');
  await page.getByRole('button', { name: 'Agregar candidata' }).click();
  await page.getByPlaceholder('p. ej. e2e4').fill('f1c4');
  await page.getByRole('button', { name: 'Agregar candidata' }).click();
  await page.getByText('b1c3').waitFor();
  await page.getByText('f1c4').waitFor();

  await page.getByRole('button', { name: 'Terminar análisis' }).click();
  await page.getByText('¿Qué tan segura/o estás de haber tenido la mejor jugada').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Confirmar' }).click();

  await page.getByText('La tenías entre tus candidatas').waitFor({ timeout: 10_000 });
  await page.getByText('Bc4 Bc5 O-O').waitFor();
});

test('Stoyko semanal: ya hecho esta semana, avisa el enfriamiento en vez de servir una posición', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('profile', 'readwrite');
          tx.objectStore('profile').put({ id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: new Date().toISOString(), stoykoUltimaCompletadaEn: new Date().toISOString() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  await seedStoykoFixture(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.locator('nav:visible button', { hasText: 'Cálculo' }).first().click();
  await page.getByRole('radio', { name: 'Stoyko semanal' }).click();

  await page.getByText('Ya hiciste tu Stoyko de esta semana').waitFor({ timeout: 10_000 });
});
