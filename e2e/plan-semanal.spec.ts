// ADR-0013 / RF-13.4: el plan (y el resto de la configuración) se edita desde
// Ajustes —el engranaje del header—, persiste en el perfil local y se lee de
// solo lectura en Hoy (constancia) y en el Panel.
import { expect, test, type Page } from '@playwright/test';

function gear(page: Page) {
  return page.locator('button[aria-label="Ajustes"]:visible');
}

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

test('plan semanal: se edita en Ajustes, persiste y se lee en Hoy y en el Panel', async ({ page }) => {
  await page.goto('./#/hoy');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedDiagnosticado(page);
  await page.reload();

  // La constancia de solo lectura vive en Hoy.
  await expect(page.getByText('0 de 3 sesiones', { exact: true })).toBeVisible();

  // La edición vive en Ajustes.
  await page.goto('./#/ajustes');
  await page.getByRole('button', { name: 'Ajustar plan' }).click();
  await page.getByLabel('Sesiones por semana').fill('4');
  await page.getByLabel('Minutos orientativos').fill('120');
  await page.getByRole('button', { name: 'Guardar plan' }).click();
  await expect(page.getByText('0 de 4 sesiones', { exact: true })).toBeVisible();
  await expect(page.getByText('0 de 120 min', { exact: true })).toBeVisible();

  // Hoy (solo lectura) refleja el nuevo plan.
  await page.goto('./#/hoy');
  await expect(page.getByText('0 de 4 sesiones', { exact: true })).toBeVisible();
  // El Panel también.
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

test('Hoy prioriza empezar la sesión y no mezcla ajustes; los ajustes viven en su panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/hoy');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedDiagnosticado(page);
  await page.reload();

  const start = page.getByRole('button', { name: 'Empezar sesión' });
  const plan = page.getByRole('heading', { name: 'Plan semanal' });
  await expect(start).toBeVisible();
  await expect(plan).toBeVisible();

  // Hoy ya no incluye recordatorio ni respuesta sensorial: se mudaron a Ajustes.
  await expect(page.getByRole('heading', { name: 'Recordatorio diario' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Respuesta sensorial' })).toHaveCount(0);

  // El único botón primario de la pantalla es empezar, y va antes que la constancia.
  const [startBox, planBox] = await Promise.all([start.boundingBox(), plan.boundingBox()]);
  expect(startBox).not.toBeNull();
  expect(planBox).not.toBeNull();
  expect(startBox!.y + startBox!.height).toBeLessThan(844 - 56);
  expect(startBox!.y).toBeLessThan(planBox!.y);
  await expect(page.locator('main .btn-primary')).toHaveCount(1);

  // En Ajustes sí están todos, y el plan es editable.
  await gear(page).click();
  await expect(page.getByRole('heading', { name: 'Recordatorio diario' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Respuesta sensorial' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustar plan' })).toBeVisible();
});

test('feedback sensorial: se configura en Ajustes, empieza apagado, separa canales y persiste', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: () => true,
    });
  });
  await page.goto('./#/hoy');
  await page.getByRole('button', { name: 'Empezar diagnóstico' }).waitFor();
  await seedDiagnosticado(page);
  await page.goto('./#/ajustes');

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
