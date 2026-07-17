// E2E del bloque de Triage de reloj (E9, RF-9.2/9.3): cuando la dieta
// detecta una fuga de tiempo en las partidas recientes del usuario, la
// sesión agrega un bloque de decisión rápida ("¿pide cálculo o alcanza?")
// entre el currículo y el Radar. La detección de la fuga en sí ya está
// probada exhaustivamente en src/core/triage.test.ts y
// src/core/prescriptor.test.ts (mismo fixture de tiempos usado acá) — este
// spec solo verifica que la UI está bien conectada a esa lógica.
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

// Mismo fixture que core/prescriptor.test.ts ("suma Triage cuando el perfil
// de tiempo muestra una fuga"): el usuario (blancas) juega ply0 en 50ms
// (grave) y ply2 en 500ms; mediana propia 275, así que ply0 es "rápida"
// (≤0.5×mediana) y salió grave → infragasto = 1, por encima del umbral 0.35.
async function seedPartidaConFugaDeTiempo(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('elomax');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('games', 'readwrite');
        const jugada = (ply: number, ladoQueMueve: 'w' | 'b', clasificacion: string) => ({
          ply,
          san: 'e4',
          fenAntes: 'startpos',
          ladoQueMueve,
          jugadaUsuario: 'e2e4',
          jugadaMotor: 'e2e4',
          cpAntes: 0,
          cpDespues: 0,
          cpPerdidos: 0,
          clasificacion,
        });
        tx.objectStore('games').put({
          id: 'e2e-triage-partida',
          pgn: '1. e4 e5 2. Nf3 Nc6 *',
          fuente: 'local',
          ritmo: 'sin-reloj',
          resultado: '*',
          tiemposPorJugadaMs: [50, 500, 500, 500],
          analizada: true,
          fecha: '2026-01-01T00:00:00.000Z',
          jugadorColor: 'w',
          analisis: {
            jugadas: [jugada(0, 'w', 'grave'), jugada(1, 'b', 'buena'), jugada(2, 'w', 'buena'), jugada(3, 'b', 'buena')],
            comparacionEvaluaciones: [],
            analizadaEn: '2026-01-01',
          },
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

test('Triage de reloj: una fuga de tiempo agrega el bloque de decisión antes del Radar', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedRadarFixture(page);
  await seedCurriculumAutomatizado(page);
  await seedProfileDiagnosticado(page);
  await seedPartidaConFugaDeTiempo(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  // El resumen de "Tu sesión de hoy" ya anticipa el bloque (RF-11.1).
  await page.getByText('Triage de reloj').waitFor();

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
