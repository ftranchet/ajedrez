// Test de integración del diagnóstico inicial (RF-11.4), enfocado en la
// guarda que evita pisar una partida en curso: useGameStore es compartido
// con la pantalla Jugar (RF-1.3) y sigue vivo aunque esa pantalla esté
// desmontada, así que empezar el diagnóstico sin esta guarda reseteaba
// cualquier partida abierta ahí sin avisar.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIAGNOSTICO_JUEGO1_NIVEL,
  useDiagnosticoStore,
} from './diagnosticoStore';
import { useGameStore } from './gameStore';
import { db } from '../../services/storage/db';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { RADAR_INITIAL_STATE } from '../../core/radar';
import type { RadarItem } from '../../core/types';

const originalGameStart = useGameStore.getState().start;

const radarFixture: RadarItem = {
  id: 'diagnostico-test-1',
  fen: 'rnb1kbnr/ppp2ppp/8/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 2 4',
  tipo: 'envenenada',
  temas: ['test'],
  rating: 1200,
  solucion: ['d5h5'],
  fuente: 'seed-dev',
};

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.profile.clear();
  useGameStore.setState({ start: originalGameStart });
  useGameStore.getState().reset();
  useDiagnosticoStore.setState({
    phase: 'inactivo',
    pausedPhase: null,
    resultadoJuego1: null,
    resultadoJuego2: null,
    radarPool: [],
    radarLoadStatus: 'inactivo',
    resultSaveStatus: 'inactivo',
    radarSelState: RADAR_INITIAL_STATE,
    radarItem: null,
    radarSubPhase: 'evaluando',
    radarServidos: 0,
    radarAciertos: 0,
    radarRespuestas: [],
    radarCalibraciones: [],
    radarEvalGuess: null,
    radarJugadaUsuario: null,
    partidaIds: [],
    lineaBase: null,
    ratingExternoGuardado: null,
  });
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

  it('tampoco interrumpe una partida libre cuyo motor todavía está cargando', async () => {
    const start = vi.fn(async () => undefined);
    useGameStore.setState({ phase: 'loading', start });

    await useDiagnosticoStore.getState().empezarJuego1();

    expect(useDiagnosticoStore.getState().phase).toBe('inactivo');
    expect(useGameStore.getState().phase).toBe('loading');
    expect(start).not.toHaveBeenCalled();
  });

  it('sin partida en curso, sí resetea useGameStore y pasa a la fase juego1', async () => {
    const start = vi.fn(async () => {
      useGameStore.setState({ phase: 'loading' });
    });
    useGameStore.setState({ phase: 'ended', start });

    await useDiagnosticoStore.getState().empezarJuego1();

    expect(useDiagnosticoStore.getState().phase).toBe('juego1');
    expect(useGameStore.getState().phase).toBe('loading');
    expect(start).toHaveBeenCalledOnce();
  });
});

describe('diagnosticoStore — pausa y recuperación', () => {
  it('no pausa mientras el motor o el guardado final todavía pueden mutar el avance', () => {
    useDiagnosticoStore.setState({ phase: 'juego1' });
    useGameStore.setState({ phase: 'loading', thinking: false });
    useDiagnosticoStore.getState().pausar();
    expect(useDiagnosticoStore.getState().phase).toBe('juego1');

    useGameStore.setState({ phase: 'playing', thinking: true });
    useDiagnosticoStore.getState().pausar();
    expect(useDiagnosticoStore.getState().phase).toBe('juego1');

    useGameStore.setState({ thinking: false });
    useDiagnosticoStore.setState({ phase: 'radar', resultSaveStatus: 'guardando' });
    useDiagnosticoStore.getState().pausar();
    expect(useDiagnosticoStore.getState().phase).toBe('radar');
  });

  it('pausa y reanuda una partida sin tocar el tablero compartido', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    useDiagnosticoStore.setState({ phase: 'juego1' });
    useGameStore.setState({ phase: 'playing', fen, sanMoves: ['e4', 'e5', 'Nf3', 'Nc6'] });

    useDiagnosticoStore.getState().pausar();

    expect(useDiagnosticoStore.getState().phase).toBe('pausado');
    expect(useDiagnosticoStore.getState().pausedPhase).toBe('juego1');
    expect(useGameStore.getState().phase).toBe('playing');
    expect(useGameStore.getState().fen).toBe(fen);
    expect(useGameStore.getState().sanMoves).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);

    useDiagnosticoStore.getState().reanudar();

    expect(useDiagnosticoStore.getState().phase).toBe('juego1');
    expect(useDiagnosticoStore.getState().pausedPhase).toBeNull();
    expect(useGameStore.getState().fen).toBe(fen);
  });

  it('pausa y reanuda el Radar conservando posición, subfase y contadores', () => {
    useDiagnosticoStore.setState({
      phase: 'radar',
      radarLoadStatus: 'listo',
      radarPool: [radarFixture],
      radarItem: radarFixture,
      radarSubPhase: 'feedback',
      radarServidos: 7,
      radarAciertos: 5,
    });

    useDiagnosticoStore.getState().pausar();
    useDiagnosticoStore.getState().reanudar();

    const state = useDiagnosticoStore.getState();
    expect(state.phase).toBe('radar');
    expect(state.radarItem).toEqual(radarFixture);
    expect(state.radarSubPhase).toBe('feedback');
    expect(state.radarServidos).toBe(7);
    expect(state.radarAciertos).toBe(5);
  });

  it('reintenta el motor en la misma etapa y conserva el color ya sorteado', async () => {
    const start = vi.fn(async () => undefined);
    useDiagnosticoStore.setState({ phase: 'juego1' });
    useGameStore.setState({
      phase: 'setup',
      engineError: true,
      levelId: DIAGNOSTICO_JUEGO1_NIVEL,
      playerColor: 'b',
      start,
    });

    await useDiagnosticoStore.getState().reintentarJuego();

    expect(start).toHaveBeenCalledOnce();
    // El contexto viaja también en el reintento: sin él, la partida rehecha se
    // guardaría como una partida propia y volvería a ocupar el compromiso
    // semanal de partida lenta (core/slowGame.ts).
    expect(start).toHaveBeenCalledWith(DIAGNOSTICO_JUEGO1_NIVEL, 'b', 'diagnostico');
  });

  it('muestra error si preparar Radar falla y permite reintentar sin perder resultados', async () => {
    const ensureSeeded = vi
      .spyOn(radarItemRepo, 'ensureSeeded')
      .mockRejectedValueOnce(new Error('IndexedDB no disponible'))
      .mockResolvedValue(undefined);
    vi.spyOn(radarItemRepo, 'list').mockResolvedValue([radarFixture]);
    useDiagnosticoStore.setState({ phase: 'juego2', resultadoJuego1: 'tablas' });
    useGameStore.setState({ phase: 'ended', resultado: '0-1', playerColor: 'w' });

    await useDiagnosticoStore.getState().registrarResultadoJuego();

    let state = useDiagnosticoStore.getState();
    expect(state.phase).toBe('radar');
    expect(state.radarLoadStatus).toBe('error');
    expect(state.resultadoJuego1).toBe('tablas');
    expect(state.resultadoJuego2).toBe('perdio');

    await useDiagnosticoStore.getState().reintentarRadar();

    state = useDiagnosticoStore.getState();
    expect(ensureSeeded).toHaveBeenCalledTimes(2);
    expect(state.radarLoadStatus).toBe('listo');
    expect(state.radarItem?.id).toBe(radarFixture.id);
    expect(state.resultadoJuego1).toBe('tablas');
    expect(state.resultadoJuego2).toBe('perdio');
  });

  it('expone el estado cargando mientras prepara el catálogo del Radar', async () => {
    let resolveSeed!: () => void;
    const seeded = new Promise<void>((resolve) => {
      resolveSeed = resolve;
    });
    vi.spyOn(radarItemRepo, 'ensureSeeded').mockReturnValue(seeded);
    vi.spyOn(radarItemRepo, 'list').mockResolvedValue([radarFixture]);
    useDiagnosticoStore.setState({ phase: 'juego2', resultadoJuego1: 'perdio' });
    useGameStore.setState({ phase: 'ended', resultado: '1/2-1/2', playerColor: 'w' });

    const transition = useDiagnosticoStore.getState().registrarResultadoJuego();

    expect(useDiagnosticoStore.getState().phase).toBe('radar');
    expect(useDiagnosticoStore.getState().radarLoadStatus).toBe('cargando');
    expect(useDiagnosticoStore.getState().radarItem).toBeNull();

    resolveSeed();
    await transition;

    expect(useDiagnosticoStore.getState().radarLoadStatus).toBe('listo');
    expect(useDiagnosticoStore.getState().radarItem?.id).toBe(radarFixture.id);
  });

  it('trata un catálogo vacío como error recuperable, no como resultado válido', async () => {
    vi.spyOn(radarItemRepo, 'ensureSeeded').mockResolvedValue(undefined);
    vi.spyOn(radarItemRepo, 'list').mockResolvedValue([]);
    useDiagnosticoStore.setState({ phase: 'juego2', resultadoJuego1: 'gano' });
    useGameStore.setState({ phase: 'ended', resultado: '1/2-1/2', playerColor: 'w' });

    await useDiagnosticoStore.getState().registrarResultadoJuego();

    const state = useDiagnosticoStore.getState();
    expect(state.phase).toBe('radar');
    expect(state.radarLoadStatus).toBe('error');
    expect(state.bandaEstimada).toBeNull();
    expect(state.resultadoJuego1).toBe('gano');
    expect(state.resultadoJuego2).toBe('tablas');
  });

  it('expone un fallo al guardar la banda final y permite reintentarlo', async () => {
    const failure = vi.spyOn(profileRepo, 'save').mockRejectedValueOnce(new Error('indexeddb'));
    useDiagnosticoStore.setState({
      phase: 'radar',
      resultadoJuego1: 'tablas',
      resultadoJuego2: 'perdio',
      radarServidos: 20,
      radarAciertos: 12,
      resultSaveStatus: 'inactivo',
    });

    await useDiagnosticoStore.getState().radarContinuar();
    expect(useDiagnosticoStore.getState()).toMatchObject({ phase: 'radar', resultSaveStatus: 'error' });

    failure.mockRestore();
    await useDiagnosticoStore.getState().radarContinuar();
    expect(useDiagnosticoStore.getState()).toMatchObject({ phase: 'resultado', resultSaveStatus: 'inactivo' });
    expect((await profileRepo.get()).diagnosticoCompletadoEn).not.toBeNull();
  });
});

describe('diagnosticoStore — el diagnóstico deja línea base (RF-11.4)', () => {
  // La base falsa es compartida entre tests del archivo y el beforeEach de
  // arriba solo limpia el perfil: sin esto, los intentos y calibraciones de un
  // test se cuentan en el siguiente.
  beforeEach(async () => {
    await Promise.all([
      db.radarAttempts.clear(),
      db.calibrationRecords.clear(),
      db.radarProgress.clear(),
    ]);
  });

  async function responderRadar() {
    // El fixture es una posición de tipo 'envenenada' donde la solución es
    // d5h5; jugarla acierta, cualquier otra falla.
    await useDiagnosticoStore.getState().radarUserMove('d5' as never, 'h5' as never);
  }

  /**
   * Carga la posición por el camino real del store. Importa hacerlo así y no
   * con setState: el tablero de chess.js vive a nivel de módulo y solo lo
   * posiciona `loadRadarItem`, de modo que inyectar el ítem a mano dejaría el
   * tablero en la posición inicial y toda jugada sería ilegal.
   */
  async function cargarPosicion(posicionesYaServidas: number) {
    vi.spyOn(radarItemRepo, 'ensureSeeded').mockResolvedValue(undefined);
    vi.spyOn(radarItemRepo, 'list').mockResolvedValue([radarFixture]);
    useDiagnosticoStore.setState({ phase: 'radar', radarLoadStatus: 'listo' });
    await useDiagnosticoStore.getState().reintentarRadar();
    useDiagnosticoStore.setState({
      radarServidos: posicionesYaServidas,
      radarAciertos: 0,
      radarRespuestas: [],
      radarCalibraciones: [],
    });
  }

  it('el Radar del diagnóstico usa el mismo recorrido que la sesión: evaluar y después jugar (RF-5.2)', async () => {
    await cargarPosicion(0);
    expect(useDiagnosticoStore.getState().radarSubPhase).toBe('evaluando');

    // Mientras no se declare la evaluación, la jugada no resuelve nada.
    await responderRadar();
    expect(useDiagnosticoStore.getState().radarSubPhase).toBe('evaluando');

    useDiagnosticoStore.getState().radarEval('negras');
    expect(useDiagnosticoStore.getState().radarSubPhase).toBe('jugando');
    expect(useDiagnosticoStore.getState().radarEvalGuess).toBe('negras');
  });

  it('pide confianza en posiciones fijas y no revela el resultado antes de declararla', async () => {
    // La tercera posición está en DIAGNOSTICO_POSICIONES_CONFIANZA.
    await cargarPosicion(2);
    useDiagnosticoStore.getState().radarEval('igual');
    await responderRadar();

    expect(useDiagnosticoStore.getState().radarSubPhase).toBe('confianza');
    expect(useDiagnosticoStore.getState().radarServidos).toBe(3);

    await useDiagnosticoStore.getState().radarConfirmarConfianza(80);

    const state = useDiagnosticoStore.getState();
    expect(state.radarSubPhase).toBe('feedback');
    expect(state.radarCalibraciones).toEqual([{ confianzaDeclarada: 80, acierto: true }]);
    // El registro también queda persistido para el Brier del Panel (RF-10.2).
    expect(await db.calibrationRecords.count()).toBe(1);
  });

  it('una posición fuera del muestreo va directo al feedback', async () => {
    await cargarPosicion(0);
    useDiagnosticoStore.getState().radarEval('igual');
    await responderRadar();

    expect(useDiagnosticoStore.getState().radarSubPhase).toBe('feedback');
    expect(useDiagnosticoStore.getState().radarCalibraciones).toEqual([]);
  });

  it('marca sus respuestas del Radar como del diagnóstico, para no contaminar la banda 60–80%', async () => {
    await cargarPosicion(0);
    useDiagnosticoStore.getState().radarEval('igual');
    await responderRadar();

    const intentos = await db.radarAttempts.toArray();
    expect(intentos).toHaveLength(1);
    expect(intentos[0].origenContenido).toBe('diagnostico');
    // Sin dificultad normalizada: el diagnóstico no adapta, así que no aporta
    // un percentil comparable al detector de sobreajuste (RF-12.3).
    expect(intentos[0].dificultadNormalizada).toBeUndefined();
  });

  it('al cerrar guarda perfil de fugas y siembra el centro adaptativo del Radar', async () => {
    useDiagnosticoStore.setState({
      phase: 'radar',
      radarLoadStatus: 'listo',
      radarPool: [radarFixture],
      radarItem: radarFixture,
      radarSubPhase: 'feedback',
      radarServidos: 20,
      radarAciertos: 18,
      resultadoJuego1: 'gano',
      resultadoJuego2: 'gano',
      partidaIds: ['partida-1', 'partida-2'],
      radarRespuestas: [
        ...Array.from({ length: 8 }, () => ({ tipo: 'ofensiva' as const, acierto: true })),
        ...Array.from({ length: 8 }, () => ({ tipo: 'tranquila' as const, acierto: true })),
        ...Array.from({ length: 4 }, (_, index) => ({ tipo: 'defensa' as const, acierto: index < 2 })),
      ],
      radarCalibraciones: [{ confianzaDeclarada: 100, acierto: true }],
    });

    await useDiagnosticoStore.getState().radarContinuar();

    const state = useDiagnosticoStore.getState();
    expect(state.phase).toBe('resultado');
    expect(state.lineaBase).not.toBeNull();
    expect(state.lineaBase!.radarAciertos).toBe(18);
    expect(state.lineaBase!.brier).toBe(0);
    expect(state.lineaBase!.partidaIds).toEqual(['partida-1', 'partida-2']);

    // El perfil de fugas queda en el perfil, no solo en memoria (RF-11.4).
    const profile = await profileRepo.get();
    expect(profile.diagnosticoCompletadoEn).not.toBeNull();
    expect(profile.perfilDeFugas?.porTipo).toEqual(
      expect.arrayContaining([{ tipo: 'defensa', aciertos: 2, total: 4 }]),
    );

    // Y el Radar de la sesión arranca calibrado, no en el percentil neutral:
    // 90% de acierto ⇒ centro por encima del inicial.
    const progreso = await db.radarProgress.get('principal');
    expect(progreso).toBeDefined();
    expect(progreso!.dificultadCentro).toBeGreaterThan(RADAR_INITIAL_STATE.dificultadCentro);
    expect(progreso!.aciertosRecientes).toHaveLength(8);
  });

  it('guarda el rating declarado como serie y rechaza valores fuera de rango', async () => {
    await useDiagnosticoStore.getState().guardarRatingExterno(1450, 'lichess');
    expect(useDiagnosticoStore.getState().ratingExternoGuardado?.valor).toBe(1450);
    expect((await profileRepo.get()).ratingsExternos).toHaveLength(1);

    await useDiagnosticoStore.getState().guardarRatingExterno(42, 'lichess');
    expect((await profileRepo.get()).ratingsExternos).toHaveLength(1);
  });
});
