// Sprint UX: rutas recargables, foco, scroll y segunda señal visual en la
// navegación móvil. Corre también bajo /ajedrez/ en CI.
import { expect, test } from '@playwright/test';

test('navegación: admite enlace directo, historial y mueve el foco', async ({ page }) => {
  await page.goto('./#/panel');
  await expect(page).toHaveURL(/#\/panel$/);
  await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();

  const resumen = page.getByRole('radio', { name: 'Resumen' });
  await resumen.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Medición' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Medición' })).toBeFocused();

  await page.locator('nav:visible button', { hasText: 'Jugar' }).first().click();
  await expect(page).toHaveURL(/#\/jugar$/);
  await expect(page.getByRole('heading', { name: 'Jugar' })).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/#\/panel$/);
  await expect(page.getByRole('heading', { name: 'Panel', exact: true })).toBeFocused();
});

test('navegación móvil: resetea scroll y marca el activo sin depender solo del color', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./#/panel');
  await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();
  await page.getByRole('radio', { name: 'Partidas y datos' }).click();
  await expect(page.getByRole('radio', { name: 'Partidas y datos' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Resumen' })).not.toBeChecked();

  const main = page.locator('main');
  await main.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const jugar = page.locator('nav:visible button', { hasText: 'Jugar' }).first();
  await jugar.click();
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(jugar).toHaveAttribute('aria-current', 'page');
  const markerHeight = await jugar.evaluate((element) => getComputedStyle(element, '::before').height);
  expect(Number.parseFloat(markerHeight)).toBeGreaterThan(0);
});

test('texto terciario conserva contraste AA sobre superficies elevadas', async ({ page }) => {
  await page.goto('./');
  const ratio = await page.evaluate(() => {
    const parse = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = ([r, g, b]: number[]) => {
      const values = [r, g, b].map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    const sample = document.createElement('span');
    sample.className = 'text-tertiary bg-elevated';
    document.body.append(sample);
    const styles = getComputedStyle(sample);
    const foreground = luminance(parse(styles.color));
    const background = luminance(parse(styles.backgroundColor));
    sample.remove();
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
