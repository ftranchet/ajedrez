// RF-12.2: la batería se persiste y reanuda sin revelar respuestas ni
// contaminar Radar/Cola. El fixture usa el catálogo real versionado.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedTransferItems } from '../src/services/puzzles/transferSeedData';

async function clickSquare(page: Page, board: Locator, square: string, orientation: 'w' | 'b') {
  const box = await board.boundingBox();
  if (!box) throw new Error('Tablero sin bounding box');
  const file = 'abcdefgh'.indexOf(square[0]);
  const rank = Number(square[1]);
  const column = orientation === 'w' ? file : 7 - file;
  const row = orientation === 'w' ? 8 - rank : rank - 1;
  await page.mouse.click(box.x + ((column + 0.5) * box.width) / 8, box.y + ((row + 0.5) * box.height) / 8);
}

test('transferencia: guarda, pausa y reanuda sin crear entrenamiento', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.getByRole('button', { name: 'Panel' }).last().click();
  await page.getByRole('heading', { name: 'Batería de transferencia' }).waitFor();
  await page.getByRole('button', { name: 'Empezar medición' }).click();

  await expect(page.getByText('Posición 1 de 30')).toBeVisible();
  const board = page.locator('cg-board');
  await board.waitFor();
  const first = seedTransferItems[0];
  const move = first.acceptedMoves[0];
  const orientation = first.fen.split(' ')[1] as 'w' | 'b';
  await clickSquare(page, board, move.slice(0, 2), orientation);
  await clickSquare(page, board, move.slice(2, 4), orientation);

  await expect(page.getByText('Posición 2 de 30')).toBeVisible();
  await expect(page.getByText('Acertaste', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Fallaste', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Jugada correcta', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pausar y volver al Panel' }).click();
  await expect(page.getByText('Tenés una toma en curso: 1 de 30 posiciones.')).toBeVisible();

  const counts = await page.evaluate(() =>
    new Promise<{ measurements: number; responses: number; cards: number; radar: number }>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction(['transferMeasurements', 'errorCards', 'radarAttempts']);
        const measurementRequest = tx.objectStore('transferMeasurements').getAll();
        const cardsRequest = tx.objectStore('errorCards').count();
        const radarRequest = tx.objectStore('radarAttempts').count();
        tx.oncomplete = () => {
          const measurements = measurementRequest.result;
          resolve({
            measurements: measurements.length,
            responses: measurements[0]?.responses.length ?? 0,
            cards: cardsRequest.result,
            radar: radarRequest.result,
          });
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
  expect(counts).toEqual({ measurements: 1, responses: 1, cards: 0, radar: 0 });

  await page.getByRole('button', { name: 'Continuar medición' }).click();
  await expect(page.getByText('Posición 2 de 30')).toBeVisible();
});
