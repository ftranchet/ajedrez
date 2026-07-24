// E2E del modificador a ciegas progresivo del currículo (E6, RF-6.5): sobre
// un patrón con más de 80% de acierto histórico, el tablero pasa a piezas
// fantasma (opacidad reducida) mientras se está jugando. El umbral y la
// progresión en sí ya están probados en core/curriculum.test.ts — acá se
// verifica que la UI aplica el modificador sobre el ítem servido.
import { expect, test, type Page } from '@playwright/test';
import { seedCurriculumItems } from '../src/services/puzzles/curriculumSeedData';

const OBJETIVO = 'patron-mate-pasillo-1';

// El resto del catálogo se marca automatizado para que el único patrón
// vencido sea el objetivo: determinístico, sin depender del orden de Dexie.
async function seedCurriculumConFantasma(page: Page) {
  await page.evaluate(
    ({ objetivoId, otrosIds }: { objetivoId: string; otrosIds: string[] }) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('elomax');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('curriculumProgress', 'readwrite');
          const fsrsAutomatizado = {
            due: '2020-01-01T00:00:00.000Z',
            stability: 5,
            difficulty: 5,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 3,
            lapses: 0,
            learningSteps: 0,
            state: 'review',
            lastReview: '2020-01-01T00:00:00.000Z',
          };
          for (const id of otrosIds) {
            tx.objectStore('curriculumProgress').put({ id, fsrs: fsrsAutomatizado, demostracionesLimpias: 3, updatedAt: '2020-01-01T00:00:00.000Z' });
          }
          // 5/6 ≈ 83% de acierto (> 80%), con 1 demostración limpia seguida: "fantasma".
          tx.objectStore('curriculumProgress').put({
            id: objetivoId,
            fsrs: { ...fsrsAutomatizado, reps: 6, lapses: 1 },
            demostracionesLimpias: 1,
            updatedAt: '2020-01-01T00:00:00.000Z',
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { objetivoId: OBJETIVO, otrosIds: seedCurriculumItems.map((i) => i.id).filter((id) => id !== OBJETIVO) },
  );
}

async function seedProfileDiagnosticado(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('profile', 'readwrite');
          tx.objectStore('profile').put({ id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: new Date().toISOString() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

test('modificador a ciegas: un patrón con acierto sostenido se sirve con piezas fantasma', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedCurriculumConFantasma(page);
  await seedProfileDiagnosticado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.getByRole('button', { name: 'Empezar sesión' }).click();
  await page.getByText('Patrón 1 de 1').waitFor({ timeout: 15_000 });
  await page.getByText('Piezas atenuadas a propósito').waitFor();

  const board = page.locator('cg-board');
  await board.waitFor();
  const opacidad = await page.locator('piece').first().evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacidad)).toBeLessThan(0.5);
});
