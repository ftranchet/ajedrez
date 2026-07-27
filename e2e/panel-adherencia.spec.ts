// E13: la adherencia se reconoce por el plan semanal de proceso y la
// celebración solo aparece ante una mejora medida en partidas reales.
import { expect, test } from '@playwright/test';

test('Panel: plan semanal cumplido y mejora real de errores graves', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.evaluate(() => {
    // Relativo al instante actual, no a las 12:00: la sesión de "hoy" sembrada
    // a mediodía quedaba en el futuro en toda corrida matutina y el plan
    // semanal la excluía (timestamp <= now) — un lunes a la mañana contaba
    // cero sesiones y el test fallaba solo, sin cambio de código.
    const dayIso = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const moves = (count: number) => Array.from({ length: count }, (_, index) => ({
      ply: index,
      san: 'e4',
      fenAntes: 'startpos',
      ladoQueMueve: 'w',
      jugadaUsuario: 'e2e4',
      jugadaMotor: 'd2d4',
      cpAntes: 0,
      cpDespues: -200,
      cpPerdidos: 200,
      clasificacion: 'grave',
    }));
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('elomax');
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction(['sessions', 'games', 'profile'], 'readwrite');
        tx.objectStore('profile').put({
          id: 'principal',
          bandaElo: 'elemental',
          diagnosticoCompletadoEn: new Date().toISOString(),
          planSemanal: { sesionesObjetivo: 1, minutosObjetivo: 30 },
        });
        const sessions = tx.objectStore('sessions');
        [0, 1, 2].forEach((daysAgo) => sessions.put({
          id: `process-${daysAgo}`,
          fechaInicio: dayIso(daysAgo),
          fechaFin: dayIso(daysAgo),
          estado: 'completada',
          duracionMs: 10 * 60_000,
          bloques: [{ tipo: 'radar', planificados: 8, completados: 8, estado: 'completado' }],
        }));

        const games = tx.objectStore('games');
        [50, 45, 40].forEach((daysAgo, index) => games.put({
          id: `old-${index}`,
          pgn: '1. e4 e5 *', fuente: 'manual', ritmo: 'clasica', resultado: '*',
          tiemposPorJugadaMs: [], analizada: true, fecha: dayIso(daysAgo), jugadorColor: 'w',
          analisis: { jugadas: moves(3), comparacionEvaluaciones: [], analizadaEn: dayIso(daysAgo) },
        }));
        [20, 10, 2].forEach((daysAgo, index) => games.put({
          id: `new-${index}`,
          pgn: '1. d4 d5 *', fuente: 'manual', ritmo: 'clasica', resultado: '*',
          tiemposPorJugadaMs: [], analizada: true, fecha: dayIso(daysAgo), jugadorColor: 'w',
          analisis: { jugadas: moves(1), comparacionEvaluaciones: [], analizadaEn: dayIso(daysAgo) },
        }));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();
  await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();

  await expect(page.getByText('1 de 1 sesiones', { exact: true })).toBeVisible();
  await expect(page.getByText('Plan semanal cumplido.', { exact: false })).toBeVisible();
  await expect(page.getByText('no otorgan premios ni inflan la meta', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mejora en partidas reales' })).toBeVisible();
  await expect(page.getByText('bajaron 67%', { exact: false })).toBeVisible();
});
