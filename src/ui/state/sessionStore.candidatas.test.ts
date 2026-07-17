// Test de integración de la regla de candidatas (RF-5.8) dentro de la
// sesión: en un ítem muestreado, la primera jugada no revela — pregunta
// "¿hay algo mejor?" y permite mantener o cambiar antes de resolver.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './sessionStore';
import { db } from '../../services/storage/db';
import { seedCurriculumItems } from '../../services/puzzles/curriculumSeedData';
import { newCurriculumProgress } from '../../core/curriculum';

beforeEach(async () => {
  await db.games.clear();
  await db.errorCards.clear();
  await db.radarItems.clear();
  await db.calibrationRecords.clear();
  await db.radarProgress.clear();
  await db.radarDatasetMeta.clear();
  await db.radarAttempts.clear();
  await db.curriculumItems.clear();
  await db.curriculumDatasetMeta.clear();
  await db.curriculumProgress.clear();
  await db.profile.clear();
  await db.candidataAttempts.clear();
  // Currículo automatizado, como en sessionStore.test.ts: estos tests solo prueban el Radar.
  await db.curriculumProgress.bulkPut(
    seedCurriculumItems.map((item) => ({ ...newCurriculumProgress(item.id), demostracionesLimpias: 3 })),
  );
});

describe('sessionStore — regla de candidatas (RF-5.8)', () => {
  it('en un ítem no muestreado, la primera jugada resuelve directo (sin pasar por "candidata")', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // nunca muestrear candidatas ni confianza
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    expect(s.radarCandidataActiva).toBe(false);
    const item = s.radarItem!;

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];
    await s.radarUserMove(from as never, to as never);
    vi.restoreAllMocks();

    s = useSessionStore.getState();
    expect(s.radarSubPhase).toBe('feedback');
    expect(await db.candidataAttempts.count()).toBe(0);
  });

  it('en un ítem muestreado, la primera jugada pasa por "candidata" antes de revelar', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // siempre muestrear candidatas (y confianza, irrelevante acá)
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    expect(s.radarCandidataActiva).toBe(true);

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos[0];
    await s.radarUserMove(from as never, to as never);
    vi.restoreAllMocks();

    s = useSessionStore.getState();
    expect(s.radarSubPhase).toBe('candidata');
    expect(s.radarCandidataJugadaOriginal).toBe(from + to);
    // Todavía no resolvió: ni tarjeta de error ni intento de Radar persistidos.
    expect(await db.errorCards.count()).toBe(0);
    expect(await db.radarAttempts.count()).toBe(0);
  });

  it('"no, mantener esta" resuelve con la jugada original y registra sin-cambio', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const item = s.radarItem!;

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos[0];
    const jugadaOriginal = from + to;
    await s.radarUserMove(from as never, to as never);

    s = useSessionStore.getState();
    expect(s.radarSubPhase).toBe('candidata');
    s.radarCandidataDecidir(false);
    vi.restoreAllMocks();

    s = useSessionStore.getState();
    expect(['confianza', 'feedback']).toContain(s.radarSubPhase);
    expect(s.radarJugadaUsuario).toBe(jugadaOriginal);

    const attempts = await db.candidataAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ itemId: item.id, cambio: false, resultado: 'sin-cambio' });
  });

  it('"sí, cambiar" deshace la jugada, deja jugar de nuevo y registra si mejoró o empeoró', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const item = s.radarItem!;

    // Jugar deliberadamente algo distinto de la solución como primer intento.
    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];
    if (from + to === item.solucion[0]) return; // esa posición no tiene alternativa; no es el caso a probar
    await s.radarUserMove(from as never, to as never);

    s = useSessionStore.getState();
    expect(s.radarSubPhase).toBe('candidata');
    s.radarCandidataDecidir(true);

    s = useSessionStore.getState();
    expect(s.radarSubPhase).toBe('jugando'); // deshizo la jugada y vuelve a "jugando"
    expect(s.fen).toBe(item.fen); // el tablero volvió a la posición original

    // Segundo intento: ahora sí, la solución correcta (mejoró).
    const solFrom = item.solucion[0].slice(0, 2);
    const solTo = item.solucion[0].slice(2, 4);
    await s.radarUserMove(solFrom as never, solTo as never);
    vi.restoreAllMocks();

    s = useSessionStore.getState();
    expect(s.radarJugadaUsuario).toBe(item.solucion[0]);
    expect(s.radarUltimoAcierto).toBe(true);

    const attempts = await db.candidataAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ itemId: item.id, cambio: true, resultado: 'mejoro' });
  });
});
