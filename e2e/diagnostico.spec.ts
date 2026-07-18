// E2E del diagnóstico inicial (RF-11.4): sin diagnóstico previo, Hoy lo
// antepone a "Tu sesión de hoy"; completarlo guarda una banda de Elo y deja
// pasar a la sesión normal. Las dos partidas se resuelven por abandono (el
// resultado en sí, gana/pierde/empata, ya está probado en
// core/prescriptor.test.ts vía `estimarBandaElo`) para que el spec sea
// rápido y determinístico; acá se verifica el cableado de la UI.
import { expect, test, type Page } from '@playwright/test';
import { RADAR_DATASET_VERSION } from '../src/services/puzzles/seedData';

const radarFixture = {
  id: 'e2e-diagnostico-1',
  fen: 'rnb1kbnr/ppp2ppp/8/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 2 4',
  tipo: 'envenenada',
  temas: ['fixture-e2e'],
  rating: 1200,
  solucion: ['d5h5'],
  fuente: 'seed-dev',
};

// Un único ítem en el catálogo: las 20 rondas del Radar del diagnóstico
// sirven siempre la misma posición conocida, determinística de resolver.
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
    { item: radarFixture, version: RADAR_DATASET_VERSION },
  );
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

test('diagnóstico inicial: dos partidas y 20 posiciones del Radar arman la primera banda de Elo', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedRadarFixture(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.getByText('Diagnóstico inicial').waitFor();
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).click();

  // Partida 1 de 2: abandonar de una (el resultado gana/pierde/empata ya
  // está probado en estimarBandaElo; acá solo importa que el flujo avance).
  await page.getByText('Partida 1 de 2').waitFor({ timeout: 15_000 });
  const board1 = page.locator('cg-board');
  await board1.waitFor();
  await page.getByRole('button', { name: 'Rendirse' }).click();

  // Partida 2 de 2: igual.
  await page.getByText('Partida 2 de 2').waitFor({ timeout: 15_000 });
  const board2 = page.locator('cg-board');
  await board2.waitFor();
  await page.getByRole('button', { name: 'Rendirse' }).click();

  // 20 posiciones del Radar, siempre la misma posición conocida (d5h5 acierta).
  await page.getByText('Posición 1 de 20').waitFor({ timeout: 15_000 });
  for (let i = 0; i < 20; i++) {
    const board = page.locator('cg-board');
    await board.waitFor();
    await clickSquare(page, board, 'd', 5);
    await clickSquare(page, board, 'h', 5);
    await page.getByText('Acertaste').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }

  // Resultado: banda estimada y perfil guardado.
  await page.getByText('Diagnóstico completo').waitFor({ timeout: 10_000 });
  await expect(page.getByText(/Banda de arranque:/)).toBeVisible();
  await page.getByRole('button', { name: 'Empezar a entrenar' }).click();

  // De vuelta en Hoy, ya no vuelve a pedir el diagnóstico.
  await page.getByRole('button', { name: 'Empezar sesión' }).waitFor({ timeout: 10_000 });
});
