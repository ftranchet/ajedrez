// E2E del ejercicio de cálculo declarado (E7, RF-7.1/RF-7.2, ADR-0016): se
// declaran candidatas —las dos primeras con su línea— antes de revelar, y se
// comparan con el motor. La lógica (las tres varas, el enfriamiento) ya está
// probada en core/calculo.test.ts y src/ui/state/stoykoStore.test.ts — acá se
// verifica que la UI está bien conectada.
//
// Un solo ejercicio desde ADR-0016: la pestaña "Cálculo" entra directo, sin
// selector de modo. Este archivo absorbió el e2e del preset corto, que se
// retiró con él.
import { expect, test, type Page } from '@playwright/test';
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

test('cálculo: anotar la jugada del motor entre las candidatas acierta y revela la línea', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedStoykoFixture(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.locator('nav:visible button', { hasText: 'Cálculo' }).first().click();

  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 15_000 });

  // Dos candidatas con su línea: la primera no es la del motor, la segunda sí.
  // Cada ply se carga por separado — la mecánica que traía la pestaña corta.
  const declararRama = async (plies: string[]) => {
    for (const ply of plies) {
      await page.getByPlaceholder('p. ej. e2e4').fill(ply);
      await page.getByRole('button', { name: 'Sumar jugada' }).click();
    }
    await page.getByRole('button', { name: 'Cerrar esta candidata' }).click();
  };

  // Con un solo ply la primera rama no se puede cerrar: pide línea.
  await page.getByPlaceholder('p. ej. e2e4').fill('b1c3');
  await page.getByRole('button', { name: 'Sumar jugada' }).click();
  await page.getByRole('button', { name: 'Cerrar esta candidata' }).click();
  await expect(page.getByText(/Esta rama pide al menos 2 jugada/)).toBeVisible();

  await page.getByPlaceholder('p. ej. e2e4').fill('g8f6');
  await page.getByRole('button', { name: 'Sumar jugada' }).click();
  await page.getByRole('button', { name: 'Cerrar esta candidata' }).click();
  await expect(page.getByText('b1c3 g8f6')).toBeVisible();

  await declararRama(['f1c4', 'f8c5', 'e1g1']);
  await expect(page.getByText('f1c4 f8c5 e1g1')).toBeVisible();

  await page.getByRole('button', { name: 'Terminar análisis' }).click();
  await page.getByText('¿Cuánta confianza tenés en haber incluido la mejor jugada').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Confirmar' }).click();

  await page.getByText('La tenías entre tus candidatas').waitFor({ timeout: 10_000 });
  await page.getByText('Bc4 Bc5 O-O').waitFor();
  // Las tres varas se leen por separado (ADR-0015): la profundidad vista y la
  // brecha contra la evaluación del motor, que antes se descartaba.
  await expect(page.getByText(/viste 3 jugada/)).toBeVisible();
  await expect(page.getByText('Tu evaluación contra la del motor')).toBeVisible();
});

// ADR-0016: no hay modo que elegir. Las dos rutas —la nueva y la que quedó de
// cuando #/calculo/stoyko era un deep link a la segunda pestaña— aterrizan en
// el mismo y único ejercicio, y no queda ningún selector en pantalla.
test('las dos rutas de Cálculo abren el mismo ejercicio, sin selector de modo', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedStoykoFixture(page);

  for (const ruta of ['./#/calculo', './#/calculo/stoyko']) {
    await page.goto(ruta);
    await expect(page.getByText('Anotás todas tus candidatas', { exact: false })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
  }
});

test('cálculo: ya hecho esta semana, avisa el enfriamiento en vez de servir una posición', async ({ page }) => {
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

  await page.getByText('Ya hiciste tu cálculo de esta semana').waitFor({ timeout: 10_000 });
});
