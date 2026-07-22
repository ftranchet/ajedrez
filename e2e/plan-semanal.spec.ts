// ADR-0013 / RF-13.4: el plan se configura desde Hoy, persiste en el perfil
// local y se lee igual en el Panel.
import { expect, test, type Page } from '@playwright/test';

async function seedDiagnosticado(page: Page, sesionesObjetivo = 3, minutosObjetivo = 90) {
  await page.evaluate(
    ({ sesiones, minutos }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const transaction = request.result.transaction('profile', 'readwrite');
          transaction.objectStore('profile').put({
            id: 'principal',
            bandaElo: 'elemental',
            diagnosticoCompletadoEn: new Date().toISOString(),
            planSemanal: { sesionesObjetivo: sesiones, minutosObjetivo: minutos },
          });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      }),
    { sesiones: sesionesObjetivo, minutos: minutosObjetivo },
  );
}

test('plan semanal: configurar una carga personalizada persiste y llega al Panel', async ({ page }) => {
  await page.goto('./#/hoy');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedDiagnosticado(page);
  await page.reload();

  await expect(page.getByText('0 de 3 sesiones', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar plan' }).click();
  await page.getByLabel('Sesiones por semana').fill('4');
  await page.getByLabel('Minutos orientativos').fill('120');
  await page.getByRole('button', { name: 'Guardar plan' }).click();
  await expect(page.getByText('0 de 4 sesiones', { exact: true })).toBeVisible();
  await expect(page.getByText('0 de 120 min', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('0 de 4 sesiones', { exact: true })).toBeVisible();
  await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
  await expect(page.getByText('0 de 4 sesiones', { exact: true })).toBeVisible();

  const plan = await page.evaluate(() =>
    new Promise<{ sesionesObjetivo: number; minutosObjetivo: number }>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const get = request.result.transaction('profile').objectStore('profile').get('principal');
        get.onsuccess = () => resolve(get.result.planSemanal);
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
  expect(plan).toEqual({ sesionesObjetivo: 4, minutosObjetivo: 120 });
});

test('Hoy móvil prioriza empezar la sesión antes que constancia y recordatorios', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/hoy');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedDiagnosticado(page);
  await page.reload();

  const start = page.getByRole('button', { name: 'Empezar sesión' });
  const plan = page.getByRole('heading', { name: 'Plan semanal' });
  const reminder = page.getByRole('heading', { name: 'Recordatorio diario' });
  const sensory = page.getByRole('heading', { name: 'Respuesta sensorial' });
  await expect(start).toBeVisible();
  await expect(plan).toBeVisible();
  await expect(reminder).toBeVisible();
  await expect(sensory).toBeVisible();

  const [startBox, planBox, reminderBox, sensoryBox] = await Promise.all([
    start.boundingBox(),
    plan.boundingBox(),
    reminder.boundingBox(),
    sensory.boundingBox(),
  ]);
  expect(startBox).not.toBeNull();
  expect(planBox).not.toBeNull();
  expect(reminderBox).not.toBeNull();
  expect(sensoryBox).not.toBeNull();
  expect(startBox!.y + startBox!.height).toBeLessThan(844 - 56);
  expect(startBox!.y).toBeLessThan(planBox!.y);
  expect(startBox!.y).toBeLessThan(reminderBox!.y);
  expect(reminderBox!.y).toBeLessThan(sensoryBox!.y);
  await expect(page.locator('main .btn-primary')).toHaveCount(1);
});

test('feedback sensorial: empieza apagado, separa canales y persiste', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: () => true,
    });
  });
  await page.goto('./#/hoy');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedDiagnosticado(page);
  await page.reload();

  const sound = page.getByRole('checkbox', { name: /^Sonido/ });
  const vibration = page.getByRole('checkbox', { name: /^Vibración/ });
  await expect(sound).not.toBeChecked();
  await expect(vibration).not.toBeChecked();
  await sound.check();
  await expect(sound).toBeEnabled();
  await vibration.check();
  await expect(vibration).toBeEnabled();
  await expect(sound).toBeChecked();
  await expect(vibration).toBeChecked();

  await page.reload();
  await expect(page.getByRole('checkbox', { name: /^Sonido/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Vibración/ })).toBeChecked();
  const persisted = await page.evaluate(() =>
    new Promise<{ sonido: boolean; vibracion: boolean }>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const get = request.result.transaction('profile').objectStore('profile').get('principal');
        get.onsuccess = () => resolve(get.result.preferenciasSensoriales);
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    }),
  );
  expect(persisted).toEqual({ sonido: true, vibracion: true });
});
