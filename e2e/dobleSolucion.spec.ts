// E2E de doble solución (E5, RF-5.7): conformarse con la jugada familiar
// cuenta como acierto (no genera tarjeta de error) pero avisa que había una
// superior. La clasificación en sí ya está probada en
// core/dobleSolucion.test.ts y sessionStore.dobleSolucion.test.ts — acá se
// verifica que la UI está bien conectada.
import { test, type Page } from '@playwright/test';
import { RADAR_DATASET_VERSION } from '../src/services/puzzles/seedData';
import { seedCurriculumItems } from '../src/services/puzzles/curriculumSeedData';

// Mismo fixture (posición y jugadas) que sessionStore.dobleSolucion.test.ts,
// ya verificado con chess.js.
const fixture = {
  id: 'e2e-dobsol-1',
  fen: 'r3k2r/ppp2ppp/2b5/3QP3/4n2q/B1P3P1/P1P2P1P/R3KB1R w KQkq - 1 12',
  tipo: 'ofensiva',
  temas: ['fixture-e2e'],
  rating: 1500,
  solucion: ['d5c6'],
  fuente: 'pipeline-doble-solucion',
  dobleSolucion: { familiar: 'f1b5' },
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

// Igual que en sesion.spec.ts/triage.spec.ts: sin esto, el currículo (8
// patrones nuevos) se interpondría antes del ítem del Radar que este spec
// quiere probar.
async function seedCurriculumAutomatizado(page: Page) {
  await page.evaluate((ids: string[]) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('elomax');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('curriculumProgress', 'readwrite');
        for (const id of ids) {
          tx.objectStore('curriculumProgress').put({
            id,
            fsrs: {
              due: '2026-01-01T00:00:00.000Z',
              stability: 5,
              difficulty: 5,
              elapsedDays: 0,
              scheduledDays: 0,
              reps: 3,
              lapses: 0,
              learningSteps: 0,
              state: 'review',
              lastReview: '2026-01-01T00:00:00.000Z',
            },
            demostracionesLimpias: 3,
            updatedAt: '2026-01-01T00:00:00.000Z',
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, seedCurriculumItems.map((item) => item.id));
}

async function clickSquare(page: Page, board: ReturnType<Page['locator']>, file: string, rank: number) {
  const flipped = (await page.locator('.cg-wrap').first().getAttribute('class'))?.includes('orientation-black') ?? false;
  const box = await board.boundingBox();
  if (!box) throw new Error('Tablero sin bounding box');
  const files = 'abcdefgh';
  const col = flipped ? 7 - files.indexOf(file) : files.indexOf(file);
  const row = flipped ? rank - 1 : 8 - rank;
  await page.mouse.click(box.x + ((col + 0.5) * box.width) / 8, box.y + ((row + 0.5) * box.height) / 8);
}

test('doble solución: conformarse con la familiar acierta pero avisa que había una superior', async ({ page }) => {
  // Nunca muestrear candidatas (RF-5.8) ni confianza, para llegar directo a feedback.
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedRadarFixture(page);
  await seedCurriculumAutomatizado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.getByRole('button', { name: 'Empezar sin diagnóstico' }).click();

  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 15_000 });
  await page.getByText('¿Cómo está la posición?').waitFor();
  await page.getByRole('button', { name: 'Igual' }).click();
  await page.getByText('Ahora jugá tu respuesta').waitFor();

  // f1b5: la jugada "familiar" (gana, pero es peor que d5c6).
  await clickSquare(page, board, 'f', 1);
  await clickSquare(page, board, 'b', 5);

  await page.getByText('Acertaste').waitFor({ timeout: 10_000 });
  await page.getByText('d5c6').waitFor(); // el feedback menciona la jugada superior
});
