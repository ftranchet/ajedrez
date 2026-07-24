// E2E del bloque "¿Calcular o ya alcanza?" (E9, RF-9.2): cuando la dieta
// detecta una fuga táctica en las partidas recientes del usuario (errores
// reales, no un cronómetro invisible), la sesión agrega un bloque de decisión
// ("¿pide cálculo o alcanza?") entre el currículo y el Radar. La detección de
// la fuga en sí ya está probada en src/core/prescriptor.test.ts — este spec
// solo verifica que la UI está bien conectada a esa lógica.
import { test, type Page } from '@playwright/test';
import { RADAR_DATASET_VERSION } from '../src/services/puzzles/seedData';
import { seedCurriculumItems } from '../src/services/puzzles/curriculumSeedData';

const radarFixture = {
  id: 'e2e-triage-envenenada',
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

// Igual que en sesion.spec.ts: sin esto, el currículo (8 patrones nuevos)
// se interpondría antes del bloque de Triage que este spec quiere probar.
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

// Fuga táctica: dos tarjetas de error de PARTIDA, categoría táctica, creadas
// hoy (dentro de la ventana de 30 días) → 100% tácticas > umbral 0.35, así que
// la dieta activa el bloque de criterio. Se crean NO vencidas (fsrs.due en el
// futuro) para que no aparezca además la Cola y el bloque de criterio quede
// primero.
async function seedFugaTacticaDePartida(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('elomax');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('errorCards', 'readwrite');
        const ahora = new Date().toISOString();
        const card = (id: string) => ({
          id,
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          ladoAMover: 'w',
          jugadaUsuario: 'a2a3',
          jugadaCorrecta: 'e2e4',
          categoria: 'tactico',
          origen: 'partida',
          fsrs: { due: '2027-01-01T00:00:00.000Z', stability: 5, difficulty: 5, elapsedDays: 0, scheduledDays: 0, reps: 1, lapses: 0, learningSteps: 0, state: 'review', lastReview: ahora },
          creadaEn: ahora,
        });
        tx.objectStore('errorCards').put(card('e2e-fuga-1'));
        tx.objectStore('errorCards').put(card('e2e-fuga-2'));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test('¿Calcular o ya alcanza?: una fuga táctica agrega el bloque de decisión antes del Radar', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedRadarFixture(page);
  await seedCurriculumAutomatizado(page);
  await seedProfileDiagnosticado(page);
  await seedFugaTacticaDePartida(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  // El resumen de "Tu sesión de hoy" ya anticipa el bloque (RF-11.1).
  await page.getByText('¿Calcular o ya alcanza?').waitFor();

  await page.getByRole('button', { name: 'Empezar sesión' }).click();
  await page.getByText('Posición 1 de 1').waitFor({ timeout: 15_000 });
  await page.getByText('¿Esta posición pide cálculo profundo, o alcanza con una jugada sólida?').waitFor();

  const board = page.locator('cg-board');
  await board.waitFor();
  // El tablero se muestra pero no es jugable: Triage es una decisión, no una jugada.
  await board.click({ position: { x: 10, y: 10 } });

  // El fixture es de tipo "envenenada": la decisión correcta es "pide cálculo".
  await page.getByRole('button', { name: 'Pide cálculo' }).click();
  await page.getByText('Acertaste').waitFor({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Siguiente' }).click();
  // Único ítem del pool: el bloque de Triage termina y sigue directo al Radar.
  await page.getByText('¿Cómo está la posición?').waitFor({ timeout: 10_000 });
});
