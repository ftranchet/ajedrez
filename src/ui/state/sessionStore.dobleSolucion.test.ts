// Test de integración de doble solución (E5, RF-5.7) dentro de la sesión:
// conformarse con la familiar cuenta como acierto (no genera tarjeta de
// error) pero se registra aparte para medir la tasa de conformismo.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from './sessionStore';
import { db } from '../../services/storage/db';
import { seedCurriculumItems } from '../../services/puzzles/curriculumSeedData';
import { newCurriculumProgress } from '../../core/curriculum';
import { RADAR_DATASET_VERSION } from '../../services/puzzles/seedData';
import type { RadarItem } from '../../core/types';

const item: RadarItem = {
  id: 'dobsol-e2e-1',
  fen: 'r3k2r/ppp2ppp/2b5/3QP3/4n2q/B1P3P1/P1P2P1P/R3KB1R w KQkq - 1 12',
  tipo: 'ofensiva',
  temas: ['fixture'],
  rating: 1500,
  solucion: ['d5c6'],
  fuente: 'pipeline-doble-solucion',
  dobleSolucion: { familiar: 'f1b5' },
};

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
  await db.dobleSolucionAttempts.clear();
  await db.radarItems.put(item);
  await db.radarDatasetMeta.put({ id: 'catalogo', version: RADAR_DATASET_VERSION, seededAt: new Date().toISOString() });
  await db.curriculumProgress.bulkPut(
    seedCurriculumItems.map((c) => ({ ...newCurriculumProgress(c.id), demostracionesLimpias: 3 })),
  );
});

describe('sessionStore — doble solución (RF-5.7)', () => {
  it('jugar la superior cuenta como acierto y no registra conformismo', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // sin candidatas ni confianza
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    s.radarEval('igual');
    await s.radarUserMove('d5' as never, 'c6' as never);
    vi.restoreAllMocks();

    const after = useSessionStore.getState();
    expect(after.radarUltimoAcierto).toBe(true);
    expect(await db.errorCards.count()).toBe(0);
    const attempts = await db.dobleSolucionAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].resultado).toBe('superior');
  });

  it('jugar la familiar cuenta como acierto (sin tarjeta de error) pero registra conformismo', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    s.radarEval('igual');
    await s.radarUserMove('f1' as never, 'b5' as never);
    vi.restoreAllMocks();

    const after = useSessionStore.getState();
    expect(after.radarUltimoAcierto).toBe(true);
    expect(after.radarFeedbackTexto).toContain('d5c6'); // menciona la jugada superior
    expect(await db.errorCards.count()).toBe(0);
    const attempts = await db.dobleSolucionAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].resultado).toBe('familiar');
  });

  it('jugar cualquier otra cosa es un fallo genuino: tarjeta de error y sin registro de conformismo', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    s.radarEval('igual');
    await s.radarUserMove('d5' as never, 'd4' as never); // legal, pero ni superior ni familiar
    vi.restoreAllMocks();

    const after = useSessionStore.getState();
    expect(after.radarUltimoAcierto).toBe(false);
    expect(await db.errorCards.count()).toBe(1);
    const attempts = await db.dobleSolucionAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].resultado).toBe('otra');
  });
});
