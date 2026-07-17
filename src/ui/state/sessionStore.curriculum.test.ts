// Test de integración del bloque de currículo (E6, RF-6.1/6.3) dentro de la
// sesión: Cola vencida → currículo vencido → Radar (RF-11.2). A diferencia de
// sessionStore.test.ts, acá el currículo arranca "nuevo" (sin marcar
// automatizado), que es el estado real de una instalación fresca.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './sessionStore';
import { db } from '../../services/storage/db';
import { seedCurriculumItems } from '../../services/puzzles/curriculumSeedData';
import { dietaPorBanda } from '../../core/prescriptor';
import { DEFAULT_PROFILE } from '../../services/storage/profileRepo';

// Perfil por defecto (sin diagnóstico): fija cuántos elementos del
// currículo sirve el Prescriptor por sesión (RF-11.2).
const CURRICULUM_MAX = dietaPorBanda(DEFAULT_PROFILE.bandaElo, []).curriculumMax;

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
});

describe('sessionStore — bloque de currículo', () => {
  it('sin tarjetas vencidas en la Cola, arranca en el currículo antes que el Radar', async () => {
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    expect(s.phase).toBe('curriculo');
    expect(s.curriculumQueue).toHaveLength(CURRICULUM_MAX);
    expect(await db.curriculumItems.count()).toBe(seedCurriculumItems.length);
  });

  it('nunca sirve el mismo patrón dos veces seguidas (interleaving, RF-6.1)', async () => {
    await useSessionStore.getState().start();
    const { curriculumQueue } = useSessionStore.getState();
    for (let i = 1; i < curriculumQueue.length; i++) {
      expect(curriculumQueue[i].patternKey).not.toBe(curriculumQueue[i - 1].patternKey);
    }
  });

  it('una demostración limpia suma al contador y persiste el progreso', async () => {
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    const item = s.curriculumQueue[0];
    const [from, to] = [item.solucion[0].slice(0, 2), item.solucion[0].slice(2, 4)];

    await s.curriculumUserMove(from as never, to as never);
    const after = useSessionStore.getState();
    expect(after.curriculumUltimaLimpia).toBe(true);
    expect(after.curriculumSubPhase).toBe('feedback');

    const progreso = await db.curriculumProgress.get(item.id);
    expect(progreso?.demostracionesLimpias).toBe(1);
  });

  it('una jugada equivocada reinicia el contador a cero', async () => {
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    const item = s.curriculumQueue[0];
    // Cualquier jugada legal que no sea la solución.
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]);
    if (!to) throw new Error('la posición semilla no tiene otra jugada legal para probar el fallo');

    await s.curriculumUserMove(from as never, to as never);
    const after = useSessionStore.getState();
    expect(after.curriculumUltimaLimpia).toBe(false);

    const progreso = await db.curriculumProgress.get(item.id);
    expect(progreso?.demostracionesLimpias).toBe(0);
  });

  it('recorre todo el currículo vencido y pasa al Radar', async () => {
    await useSessionStore.getState().start();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let s = useSessionStore.getState();
    let guard = 0;
    while (s.phase === 'curriculo' && guard < seedCurriculumItems.length + 1) {
      const item = s.curriculumQueue[s.curriculumIndex];
      const [from, to] = [item.solucion[0].slice(0, 2), item.solucion[0].slice(2, 4)];
      await s.curriculumUserMove(from as never, to as never);
      s = useSessionStore.getState();
      s.curriculumContinuar();
      s = useSessionStore.getState();
      guard++;
    }
    vi.restoreAllMocks();
    expect(s.phase).toBe('radar');
    expect(guard).toBe(CURRICULUM_MAX);
  });

  it('un elemento con 3 demostraciones limpias ya guardadas (automatizado) no aparece en la sesión', async () => {
    // El contador de demostraciones limpias en sí ya está probado en
    // core/curriculum.test.ts; acá se prueba el cableado: el store respeta
    // el progreso persistido al armar la cola del día.
    const automatizado = seedCurriculumItems[0];
    await db.curriculumProgress.put({
      id: automatizado.id,
      fsrs: {
        due: '2026-01-01T00:00:00.000Z', // vencido, pero no importa: está automatizado
        stability: 5,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 3,
        lapses: 0,
        learningSteps: 0,
        state: 'review',
        lastReview: '2026-01-01T00:00:00.000Z',
      },
      demostracionesLimpias: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    expect(s.curriculumQueue.find((i) => i.id === automatizado.id)).toBeUndefined();
    // Quedan 7 patrones vencidos (8 menos el automatizado), pero la dieta topa a CURRICULUM_MAX.
    expect(s.curriculumQueue).toHaveLength(CURRICULUM_MAX);
  });
});
