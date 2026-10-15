// La partida local contra el motor (RF-1.1, RF-1.3). El motor real necesita
// un Worker de navegador y el repositorio, IndexedDB: los dos se reemplazan
// por dobles que permiten simular una caída del motor a mitad de partida.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Square } from 'chess.js';
import type { GameRecord } from '../../core/types';

const { motor, guardadas } = vi.hoisted(() => {
  const guardadas: GameRecord[] = [];
  const motor = {
    /** Cuántas consultas seguidas fallan antes de que el motor vuelva a responder. */
    fallas: 0,
    jugadas: [] as string[],
    /** FEN de cada consulta, para comprobar que el reintento pide la misma posición. */
    consultas: [] as string[],
    async init() {},
    async bestMove(fen: string): Promise<string> {
      motor.consultas.push(fen);
      if (motor.fallas > 0) {
        motor.fallas -= 1;
        throw new Error('El motor se cayó; se reinicia en la próxima consulta.');
      }
      const jugada = motor.jugadas.shift();
      if (!jugada) throw new Error('jugada falsa agotada');
      return jugada;
    },
    async evaluate(): Promise<never> {
      throw new Error('la partida local no evalúa');
    },
    dispose() {},
  };
  return { motor, guardadas };
});

vi.mock('../../services/engine/stockfishEngine', () => ({ engine: motor }));
vi.mock('../../services/storage/gameRepo', () => ({
  gameRepo: {
    async save(game: GameRecord) {
      guardadas.push(game);
    },
  },
}));
vi.mock('../../services/storage/trainingEventRepo', () => ({ registrarTiempoEntrenado() {} }));

const { useGameStore } = await import('./gameStore');

const DESPUES_DE_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

beforeEach(() => {
  motor.fallas = 0;
  motor.jugadas = [];
  motor.consultas = [];
  guardadas.length = 0;
  useGameStore.getState().reset();
});

describe('gameStore — caída del motor (B15)', () => {
  it('reintentar pide la jugada en la misma posición y la partida sigue entera', async () => {
    motor.fallas = 1;
    motor.jugadas = ['e7e5'];
    await useGameStore.getState().start('nivel-1', 'w');

    await useGameStore.getState().userMove('e2' as Square, 'e4' as Square);
    // Antes la única salida era "Otra partida", que tiraba la partida entera.
    expect(useGameStore.getState()).toMatchObject({
      phase: 'playing',
      engineError: true,
      thinking: false,
      fen: DESPUES_DE_E4,
      sanMoves: ['e4'],
    });

    await useGameStore.getState().reintentarMotor();

    expect(motor.consultas).toEqual([DESPUES_DE_E4, DESPUES_DE_E4]);
    expect(useGameStore.getState()).toMatchObject({
      phase: 'playing',
      engineError: false,
      thinking: false,
      turn: 'w',
      sanMoves: ['e4', 'e5'],
      lastMove: ['e7', 'e5'],
    });

    // La partida retomada se guarda con todas sus jugadas.
    await useGameStore.getState().resign();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].pgn).toContain('1. e4 e5');
  });

  it('con negras, reintentar recupera la primera jugada del motor', async () => {
    motor.fallas = 1;
    motor.jugadas = ['d2d4'];
    await useGameStore.getState().start('nivel-1', 'b');
    expect(useGameStore.getState()).toMatchObject({ phase: 'playing', engineError: true, sanMoves: [] });

    await useGameStore.getState().reintentarMotor();

    expect(useGameStore.getState()).toMatchObject({ engineError: false, turn: 'b', sanMoves: ['d4'] });
  });

  it('si vuelve a fallar, la partida sigue esperando otro reintento', async () => {
    motor.fallas = 2;
    motor.jugadas = ['e7e5'];
    await useGameStore.getState().start('nivel-1', 'w');
    await useGameStore.getState().userMove('e2' as Square, 'e4' as Square);

    await useGameStore.getState().reintentarMotor();
    expect(useGameStore.getState()).toMatchObject({ phase: 'playing', engineError: true, sanMoves: ['e4'] });

    await useGameStore.getState().reintentarMotor();
    expect(useGameStore.getState()).toMatchObject({ engineError: false, sanMoves: ['e4', 'e5'] });
  });

  it('sin una caída del motor, reintentar no hace nada', async () => {
    await useGameStore.getState().start('nivel-1', 'w');

    await useGameStore.getState().reintentarMotor();

    expect(motor.consultas).toEqual([]);
    expect(useGameStore.getState()).toMatchObject({ phase: 'playing', turn: 'w', sanMoves: [] });
  });
});
