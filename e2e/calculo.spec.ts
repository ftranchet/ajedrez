// E2E de Cálculo comprometido (E7, RF-7.1): la línea completa se declara
// por escrito antes de revelar. La lógica de puntuación (línea entera, no
// solo la primera jugada) ya está probada en core/compromiso.test.ts y
// src/ui/state/compromisoStore.test.ts — acá se verifica que la UI (nueva
// pestaña de navegación) está bien conectada.
import { test, type Page } from '@playwright/test';
import { RADAR_DATASET_VERSION } from '../src/services/puzzles/seedData';

// Mismo fixture (posición y línea) que compromisoStore.test.ts, ya
// verificado con chess.js: 1.e4 e5 2.Nf3 Nc6, y la línea 3.Bc4 Bc5 4. O-O.
const fixture = {
  id: 'e2e-compromiso-1',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  tipo: 'ofensiva',
  temas: ['fixture-e2e'],
  rating: 1400,
  solucion: ['f1c4', 'f8c5', 'e1g1'],
  fuente: 'seed-dev',
};

async function seedRadarFixture(page: Page) {
  await page.evaluate(
    ({ item, version }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['radarItems', 'radarDatasetMeta'], 'readwrite');
          transaction.objectStore('radarItems').clear();
          transaction.objectStore('radarItems').put(item);
          transaction.objectStore('radarDatasetMeta').put({ id: 'catalogo', version, seededAt: new Date().toISOString() });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      }),
    { item: fixture, version: RADAR_DATASET_VERSION },
  );
}

test('cálculo comprometido: declarar la línea completa revela y puntúa entera', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedRadarFixture(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.locator('nav:visible button', { hasText: 'Cálculo' }).first().click();
  await page.getByText('Jugada 1 de 3').waitFor({ timeout: 15_000 });

  const board = page.locator('cg-board');
  await board.waitFor();

  for (const jugada of fixture.solucion) {
    await page.getByPlaceholder('p. ej. e2e4').fill(jugada);
    await page.getByRole('button', { name: 'Agregar jugada' }).click();
  }

  await page.getByText('Línea correcta').waitFor({ timeout: 10_000 });
  await page.getByText('Bc4 Bc5 O-O').waitFor();
});
