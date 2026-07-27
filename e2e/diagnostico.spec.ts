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
  // El CTA confirma que Dexie ya abrió y creó el schema; el h1 aparece
  // también durante el skeleton y no alcanza como barrera para sembrar IDB.
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedRadarFixture(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.getByText('Diagnóstico inicial').waitFor();
  await expect(page.getByRole('heading', { name: 'Conocé tu punto de partida' })).toBeVisible();
  await expect(page.getByText('20–40 min estimados')).toBeVisible();
  await expect(page.getByText('Partida de referencia')).toBeVisible();
  await expect(page.getByText('Partida de contraste')).toBeVisible();
  await expect(page.getByText('Radar · 20 posiciones')).toBeVisible();
  await expect(page.getByText('Tus partidas y respuestas se guardan únicamente en este dispositivo.')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).click();

  // Partida 1 de 2: abandonar de una (el resultado gana/pierde/empata ya
  // está probado en estimarBandaElo; acá solo importa que el flujo avance).
  await page.getByText('Partida 1 de 2').waitFor({ timeout: 15_000 });
  await expect(page.getByText('Etapa 1 de 3')).toBeVisible();
  const board1 = page.locator('cg-board');
  await board1.waitFor();
  await page.getByRole('button', { name: 'Rendirse' }).click();

  // Partida 2 de 2: igual.
  await page.getByText('Partida 2 de 2').waitFor({ timeout: 15_000 });
  await expect(page.getByText('Etapa 2 de 3')).toBeVisible();
  const board2 = page.locator('cg-board');
  await board2.waitFor();
  await page.getByRole('button', { name: 'Rendirse' }).click();

  // 20 posiciones del Radar, siempre la misma posición conocida (d5h5 acierta).
  await page.getByText('Posición 1 de 20').waitFor({ timeout: 15_000 });
  await expect(page.getByText('Etapa 3 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByRole('heading', { name: 'Diagnóstico en pausa' })).toBeVisible();
  await expect(page.getByText('Tu avance sigue disponible mientras mantengas abierta esta pestaña.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar diagnóstico' }).click();
  await expect(page.getByText('Posición 1 de 20')).toBeVisible();
  // Posiciones (1-based) donde el diagnóstico pide confianza declarada
  // (DIAGNOSTICO_POSICIONES_CONFIANZA): fijas a propósito, para que la línea
  // base de Brier tenga la misma cantidad de observaciones en todos los casos.
  const conConfianza = new Set([3, 7, 11, 15, 19]);
  for (let i = 1; i <= 20; i++) {
    const board = page.locator('cg-board');
    await board.waitFor();
    // Paso 1 (RF-5.2): declarar la evaluación antes de poder jugar.
    await page.getByRole('button', { name: 'Mejor negras' }).click();
    await clickSquare(page, board, 'd', 5);
    await clickSquare(page, board, 'h', 5);
    if (conConfianza.has(i)) {
      // El resultado no se revela hasta declarar la confianza.
      await expect(page.getByText('¿Cuánta confianza tenés en tu jugada?')).toBeVisible();
      await expect(page.getByText('Acertaste')).toHaveCount(0);
      await page.getByRole('button', { name: 'Confirmar' }).click();
    }
    await page.getByText('Acertaste').waitFor({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Siguiente' }).click();
  }

  // Informe de cierre: banda, línea base medida y perfil de fugas.
  await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Colocación inicial provisional')).toBeVisible();
  await expect(page.getByText('Radar del diagnóstico')).toBeVisible();
  await expect(page.getByText('20 de 20 (100%)')).toBeVisible();
  // Cinco confianzas al 50% con 100% de acierto: Brier 0,25.
  await expect(page.getByText('Calibración del juicio (Brier)')).toBeVisible();
  await expect(page.getByText('Dónde se te escapan las posiciones')).toBeVisible();
  // Errores graves todavía sin dato: es lo que la CTA de análisis va a llenar.
  await expect(page.getByText('Falta analizar una partida')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analizar mi partida del diagnóstico' })).toBeVisible();

  // El rating declarado es opcional y se puede cargar acá mismo.
  await page.getByRole('spinbutton', { name: 'Rating' }).fill('1450');
  await page.getByRole('button', { name: 'Guardar rating' }).click();
  await expect(page.getByText(/Rating guardado: 1450/)).toBeVisible();

  await page.getByRole('button', { name: 'Ir a mi sesión de hoy' }).click();

  // De vuelta en Hoy, ya no vuelve a pedir el diagnóstico.
  await page.getByRole('button', { name: 'Empezar sesión' }).waitFor({ timeout: 10_000 });

  // Y las partidas del diagnóstico no ocupan el compromiso semanal (RF-11.7):
  // la partida lenta sigue prescripta como pendiente, porque el usuario todavía
  // no jugó ninguna a propósito.
  await page.getByRole('heading', { name: 'También te toca hoy' }).waitFor();
  await expect(page.getByRole('link', { name: /Tu partida lenta de la semana/ })).toBeVisible();
  await expect(page.getByText('de acá salen tus repasos', { exact: false })).toBeVisible();
});
