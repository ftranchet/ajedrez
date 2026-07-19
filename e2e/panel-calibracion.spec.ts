// RF-10.3/RF-12.1: el Panel convierte registros persistidos en una curva
// accesible, una lectura clara y actividad real de sesiones.
import { expect, test } from '@playwright/test';

test('Panel: curva de calibración y actividad de los últimos 30 días', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['calibrationRecords', 'sessions'], 'readwrite');
        const calibration = transaction.objectStore('calibrationRecords');
        [true, false, false].forEach((acierto, index) =>
          calibration.put({
            id: `e2e-cal-${index}`,
            contexto: 'radar',
            confianzaDeclarada: 90,
            acierto,
            fecha: new Date().toISOString(),
          }),
        );
        transaction.objectStore('sessions').put({
          id: 'e2e-session',
          fechaInicio: new Date(Date.now() - 15 * 60_000).toISOString(),
          fechaFin: new Date().toISOString(),
          estado: 'completada',
          duracionMs: 15 * 60_000,
          bloques: [{ tipo: 'radar', planificados: 8, completados: 8, estado: 'completado' }],
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );

  await page.getByRole('button', { name: 'Panel' }).last().click();
  await page.getByRole('heading', { name: 'Curva de calibración' }).waitFor();
  await expect(page.getByRole('img', { name: 'Confianza declarada frente a tasa real de acierto' })).toBeVisible();
  await expect(page.getByText(/90%.*Radar.*33%.*sobreconfianza/)).toBeVisible();
  await expect(page.getByText('Últimos 30 días. Mide proceso, no resultados.')).toBeVisible();
  await expect(page.getByText('minutos', { exact: true })).toHaveCount(1);
  await expect(page.getByText('15', { exact: true })).toBeVisible();
  await expect(page.getByText('8', { exact: true })).toBeVisible();
});
