// RF-12.4: el usuario configura un ABAB, ve sus límites metodológicos y la
// línea base/configuración quedan persistidas desde el primer bloque.
import { expect, test } from '@playwright/test';

test('experimento n=1: configura, inicia y persiste un diseño ABAB', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
  await page.getByRole('heading', { name: 'Experimento n=1' }).waitFor();
  await page.getByRole('button', { name: 'Configurar experimento' }).click();

  await expect(page.getByText('No hay grupo control:', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configurar ABAB' })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar experimento de ocho semanas' }).click();

  await expect(page.getByRole('heading', { name: 'Fase actual · A1' })).toBeVisible();
  await expect(page.getByText('Énfasis: Radar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Línea base' })).toBeVisible();
  await expect(page.getByText('0 / 48')).toBeVisible();

  const stored = await page.evaluate(() =>
    new Promise<{ count: number; phases: string[]; baselineGames: number; modalityA: string; modalityB: string }>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction('n1Experiments');
        const all = tx.objectStore('n1Experiments').getAll();
        tx.oncomplete = () => {
          const experiment = all.result[0];
          resolve({
            count: all.result.length,
            phases: experiment.fases.map((phase: { id: string }) => phase.id),
            baselineGames: experiment.lineaBase.partidasAnalizadas,
            modalityA: experiment.modalidadA,
            modalityB: experiment.modalidadB,
          });
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
  expect(stored).toEqual({
    count: 1,
    phases: ['A1', 'B1', 'A2', 'B2'],
    baselineGames: 0,
    modalityA: 'radar',
    modalityB: 'partidas-analisis',
  });
});
