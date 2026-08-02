// Anotaciones del usuario sobre el tablero (RF-5.10): flechas y círculos para
// pensar, con el botón derecho en escritorio y con un modo explícito en
// pantalla táctil. La regla de qué pasa al repetir una marca vive en
// core/anotaciones.ts y está probada ahí; acá se verifica que los dos gestos
// lleguen a dibujar de verdad, que es lo que ningún unitario puede afirmar.
import { devices, expect, test, type Page } from '@playwright/test';
import { STOYKO_DATASET_VERSION } from '../src/services/puzzles/stoykoSeedData';

// El catálogo sirve una posición al azar, y la orientación del tablero depende
// de quién mueve: sin fijar la posición, las casillas bajo cada píxel cambian
// entre corridas. Mismo fixture que e2e/calculo.spec.ts.
const fixture = {
  id: 'e2e-anotaciones-1',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  mejorLinea: ['f1c4', 'f8c5', 'e1g1'],
  evaluacionMotor: '=',
  fuente: 'seed-dev',
};

async function seedFixture(page: Page) {
  await page.evaluate(
    ({ item, version }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['stoykoItems', 'stoykoDatasetMeta'], 'readwrite');
          tx.objectStore('stoykoItems').clear();
          tx.objectStore('stoykoItems').put(item);
          tx.objectStore('stoykoDatasetMeta').put({ id: 'catalogo', version, seededAt: new Date().toISOString() });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    { item: fixture, version: STOYKO_DATASET_VERSION },
  );
}

/** Abre Cálculo con la posición fijada. */
async function abrirCalculo(page: Page) {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedFixture(page);
  await page.goto('./#/calculo');
  await page.reload();
}

/** Centro de una casilla, en píxeles de viewport. El tablero se orienta según
 * quién mueve, así que las columnas/filas son las que se ven, no las absolutas. */
async function centroDeCasilla(page: Page) {
  const board = page.locator('cg-board');
  await board.waitFor({ timeout: 20_000 });
  await board.scrollIntoViewIfNeeded();
  const box = (await board.boundingBox())!;
  const lado = box.width / 8;
  return (col: number, fila: number) => ({ x: box.x + (col + 0.5) * lado, y: box.y + (fila + 0.5) * lado });
}

/** Las marcas dibujadas, leídas del `cgHash` que chessground pone en cada una:
 * el <svg> no expone las casillas de otra forma. */
async function marcas(page: Page): Promise<string[]> {
  return page.locator('cg-container svg').first().locator('g[cgHash]').evaluateAll((nodos) =>
    nodos
      .map((n) => n.getAttribute('cgHash') ?? '')
      // El hash arranca con el tamaño del tablero, que no interesa; y una marca
      // en curso trae un "true" extra que tampoco.
      .map((h) => h.split(',').slice(2).filter((p) => p !== 'true').join(','))
      .filter(Boolean),
  );
}

test('escritorio: el botón derecho dibuja flechas y círculos, y no abre el menú del navegador', async ({ page }) => {
  await abrirCalculo(page);
  const centro = await centroDeCasilla(page);

  // Arrastrar con el botón derecho: flecha.
  const desde = centro(4, 6);
  const hasta = centro(4, 4);
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(hasta.x, hasta.y, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => marcas(page)).toEqual(['e2,e4,green']);

  // Botón derecho sin desplazarse: círculo sobre la casilla. chessground fija
  // la casilla apuntada en el frame siguiente al mousedown, así que hay que
  // dejar pasar uno: un click de una persona dura decenas de milisegundos, pero
  // uno sintético puede soltar el botón dentro del mismo frame.
  const suelta = centro(2, 5);
  await page.mouse.move(suelta.x, suelta.y);
  await page.mouse.down({ button: 'right' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => marcas(page)).toEqual(['e2,e4,green', 'c3,green']);

  // Repetir la misma flecha la borra: es la forma de deshacer sin botón.
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(hasta.x, hasta.y, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => marcas(page)).toEqual(['c3,green']);

  // El menú contextual del navegador taparía el tablero justo al dibujar.
  const prevenido = await page.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.querySelector('cg-board')!.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevenido).toBe(true);
});

test.describe('táctil', () => {
  // `defaultBrowserType` no se puede fijar dentro de un describe (forzaría un
  // worker nuevo), así que se descarta del descriptor.
  const celular = { ...devices['Pixel 7'] };
  delete (celular as { defaultBrowserType?: unknown }).defaultBrowserType;
  test.use(celular);

  test('el modo dibujo permite marcar con el dedo y no mueve piezas', async ({ page }) => {
    await abrirCalculo(page);
    await page.locator('cg-board').waitFor({ timeout: 20_000 });

    // El botón solo existe con puntero grueso: con mouse alcanza el derecho.
    const dibujar = page.getByRole('button', { name: 'Dibujar' });
    await expect(dibujar).toBeVisible();
    await dibujar.click();

    const centro = await centroDeCasilla(page);
    const desde = centro(4, 6);
    const hasta = centro(4, 4);

    // Un toque es un círculo.
    await page.touchscreen.tap(desde.x, desde.y);
    await expect.poll(() => marcas(page)).toEqual(['e2,green']);

    // Arrastrar es una flecha, y el color elegido se respeta.
    await page.getByRole('button', { name: 'Rojo' }).click();
    const board = page.locator('cg-board');
    await board.dispatchEvent('pointerdown', { clientX: desde.x, clientY: desde.y, pointerType: 'touch', isPrimary: true });
    await board.dispatchEvent('pointerup', { clientX: hasta.x, clientY: hasta.y, pointerType: 'touch', isPrimary: true });
    await expect.poll(() => marcas(page)).toEqual(['e2,green', 'e2,e4,red']);

    await page.getByRole('button', { name: 'Borrar marcas' }).click();
    await expect.poll(() => marcas(page)).toEqual([]);
  });
});
