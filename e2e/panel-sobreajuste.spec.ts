// RF-12.3: la alerta del Panel requiere ocho semanas comparables y nunca usa
// una banda estimada como si fuera Elo real.
import { expect, test } from '@playwright/test';

test('Panel: alerta de sobreajuste y sugiere más partidas con análisis', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.evaluate(() => {
    const dayMs = 86_400_000;
    const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * dayMs).toISOString();
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction(['radarAttempts', 'games'], 'readwrite');
        const radar = tx.objectStore('radarAttempts');
        ([
          ['b1', 55, 40], ['b2', 52, 41], ['b3', 49, 42],
          ['r1', 10, 56], ['r2', 7, 57], ['r3', 2, 58],
        ] as const).forEach(([id, daysAgo, difficulty]) => radar.put({
          id,
          itemId: id,
          tipo: 'ofensiva',
          rating: 1500,
          dificultadNormalizada: difficulty,
          origenContenido: 'catalogo',
          acierto: true,
          fecha: iso(daysAgo),
        }));
        const games = tx.objectStore('games');
        games.put({
          id: 'rated-baseline', pgn: '1. e4 e5 *', fuente: 'manual', ritmo: 'clasica', resultado: '*',
          tiemposPorJugadaMs: [], analizada: false, fecha: iso(52), jugadorColor: 'w', ratingUsuario: 1500,
        });
        games.put({
          id: 'rated-recent', pgn: '1. d4 d5 *', fuente: 'manual', ritmo: 'clasica', resultado: '*',
          tiemposPorJugadaMs: [], analizada: false, fecha: iso(4), jugadorColor: 'w', ratingUsuario: 1490,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
  await page.getByRole('heading', { name: 'Transferencia al juego' }).waitFor();
  await expect(page.getByText('Alerta de sobreajuste:', { exact: false })).toBeVisible();
  await expect(page.getByText('priorizá partidas rápidas o clásicas', { exact: false })).toBeVisible();
});
