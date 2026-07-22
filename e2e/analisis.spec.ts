// E2E del criterio de salida de Fase 2 (roadmap, E3): el motor está
// bloqueado hasta terminar la fase 1; la fase 2 corre el motor real
// (Stockfish en el Worker del navegador, no un doble) y clasifica jugadas;
// un error confirmado termina en la Cola Universal (E4), lista para
// aparecer en la sesión del día siguiente. Usa una partida con un blunder
// real y verificado (chess.js) para que el resultado sea determinístico
// pese a que el motor sí corre de verdad.
import { expect, test, type Page } from '@playwright/test';

// 4. Ba6?? entrega el alfil sin compensación (bxa6 lo captura gratis).
const PGN_CON_BLUNDER = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Ba6 bxa6 *';

// Este spec prueba el análisis en dos fases, no el diagnóstico inicial
// (RF-11.4, su propio spec en diagnostico.spec.ts). Sin perfil diagnosticado,
// Hoy antepone la pantalla de diagnóstico a "Tu sesión de hoy" — sembrarlo
// como completado evita que se interponga.
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

async function seedGame(page: Page) {
  await page.evaluate(
    (pgn) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('elomax');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('games', 'readwrite');
          tx.objectStore('games').put({
            id: 'e2e-analisis-blunder',
            pgn,
            fuente: 'manual',
            ritmo: 'sin-reloj',
            resultado: '*',
            tiemposPorJugadaMs: [],
            analizada: false,
            fecha: new Date().toISOString(),
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    PGN_CON_BLUNDER,
  );
}

test('análisis en dos fases: motor bloqueado hasta fase 1, detecta el error y lo manda a la Cola', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Tu sesión de hoy').waitFor();
  await seedGame(page);
  await seedProfileDiagnosticado(page);
  await page.reload();
  await page.getByText('Tu sesión de hoy').waitFor();

  await page.locator('nav:visible button', { hasText: 'Panel' }).first().click();
  await page.getByRole('radio', { name: 'Partidas y datos' }).click();
  await page.getByRole('button', { name: 'Analizar' }).first().click();
  await page.getByText('Fase 1 — tu análisis').waitFor();

  // Fase 1a: momento crítico — marcar la jugada del blunder (Ba6).
  await page.getByRole('button', { name: 'Ba6' }).click();
  await page.getByRole('button', { name: 'Confirmar momento crítico' }).click();

  // Fase 1b: plan.
  await page.getByText('¿Cuál era tu plan ahí?').waitFor();
  await page.locator('textarea').fill('Buscar cambiar el alfil por el caballo.');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Fase 1c: evaluaciones — el motor sigue sin haber corrido todavía.
  await page.getByText('Evaluá estas posiciones').waitFor();
  for (let i = 0; i < 3; i++) {
    const activo = await page.getByText('Evaluá estas posiciones').isVisible().catch(() => false);
    if (!activo) break;
    await page.getByText('= (igual)').click();
  }

  // Recién ahora corre el motor real (RF-3.1: bloqueado hasta acá).
  await page.getByText('Fase 2 — el motor').waitFor({ timeout: 60_000 });

  // El motor real detecta el blunder: Ba6 aparece en rojo en la lista y hay
  // al menos un error a revisar.
  await expect(page.getByRole('button', { name: 'Revisar errores' })).toBeVisible();
  await expect(page.locator('span.text-error-text', { hasText: 'Ba6' })).toBeVisible();

  await page.getByRole('button', { name: /Revisar errores/ }).click();
  await page.getByText('Confirmá y categorizá').waitFor();

  // El total de errores a resolver está en "Error {actual} de {total}"; se lee
  // antes de confirmar para saber cuántas veces más descartar sin necesidad de
  // sondear el DOM en una carrera contra la transición de pantalla.
  const progresoTexto = await page.getByText(/Error \d+ de \d+/).innerText();
  const total = Number(/de (\d+)/.exec(progresoTexto)?.[1] ?? '1');

  await page.getByRole('button', { name: 'Táctico' }).click();
  await page.getByRole('button', { name: 'Agregar a la Cola' }).click();
  for (let i = 1; i < total; i++) {
    await page.getByRole('button', { name: 'Descartar' }).click();
  }
  await page.getByText('Análisis completo').waitFor();
  await page.getByRole('button', { name: 'Volver al Panel' }).click();

  // La partida queda marcada como analizada.
  await page.getByText('Analizada').first().waitFor();

  // La tarjeta creada aparece como repaso vencido en la sesión de hoy
  // (criterio de salida de Fase 2: "verlas aparecer en la sesión del día siguiente").
  await page.locator('nav:visible button', { hasText: 'Hoy' }).first().click();
  await page.reload();
  await page.getByText(/Tenés \d+ repasos? vencidos?\./).waitFor();
});
