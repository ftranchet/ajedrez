// Test de integración del diagnóstico inicial (RF-11.4), enfocado en la
// guarda que evita pisar una partida en curso: useGameStore es compartido
// con la pantalla Jugar (RF-1.3) y sigue vivo aunque esa pantalla esté
// desmontada, así que empezar el diagnóstico sin esta guarda reseteaba
// cualquier partida abierta ahí sin avisar.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDiagnosticoStore } from './diagnosticoStore';
import { useGameStore } from './gameStore';
import { db } from '../../services/storage/db';

beforeEach(async () => {
  await db.profile.clear();
  useDiagnosticoStore.setState({ phase: 'inactivo' });
  useGameStore.getState().reset();
});

describe('diagnosticoStore — guarda contra partida en curso', () => {
  it('no arranca ni resetea useGameStore si hay una partida en curso (phase: playing)', async () => {
    // Simula una partida en curso en Jugar sin depender de un motor real
    // (el store zustand es el mismo singleton que usaría esa pantalla).
    useGameStore.setState({ phase: 'playing', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' });

    await useDiagnosticoStore.getState().empezarJuego1();

    expect(useDiagnosticoStore.getState().phase).toBe('inactivo');
    // La partida sigue exactamente donde estaba: reset() no se llamó.
    expect(useGameStore.getState().phase).toBe('playing');
    expect(useGameStore.getState().fen).toBe('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  });

  it('sin partida en curso, sí resetea useGameStore y pasa a la fase juego1', async () => {
    useGameStore.setState({ phase: 'ended' });

    // start() del gameStore intentaría inicializar el motor real (Worker),
    // no disponible en este entorno de test: alcanza con verificar que la
    // guarda deja pasar y dispara el reset + el arranque, que es la parte
    // de esta lógica que no depende del motor. Sin await: start() es async
    // y corre sincrónicamente hasta su primer await interno (engine.init()),
    // que ya deja fen/phase reseteados a la partida nueva antes de colgarse
    // esperando al motor.
    void useDiagnosticoStore.getState().empezarJuego1();

    expect(useDiagnosticoStore.getState().phase).toBe('juego1');
    // 'ended' quedó atrás: reset() + start() ya corrieron su parte sincrónica.
    expect(useGameStore.getState().phase).toBe('loading');
  });
});
