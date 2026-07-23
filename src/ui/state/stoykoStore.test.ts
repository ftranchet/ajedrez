// Test de integración de Stoyko semanal (E7, RF-7.2) contra Dexie real: se
// anotan candidatas antes de revelar, se compara con la línea del motor y
// se registra para calibración (E10) y para el enfriamiento semanal.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoykoStore } from './stoykoStore';
import { db } from '../../services/storage/db';
import { STOYKO_DATASET_VERSION } from '../../services/puzzles/stoykoSeedData';
import type { Profile, StoykoItem } from '../../core/types';
import { stoykoItemRepo } from '../../services/storage/stoykoItemRepo';

const item: StoykoItem = {
  id: 'stoyko-test-1',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  mejorLinea: ['f1c4', 'f8c5', 'e1g1'],
  evaluacionMotor: '=',
  fuente: 'seed-dev',
};

async function seedProfile(overrides: Partial<Profile> = {}) {
  await db.profile.put({ id: 'principal', bandaElo: 'elemental', diagnosticoCompletadoEn: '2026-07-01T00:00:00.000Z', ...overrides });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.stoykoItems.clear();
  await db.stoykoDatasetMeta.clear();
  await db.calibrationRecords.clear();
  await db.stoykoAttempts.clear();
  await db.profile.clear();
  await db.stoykoItems.put(item);
  await db.stoykoDatasetMeta.put({ id: 'catalogo', version: STOYKO_DATASET_VERSION, seededAt: new Date().toISOString() });
});

describe('stoykoStore', () => {
  it('sale de la carga ante un fallo del catálogo y permite reintentar', async () => {
    const failure = vi.spyOn(stoykoItemRepo, 'ensureSeeded').mockRejectedValueOnce(new Error('indexeddb'));

    await useStoykoStore.getState().empezar(true);
    expect(useStoykoStore.getState().phase).toBe('error');

    failure.mockRestore();
    await useStoykoStore.getState().empezar(true);
    expect(useStoykoStore.getState().phase).toBe('analizando');
  });

  it('sin perfil (nunca se hizo), sirve el ítem apto determinísticamente', async () => {
    await useStoykoStore.getState().empezar();
    const s = useStoykoStore.getState();
    expect(s.phase).toBe('analizando');
    expect(s.item?.id).toBe(item.id);
  });

  it('en enfriamiento si ya se hizo dentro de los últimos 7 días', async () => {
    await seedProfile({ stoykoUltimaCompletadaEn: new Date().toISOString() });
    await useStoykoStore.getState().empezar();
    const s = useStoykoStore.getState();
    expect(s.phase).toBe('enfriamiento');
    expect(s.proximaDisponibleEn).not.toBeNull();
  });

  it('disponible de nuevo pasados los 7 días', async () => {
    await seedProfile({ stoykoUltimaCompletadaEn: '2026-07-01T00:00:00.000Z' });
    await useStoykoStore.getState().empezar();
    expect(useStoykoStore.getState().phase).toBe('analizando');
  });

  it('agregarCandidata rechaza formato inválido sin agregarla', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('caballo a f3');
    useStoykoStore.getState().agregarCandidata();
    const s = useStoykoStore.getState();
    expect(s.candidatas).toEqual([]);
    expect(s.inputError).not.toBeNull();
  });

  it('agregarCandidata rechaza una jugada ilegal en la posición', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('a2a5'); // el peón de a2 no llega a a5 de un salto
    useStoykoStore.getState().agregarCandidata();
    const s = useStoykoStore.getState();
    expect(s.candidatas).toEqual([]);
    expect(s.inputError).toBe('Esa jugada no es legal en esta posición.');
  });

  it('agregarCandidata rechaza una candidata repetida', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('f1c4');
    useStoykoStore.getState().agregarCandidata();
    useStoykoStore.getState().setInputActual('f1c4');
    useStoykoStore.getState().agregarCandidata();
    const s = useStoykoStore.getState();
    expect(s.candidatas).toHaveLength(1);
    expect(s.inputError).toBe('Ya anotaste esa candidata.');
  });

  it('terminarAnalisis no avanza sin al menos una candidata', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().terminarAnalisis();
    expect(useStoykoStore.getState().phase).toBe('analizando');
  });

  it('acierta si alguna candidata coincide con la línea del motor; persiste calibración y enfriamiento', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('d2d4');
    useStoykoStore.getState().agregarCandidata();
    useStoykoStore.getState().setEvalSeleccionada('±');
    useStoykoStore.getState().setInputActual('f1c4'); // coincide con mejorLinea[0]
    useStoykoStore.getState().agregarCandidata();
    useStoykoStore.getState().terminarAnalisis();
    expect(useStoykoStore.getState().phase).toBe('confianza');

    await useStoykoStore.getState().confirmarConfianza(80);
    const s = useStoykoStore.getState();
    expect(s.phase).toBe('revelado');
    expect(s.acierto).toBe(true);
    expect(s.lineaMotorSan.length).toBeGreaterThan(0);

    const records = await db.calibrationRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ contexto: 'stoyko', confianzaDeclarada: 80, acierto: true });

    const profile = await db.profile.get('principal');
    expect(profile?.stoykoUltimaCompletadaEn).toBe(records[0].fecha);

    // Persiste el intento entero (RF-7.2/7.3): candidatas con evaluación,
    // confianza y tiempo (cronómetro silencioso), no solo el acierto.
    const attempts = await db.stoykoAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ itemId: item.id, acierto: true, confianzaDeclarada: 80 });
    expect(attempts[0].candidatas.map((c) => c.jugada)).toEqual(['d2d4', 'f1c4']);
    expect(attempts[0].candidatas[1].evaluacion).toBe('±');
    expect(typeof attempts[0].tiempoMs).toBe('number');
    expect(attempts[0].tiempoMs).toBeGreaterThanOrEqual(0);
  });

  it('practicar durante el enfriamiento sirve una posición y NO mide ni resetea la semana', async () => {
    const ultima = '2026-07-20T00:00:00.000Z';
    await seedProfile({ stoykoUltimaCompletadaEn: ultima });
    await useStoykoStore.getState().empezar();
    expect(useStoykoStore.getState().phase).toBe('enfriamiento');

    await useStoykoStore.getState().practicar();
    let s = useStoykoStore.getState();
    expect(s.phase).toBe('analizando');
    expect(s.practica).toBe(true);

    s.setInputActual('f1c4'); // coincide con la línea del motor
    useStoykoStore.getState().agregarCandidata();
    useStoykoStore.getState().terminarAnalisis();
    await useStoykoStore.getState().confirmarConfianza(70);

    s = useStoykoStore.getState();
    expect(s.phase).toBe('revelado');
    expect(s.acierto).toBe(true); // se ve el resultado

    // Pero nada se persiste: sin calibración, sin intento, y el enfriamiento intacto.
    expect(await db.calibrationRecords.toArray()).toHaveLength(0);
    expect(await db.stoykoAttempts.toArray()).toHaveLength(0);
    const profile = await db.profile.get('principal');
    expect(profile?.stoykoUltimaCompletadaEn).toBe(ultima);
  });

  it('no acierta si ninguna candidata coincide con la línea del motor', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('d2d4');
    useStoykoStore.getState().agregarCandidata();
    useStoykoStore.getState().terminarAnalisis();

    await useStoykoStore.getState().confirmarConfianza(40);
    const s = useStoykoStore.getState();
    expect(s.acierto).toBe(false);

    const records = await db.calibrationRecords.toArray();
    expect(records[0]).toMatchObject({ acierto: false, confianzaDeclarada: 40 });
  });
});
