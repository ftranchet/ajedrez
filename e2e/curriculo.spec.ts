// E2E de la parte de patrones del currículo base (E6, RF-6.1/6.3): sin
// tarjetas vencidas en la Cola, la sesión pasa por los patrones vencidos
// antes que el Radar (RF-11.2). La lógica de automatización y espaciado ya
// está cubierta por src/ui/state/sessionStore.curriculum.test.ts — acá se
// verifica que la UI está bien conectada.
//
// Dexie/IndexedDB no garantiza el orden de inserción al listar una tabla
// (ordena por clave primaria): qué patrón aparece primero no es
// predecible desde el orden de declaración del seed. El test lee el nombre
// del patrón mostrado y busca su solución en el seed en vez de asumir cuál
// aparece primero.
import { test, type Page } from '@playwright/test';
import { seedCurriculumItems } from '../src/services/puzzles/curriculumSeedData';

const SOLUCION_POR_NOMBRE = new Map(seedCurriculumItems.map((item) => [item.nombre, item.solucion[0]]));

async function clickSquare(page: Page, board: ReturnType<Page['locator']>, file: string, rank: number) {
  const flipped = (await page.locator('.cg-wrap').first().getAttribute('class'))?.includes('orientation-black') ?? false;
  const box = await board.boundingBox();
  if (!box) throw new Error('Tablero sin bounding box');
  const files = 'abcdefgh';
  const col = flipped ? 7 - files.indexOf(file) : files.indexOf(file);
  const row = flipped ? rank - 1 : 8 - rank;
  await page.mouse.click(box.x + ((col + 0.5) * box.width) / 8, box.y + ((row + 0.5) * box.height) / 8);
}

test('currículo: sin repasos vencidos, la sesión sirve un patrón antes que el Radar', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.getByRole('button', { name: 'Empezar sesión' }).click();

  await page.getByText('Patrón 1 de 8').waitFor({ timeout: 15_000 });
  const nombre = await page.locator('aside .font-display.text-xl').first().innerText();
  const solucion = SOLUCION_POR_NOMBRE.get(nombre);
  if (!solucion) throw new Error(`Patrón mostrado sin solución conocida en el seed: "${nombre}"`);
  const [from, to] = [solucion.slice(0, 2), solucion.slice(2, 4)];

  const board = page.locator('cg-board');
  await board.waitFor();
  await clickSquare(page, board, from[0], Number(from[1]));
  await clickSquare(page, board, to[0], Number(to[1]));

  await page.getByText('Acertaste').waitFor({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Sigue con el segundo patrón (interleaving: nunca repite el mismo).
  await page.getByText('Patrón 2 de 8').waitFor({ timeout: 10_000 });
});
