// Test de integración del análisis en dos fases (E3) contra Dexie real
// (fake-indexeddb). El motor real necesita un Worker de navegador, así que
// se reemplaza por un motor falso y determinístico (mismo patrón que
// services/analysis/gameAnalyzer.test.ts).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAnalysisEngine } from '../../test/fakeEngine';

vi.mock('../../services/engine/stockfishEngine', () => ({
  engine: new FakeAnalysisEngine(),
}));

const { useAnalysisStore } = await import('./analysisStore');
const { db } = await import('../../services/storage/db');
const { buildGameRecord } = await import('../../core/game');

// Partida con una jugada catastrófica clara: 4. Ba6?? entrega el alfil sin
// compensación (bxa6 lo captura gratis) — verificada jugada por jugada con
// chess.js antes de usarla acá, para que el motor falso (que solo cuenta
// piezas) detecte un error grave real, no uno de memoria.
const PGN_CON_ERROR = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Ba6 bxa6 *';

beforeEach(async () => {
  await db.games.clear();
  await db.errorCards.clear();
});

describe('analysisStore — fase 1', () => {
  it('carga la partida y arranca en la selección del momento crítico', async () => {
    const game = buildGameRecord({ pgn: PGN_CON_ERROR, resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);

    await useAnalysisStore.getState().iniciar(game.id);
    const s = useAnalysisStore.getState();
    expect(s.phase).toBe('fase1-momento');
    expect(s.moves.length).toBe(8); // 8 medias jugadas en el PGN
  });

  it('rechaza un momento crítico fuera de rango', async () => {
    const game = buildGameRecord({ pgn: PGN_CON_ERROR, resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);
    await useAnalysisStore.getState().iniciar(game.id);

    useAnalysisStore.getState().marcarMomentoCritico(999);
    expect(useAnalysisStore.getState().phase).toBe('fase1-momento'); // no avanza

    useAnalysisStore.getState().marcarMomentoCritico(5);
    expect(useAnalysisStore.getState().phase).toBe('fase1-plan');
  });

  it('el motor queda bloqueado hasta terminar las 3 evaluaciones de la fase 1', async () => {
    const game = buildGameRecord({ pgn: PGN_CON_ERROR, resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);
    await useAnalysisStore.getState().iniciar(game.id);
    useAnalysisStore.getState().marcarMomentoCritico(2);
    useAnalysisStore.getState().confirmarPlan('Desarrollar rápido y enrocar');

    let s = useAnalysisStore.getState();
    expect(s.phase).toBe('fase1-evaluaciones');
    expect(s.fase1Posiciones).toHaveLength(3);

    await s.evaluarPosicion('=');
    s = useAnalysisStore.getState();
    expect(s.phase).toBe('fase1-evaluaciones'); // todavía no completó las 3
    expect(s.analysis).toBeNull();

    await s.evaluarPosicion('=');
    await useAnalysisStore.getState().evaluarPosicion('=');
    s = useAnalysisStore.getState();
    // Recién acá corrió el motor (fase 2).
    expect(s.phase).toBe('fase2-resultado');
    expect(s.analysis).not.toBeNull();
    expect(s.game?.fase1).toBeDefined();
    expect(s.game?.analizada).toBe(true);
  });

  it('persiste la fase 1 en Dexie apenas se completa, antes de correr el motor', async () => {
    const game = buildGameRecord({ pgn: PGN_CON_ERROR, resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);
    await useAnalysisStore.getState().iniciar(game.id);
    useAnalysisStore.getState().marcarMomentoCritico(2);
    useAnalysisStore.getState().confirmarPlan('plan');
    await useAnalysisStore.getState().evaluarPosicion('=');
    await useAnalysisStore.getState().evaluarPosicion('=');
    await useAnalysisStore.getState().evaluarPosicion('=');

    const guardado = await db.games.get(game.id);
    expect(guardado?.fase1?.plan).toBe('plan');
    expect(guardado?.fase1?.evaluaciones).toHaveLength(3);
  });
});

describe('analysisStore — fase 2 y confirmación de errores', () => {
  async function llegarAResultado() {
    const game = buildGameRecord({ pgn: PGN_CON_ERROR, resultado: '*', tiemposPorJugadaMs: [], fuente: 'local', ritmo: 'sin-reloj' });
    await db.games.put(game);
    await useAnalysisStore.getState().iniciar(game.id);
    useAnalysisStore.getState().marcarMomentoCritico(2);
    useAnalysisStore.getState().confirmarPlan('plan');
    await useAnalysisStore.getState().evaluarPosicion('=');
    await useAnalysisStore.getState().evaluarPosicion('=');
    await useAnalysisStore.getState().evaluarPosicion('=');
    return game;
  }

  it('detecta la jugada catastrófica (Qxh7??) como error a confirmar', async () => {
    await llegarAResultado();
    useAnalysisStore.getState().continuarAErrores();
    const s = useAnalysisStore.getState();
    expect(s.phase).toBe('confirmar-errores');
    expect(s.erroresPendientes.length).toBeGreaterThan(0);
  });

  it('confirmar un error crea una ErrorCard categorizada y origen partida (RF-3.3)', async () => {
    await llegarAResultado();
    useAnalysisStore.getState().continuarAErrores();
    useAnalysisStore.getState().elegirCategoria('psicologico');
    await useAnalysisStore.getState().confirmarErrorActual();

    const cards = await db.errorCards.toArray();
    expect(cards).toHaveLength(1);
    expect(cards[0].origen).toBe('partida');
    expect(cards[0].categoria).toBe('psicologico');
  });

  it('descartar un error no crea tarjeta y avanza al siguiente', async () => {
    await llegarAResultado();
    useAnalysisStore.getState().continuarAErrores();
    const pendientesAntes = useAnalysisStore.getState().erroresPendientes.length;
    useAnalysisStore.getState().descartarErrorActual();
    expect(await db.errorCards.count()).toBe(0);
    expect(useAnalysisStore.getState().erroresPendientes.length).toBe(pendientesAntes - 1);
  });

  it('termina en "fin" cuando se resolvieron todos los errores pendientes', async () => {
    await llegarAResultado();
    useAnalysisStore.getState().continuarAErrores();
    let s = useAnalysisStore.getState();
    const total = s.erroresPendientes.length;
    for (let i = 0; i < total; i++) {
      await useAnalysisStore.getState().confirmarErrorActual();
    }
    s = useAnalysisStore.getState();
    expect(s.phase).toBe('fin');
    expect(s.erroresConfirmados).toBe(total);
  });

  it('volver() reinicia todo el estado', async () => {
    await llegarAResultado();
    useAnalysisStore.getState().volver();
    const s = useAnalysisStore.getState();
    expect(s.phase).toBe('inactivo');
    expect(s.game).toBeNull();
    expect(s.analysis).toBeNull();
  });
});
