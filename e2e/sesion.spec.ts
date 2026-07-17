// E2E del criterio de salida de Fase 1 (roadmap): la sesión simple (Cola
// vencida + Radar) funciona de punta a punta — evaluación, jugada,
// calibración muestreada, feedback con porqué, y exportación de datos.
// El detalle de "la sesión completa termina tras 8 posiciones" y "un fallo
// espacia distinto que un acierto" ya está cubierto exhaustivamente por
// src/ui/state/sessionStore.test.ts (Vitest, contra Dexie real) — acá se
// verifica que la UI está bien conectada a esa lógica, no se reprueba la
// lógica misma.
import { expect, test, type Page } from '@playwright/test';
import { RADAR_DATASET_VERSION } from '../src/services/puzzles/seedData';
import { seedCurriculumItems } from '../src/services/puzzles/curriculumSeedData';

const radarFixture = {
  id: 'e2e-radar-envenenada',
  fen: 'rnb1kbnr/ppp2ppp/8/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 2 4',
  tipo: 'envenenada',
  temas: ['fixture-e2e'],
  rating: 1200,
  solucion: ['d5h5'],
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
    { item: radarFixture, version: RADAR_DATASET_VERSION },
  );
}

// Este archivo prueba Radar y Cola; el bloque de currículo (Fase 3) tiene su
// propio spec (curriculo.spec.ts). Marcarlo "automatizado" de entrada evita
// que el nuevo bloque intermedio (RF-11.2: Cola → currículo → Radar) se
// interponga en specs que no lo están probando.
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

// Sin perfil diagnosticado (RF-11.4, su propio spec en diagnostico.spec.ts),
// Hoy antepone esa pantalla a "Tu sesión de hoy". Sembrarlo como completado
// evita que se interponga en specs que no lo están probando.
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

// El tablero se orienta según quién mueve (RF-5.2, convención tipo Lichess:
// la posición se ve siempre desde la perspectiva de quien tiene que jugar).
// chessground no pone listeners en cada <piece> (tienen pointer-events
// deshabilitado a propósito: el click lo captura <cg-board> y calcula la
// casilla por coordenadas), así que hay que clickear por píxeles, no sobre
// los elementos de pieza.
async function clickSquare(page: Page, board: ReturnType<Page['locator']>, file: string, rank: number) {
  const flipped = (await page.locator('.cg-wrap').first().getAttribute('class'))?.includes('orientation-black') ?? false;
  const box = await board.boundingBox();
  if (!box) throw new Error('Tablero sin bounding box');
  const files = 'abcdefgh';
  const col = flipped ? 7 - files.indexOf(file) : files.indexOf(file);
  const row = flipped ? rank - 1 : 8 - rank;
  await page.mouse.click(box.x + ((col + 0.5) * box.width) / 8, box.y + ((row + 0.5) * box.height) / 8);
}

test.describe('sesión simple: Radar', () => {
  test('evaluación → jugada → calibración muestreada → feedback con porqué → siguiente', async ({ page }) => {
    // Forzar que siempre se muestree confianza (RF-10.1 usa Math.random()),
    // para ejercitar el ConfidenceSlider de forma determinística.
    await page.addInitScript(() => {
      Math.random = () => 0;
    });
    await page.goto('./');
    await page.getByText('Tu sesión de hoy').waitFor();
    await seedRadarFixture(page);
    await seedCurriculumAutomatizado(page);
    await seedProfileDiagnosticado(page);
    await page.reload();
    await page.getByText('Tu sesión de hoy').waitFor();
    await page.getByRole('button', { name: 'Empezar sesión' }).click();

    const board = page.locator('cg-board');
    await board.waitFor({ timeout: 15_000 });
    await page.getByText('¿Cómo está la posición?').waitFor();

    // Las piezas del Radar también cargan con la CSS inyectada en runtime.
    const pieceImage = await page
      .locator('piece.pawn.black, piece.pawn.white')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(pieceImage).toContain('piece/staunty/');

    await page.getByRole('button', { name: 'Igual' }).click();
    await page.getByText('Ahora jugá tu respuesta').waitFor();

    // El catálogo se fija dentro de IndexedDB para que el spec no dependa de
    // la versión real de datos que se publique con cada lote del Radar.
    await clickSquare(page, board, 'd', 5);
    await clickSquare(page, board, 'h', 5);

    // Con Math.random forzado a 0, también se muestrea la regla de
    // candidatas (RF-5.8): "no, mantener esta" resuelve con la misma jugada.
    await page.getByText('¿Hay algo mejor?').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'No, mantener esta' }).click();

    // Con Math.random forzado a 0, shouldSampleConfidence() da true siempre.
    await page.getByText('¿Qué tan seguro estás').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // d5h5 es la solución registrada: acierta.
    await page.getByText('Acertaste').waitFor({ timeout: 10_000 });
    // El feedback siempre explica el porqué (RF-5.3), también sin táctica.
    const explicacion = await page.locator('p.text-primary').first().innerText();
    expect(explicacion.length).toBeGreaterThan(10);

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByText('¿Cómo está la posición?').waitFor({ timeout: 10_000 });
    await expect(page.getByText('Posición 2 de')).toBeVisible();
  });
});

test.describe('sesión simple: Cola', () => {
  test('un repaso vencido aparece antes que el Radar y respeta su prioridad (RF-4.4)', async ({ page }) => {
    await page.goto('./');
    await page.getByText('Tu sesión de hoy').waitFor();

    // Sembrar una tarjeta vencida directamente en IndexedDB, como lo dejaría
    // un fallo real de partida o del Radar en un día anterior.
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('elomax');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('errorCards', 'readwrite');
          tx.objectStore('errorCards').put({
            id: 'e2e-due-1',
            fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
            ladoAMover: 'b',
            jugadaUsuario: 'e7e6',
            jugadaCorrecta: 'e7e5',
            categoria: 'tactico',
            origen: 'partida',
            fsrs: {
              due: '2026-01-01T00:00:00.000Z',
              stability: 0,
              difficulty: 0,
              elapsedDays: 0,
              scheduledDays: 0,
              reps: 0,
              lapses: 0,
              learningSteps: 0,
              state: 'new',
              lastReview: null,
            },
            creadaEn: '2026-01-01T00:00:00.000Z',
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
    await seedCurriculumAutomatizado(page);
    await seedProfileDiagnosticado(page);
    await page.reload();
    await page.getByText('Tenés 1 repaso vencido.').waitFor();

    await page.getByRole('button', { name: 'Empezar sesión' }).click();
    await page.getByText('Cola de repasos').waitFor({ timeout: 15_000 });

    const board = page.locator('cg-board');
    await board.waitFor();
    await clickSquare(page, board, 'e', 7);
    await clickSquare(page, board, 'e', 5);

    await page.getByText('Acertaste').waitFor({ timeout: 10_000 });
    // Tras responder la única vencida, sigue directo al Radar.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByText('¿Cómo está la posición?').waitFor({ timeout: 10_000 });
  });
});

test.describe('exportación e importación (E14)', () => {
  test('exportar mis datos descarga un .zip, alcanzable en 2 toques desde Hoy', async ({ page }) => {
    await page.goto('./');
    await page.getByText('Tu sesión de hoy').waitFor();

    // Toque 1: Panel. Toque 2: Exportar mis datos.
    await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
    await page.getByText('Tus datos').waitFor();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar mis datos' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^elomax-export-.*\.zip$/);
  });
});
