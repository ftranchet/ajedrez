// Test de integración de Cálculo comprometido (E7, RF-7.1) contra Dexie
// real: la línea se declara completa antes de revelar, y se puntúa entera.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCompromisoStore } from './compromisoStore';
import { db } from '../../services/storage/db';
import { RADAR_DATASET_VERSION } from '../../services/puzzles/seedData';
import type { RadarItem } from '../../core/types';

const item: RadarItem = {
  id: 'compromiso-e2e-1',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  tipo: 'ofensiva',
  temas: ['fixture'],
  rating: 1400,
  solucion: ['f1c4', 'f8c5', 'e1g1'],
  fuente: 'seed-dev',
};

beforeEach(async () => {
  await db.radarItems.clear();
  await db.radarDatasetMeta.clear();
  await db.compromisoAttempts.clear();
  await db.radarItems.put(item);
  await db.radarDatasetMeta.put({ id: 'catalogo', version: RADAR_DATASET_VERSION, seededAt: new Date().toISOString() });
});

describe('compromisoStore', () => {
  it('con un único ítem apto en el pool, lo sirve determinísticamente', async () => {
    await useCompromisoStore.getState().empezar();
    const s = useCompromisoStore.getState();
    expect(s.phase).toBe('jugando');
    expect(s.item?.id).toBe(item.id);
  });

  it('no revela hasta completar la línea entera (RF-7.1)', async () => {
    await useCompromisoStore.getState().empezar();
    useCompromisoStore.getState().setInputActual('f1c4');
    useCompromisoStore.getState().agregarJugada();
    let s = useCompromisoStore.getState();
    expect(s.phase).toBe('jugando'); // todavía faltan 2 plies
    expect(s.lineaIngresada).toEqual(['f1c4']);
    expect(await db.compromisoAttempts.count()).toBe(0);

    useCompromisoStore.getState().setInputActual('f8c5');
    useCompromisoStore.getState().agregarJugada();
    s = useCompromisoStore.getState();
    expect(s.phase).toBe('jugando');
  });

  it('línea completa y correcta: se puntúa entera y persiste el intento', async () => {
    await useCompromisoStore.getState().empezar();
    for (const jugada of item.solucion) {
      useCompromisoStore.getState().setInputActual(jugada);
      useCompromisoStore.getState().agregarJugada();
    }
    const s = useCompromisoStore.getState();
    expect(s.phase).toBe('feedback');
    expect(s.resultado).toEqual({ correcta: true, primerErrorEn: null });
    expect(s.lineaUsuarioSan).toEqual(s.lineaSolucionSan);

    const attempts = await db.compromisoAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ itemId: item.id, profundidad: 3, correcta: true, primerErrorEn: null });
  });

  it('registra el tiempo en silencio (RF-7.3: sin cronómetro visible)', async () => {
    await useCompromisoStore.getState().empezar();
    for (const jugada of item.solucion) {
      useCompromisoStore.getState().setInputActual(jugada);
      useCompromisoStore.getState().agregarJugada();
    }
    const attempts = await db.compromisoAttempts.toArray();
    expect(typeof attempts[0].tiempoMs).toBe('number');
    expect(attempts[0].tiempoMs).toBeGreaterThanOrEqual(0);
  });

  it('un error en la segunda jugada marca la línea entera como incorrecta, con el índice del primer error', async () => {
    await useCompromisoStore.getState().empezar();
    useCompromisoStore.getState().setInputActual('f1c4');
    useCompromisoStore.getState().agregarJugada();
    useCompromisoStore.getState().setInputActual('g8f6'); // no es f8c5
    useCompromisoStore.getState().agregarJugada();
    useCompromisoStore.getState().setInputActual('e1g1');
    useCompromisoStore.getState().agregarJugada();

    const s = useCompromisoStore.getState();
    expect(s.phase).toBe('feedback');
    expect(s.resultado).toEqual({ correcta: false, primerErrorEn: 1 });

    const attempts = await db.compromisoAttempts.toArray();
    expect(attempts[0]).toMatchObject({ correcta: false, primerErrorEn: 1 });
  });

  it('rechaza un formato de jugada inválido sin agregarla a la línea', async () => {
    await useCompromisoStore.getState().empezar();
    useCompromisoStore.getState().setInputActual('caballo a f3');
    useCompromisoStore.getState().agregarJugada();
    const s = useCompromisoStore.getState();
    expect(s.lineaIngresada).toEqual([]);
    expect(s.inputError).not.toBeNull();
  });

  it('rechaza una jugada bien formada pero ilegal en la posición (LineComposer, design system §5)', async () => {
    await useCompromisoStore.getState().empezar();
    useCompromisoStore.getState().setInputActual('e2e4'); // el peón ya está en e4 en este FEN
    useCompromisoStore.getState().agregarJugada();
    const s = useCompromisoStore.getState();
    expect(s.lineaIngresada).toEqual([]);
    expect(s.inputError).not.toBeNull();
  });

  it('valida la legalidad de cada ply contra la línea ya declarada, no contra la posición inicial', async () => {
    await useCompromisoStore.getState().empezar();
    useCompromisoStore.getState().setInputActual('f1c4');
    useCompromisoStore.getState().agregarJugada();
    // f1c4 otra vez: era legal en la posición inicial, pero ya no después de
    // la primera jugada de la línea (el alfil ya salió de f1).
    useCompromisoStore.getState().setInputActual('f1c4');
    useCompromisoStore.getState().agregarJugada();
    const s = useCompromisoStore.getState();
    expect(s.lineaIngresada).toEqual(['f1c4']);
    expect(s.inputError).not.toBeNull();
  });

  it('borrarUltima() quita la última jugada declarada', async () => {
    await useCompromisoStore.getState().empezar();
    useCompromisoStore.getState().setInputActual('f1c4');
    useCompromisoStore.getState().agregarJugada();
    useCompromisoStore.getState().borrarUltima();
    const s = useCompromisoStore.getState();
    expect(s.lineaIngresada).toEqual([]);
    expect(s.phase).toBe('jugando');
  });

  it('siguiente() vuelve a arrancar la línea de cero', async () => {
    await useCompromisoStore.getState().empezar();
    for (const jugada of item.solucion) {
      useCompromisoStore.getState().setInputActual(jugada);
      useCompromisoStore.getState().agregarJugada();
    }
    useCompromisoStore.getState().siguiente();
    const s = useCompromisoStore.getState();
    expect(s.phase).toBe('jugando');
    expect(s.lineaIngresada).toEqual([]);
  });
});
