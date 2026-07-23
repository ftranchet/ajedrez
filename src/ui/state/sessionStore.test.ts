// Test de integración del store de la sesión simple (Fase 1): Cola vencida
// + Radar (E4, E5, E10) contra una base real (fake-indexeddb). Cubre las
// dos rutas del bug que encontré a mano: jugadaUsuario vacía y ladoAMover
// tomado del turno equivocado al crear una tarjeta desde un fallo del Radar.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
import { useSessionStore } from './sessionStore';
import { db } from '../../services/storage/db';
import { seedRadarItems } from '../../services/puzzles/seedData';
import { seedCurriculumItems } from '../../services/puzzles/curriculumSeedData';
import { newCurriculumProgress } from '../../core/curriculum';
import { dietaPorBanda } from '../../core/prescriptor';
import { DEFAULT_PROFILE } from '../../services/storage/profileRepo';
import { buildErrorCard } from '../../core/errorCard';
import { curriculumItemRepo } from '../../services/storage/curriculumItemRepo';
import { radarItemRepo } from '../../services/storage/radarItemRepo';
import { sessionRepo } from '../../services/storage/sessionRepo';

// Perfil por defecto (sin diagnóstico): fija cuántas posiciones sirve el
// Radar por sesión para que estos tests no dependan del Prescriptor.
const RADAR_SESSION_SIZE = dietaPorBanda(DEFAULT_PROFILE.bandaElo, []).radarCount;

beforeEach(async () => {
  vi.restoreAllMocks();
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
  await db.triageAttempts.clear();
  await db.sessions.clear();
  await db.profile.clear();
  // Este archivo prueba Cola y Radar; el bloque de currículo (Fase 3) tiene
  // sus propios tests en sessionStore.curriculum.test.ts. Marcarlo
  // "automatizado" de entrada mantiene estos tests enfocados en lo que ya
  // probaban, sin que el nuevo bloque intermedio los rompa.
  await db.curriculumProgress.bulkPut(
    seedCurriculumItems.map((item) => ({ ...newCurriculumProgress(item.id), demostracionesLimpias: 3 })),
  );
});

describe('sessionStore — bloque Radar', () => {
  it('muestra el diagnóstico nuevo sin esperar a sembrar catálogos', async () => {
    const ensureSeeded = vi.spyOn(curriculumItemRepo, 'ensureSeeded');

    await useSessionStore.getState().loadSummary(true);

    const state = useSessionStore.getState();
    expect(state.summaryStatus).toBe('ready');
    expect(state.profile.diagnosticoCompletadoEn).toBeNull();
    expect(ensureSeeded).not.toHaveBeenCalled();
  });

  it('expone un error recuperable si falla el resumen y un reintento lo completa', async () => {
    await db.profile.put({ ...DEFAULT_PROFILE, diagnosticoCompletadoEn: new Date().toISOString() });
    const failure = vi.spyOn(curriculumItemRepo, 'ensureSeeded').mockRejectedValueOnce(new Error('indexeddb'));

    await useSessionStore.getState().loadSummary(true);
    expect(useSessionStore.getState().summaryStatus).toBe('error');

    failure.mockRestore();
    await useSessionStore.getState().loadSummary(true);
    const state = useSessionStore.getState();
    expect(state.summaryStatus).toBe('ready');
    expect(state.dueCount).toBeTypeOf('number');
  });

  it('vuelve a la portada si falla el arranque y permite iniciar después', async () => {
    const failure = vi.spyOn(radarItemRepo, 'ensureSeeded').mockRejectedValueOnce(new Error('indexeddb'));

    await useSessionStore.getState().start();
    expect(useSessionStore.getState()).toMatchObject({ phase: 'sinEmpezar', startError: true });

    failure.mockRestore();
    await useSessionStore.getState().start();
    expect(useSessionStore.getState().phase).toBe('radar');
    expect(useSessionStore.getState().startError).toBe(false);
  });

  it('recupera la cola de persistencia si guardar el arranque falla', async () => {
    const failure = vi.spyOn(sessionRepo, 'save').mockRejectedValueOnce(new Error('indexeddb'));

    await useSessionStore.getState().start();
    expect(useSessionStore.getState()).toMatchObject({ phase: 'sinEmpezar', startError: true });

    failure.mockRestore();
    await useSessionStore.getState().start();
    expect(useSessionStore.getState().phase).toBe('radar');
    expect(useSessionStore.getState().startError).toBe(false);
  });

  it('la orientación del tablero queda fija tras jugar (no gira 180° en el feedback)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // sin candidatas ni confianza
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const orientacionInicial = s.boardOrientation;
    expect(orientacionInicial).toBe(s.turn); // al cargar, se ve desde el lado que resuelve

    s.radarEval('igual');
    s = useSessionStore.getState();
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    await s.radarUserMove(from as never, destinos[0] as never);
    vi.restoreAllMocks();

    s = useSessionStore.getState();
    // Tras la jugada, el turno pasó al rival pero la orientación no se movió.
    expect(s.turn).not.toBe(orientacionInicial);
    expect(s.boardOrientation).toBe(orientacionInicial);
  });

  it('sin tarjetas vencidas, arranca directo en el Radar con el pool sembrado', async () => {
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    expect(s.phase).toBe('radar');
    expect(s.radarItem).not.toBeNull();
    expect(await db.radarItems.count()).toBe(seedRadarItems.length);
  });

  const cartaVencida = () =>
    buildErrorCard({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      ladoAMover: 'w',
      jugadaUsuario: 'e2e4',
      jugadaCorrecta: 'd2d4',
      categoria: 'tactico',
      origen: 'radar',
      now: new Date('2020-01-01'),
    });

  it('solo bloque: start("radar") saltea la Cola vencida y arranca en el Radar (RF-11.5)', async () => {
    await db.errorCards.put(cartaVencida());
    await useSessionStore.getState().start('radar');
    const s = useSessionStore.getState();
    expect(s.phase).toBe('radar');
    expect(s.soloBloque).toBe('radar');
    expect(s.sessionRecord?.bloques.map((b) => b.tipo)).toEqual(['radar']);
  });

  it('solo bloque: start("cola") arranca en la Cola con solo ese bloque en el registro', async () => {
    await db.errorCards.put(cartaVencida());
    await useSessionStore.getState().start('cola');
    const s = useSessionStore.getState();
    expect(s.phase).toBe('cola');
    expect(s.soloBloque).toBe('cola');
    expect(s.sessionRecord?.bloques.map((b) => b.tipo)).toEqual(['cola']);
  });

  it('intercala un error de partida no vencido sin tocar FSRS ni la dificultad del catálogo (RF-5.9)', async () => {
    const source = seedRadarItems[0];
    const baseCard = buildErrorCard({
      id: 'error-partida-revisado',
      fen: source.fen,
      ladoAMover: source.fen.split(' ')[1] === 'b' ? 'b' : 'w',
      jugadaUsuario: 'a2a3',
      jugadaCorrecta: source.solucion[0],
      categoria: 'posicional',
      origen: 'partida',
    });
    const card = { ...baseCard, fsrs: { ...baseCard.fsrs, due: '2100-01-01T00:00:00.000Z' } };
    await db.errorCards.put(card);

    // El primer 0 reserva el primer lugar del bloque; los 0.99 siguientes
    // dejan apagados los muestreos de candidatas/confianza.
    vi.spyOn(Math, 'random').mockImplementationOnce(() => 0).mockReturnValue(0.99);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    expect(s.phase).toBe('radar');
    expect(s.colaCards).toHaveLength(0);
    expect(s.radarItem).toMatchObject({
      fuente: 'error-propio',
      errorCardId: card.id,
      fen: card.fen,
    });
    expect(s.radarOwnErrorSlots).toContain(0);
    const dificultadInicial = s.radarSelState.dificultadCentro;

    s.radarEval('igual');
    s = useSessionStore.getState();
    const item = s.radarItem!;
    const jugadaMala = [...s.dests.entries()]
      .flatMap(([from, destinos]) => destinos.map((to) => [from, to] as const))
      .find(([from, to]) => from + to !== item.solucion[0]);
    if (!jugadaMala) throw new Error('la posición semilla no tiene una alternativa legal');
    await s.radarUserMove(jugadaMala[0] as never, jugadaMala[1] as never);

    s = useSessionStore.getState();
    expect(s.radarFeedbackTexto).toContain('partida tuya');
    expect(s.radarAciertosRecientes).toEqual([]);
    const attempt = (await db.radarAttempts.toArray())[0];
    expect(attempt).toMatchObject({
      itemId: `error-propio:${card.id}`,
      origenContenido: 'error-propio',
      errorCardId: card.id,
      acierto: false,
    });
    expect(attempt.dificultadNormalizada).toBeUndefined();
    expect((await db.errorCards.get(card.id))?.fsrs).toEqual(card.fsrs);

    await s.radarContinuar();
    vi.restoreAllMocks();
    expect(useSessionStore.getState().radarSelState.dificultadCentro).toBe(dificultadInicial);
    expect(useSessionStore.getState().radarItem?.fuente).not.toBe('error-propio');
  });

  it('no recicla en Radar una tarjeta vencida que ya pertenece a la Cola de esa sesión', async () => {
    const source = seedRadarItems[0];
    const dueCard = buildErrorCard({
      id: 'error-partida-vencido',
      fen: source.fen,
      ladoAMover: source.fen.split(' ')[1] === 'b' ? 'b' : 'w',
      jugadaUsuario: 'a2a3',
      jugadaCorrecta: source.solucion[0],
      categoria: 'tactico',
      origen: 'partida',
      now: new Date('2020-01-01T00:00:00.000Z'),
    });
    await db.errorCards.put(dueCard);

    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    expect(s.phase).toBe('cola');
    expect(s.colaCards.map((card) => card.id)).toContain(dueCard.id);
    expect(s.radarOwnErrorItems).toEqual([]);
    expect(s.radarOwnErrorSlots).toEqual([]);
  });

  it('al volver antes de terminar registra la sesión como abandonada', async () => {
    await useSessionStore.getState().start();
    const id = useSessionStore.getState().sessionRecord!.id;

    useSessionStore.getState().volver();

    await vi.waitFor(async () => {
      const record = await db.sessions.get(id);
      expect(record?.estado).toBe('abandonada');
      expect(record?.fechaFin).toBeDefined();
      expect(record?.bloques.find((block) => block.estado === 'en_curso')?.fin).toBeDefined();
    });
  });

  it('un fallo en el Radar crea una ErrorCard con la jugada del usuario y el lado correcto', async () => {
    // Forzar que no se muestree ni la regla de candidatas (RF-5.8) ni la
    // confianza (RF-10.1), para llegar directo a feedback y poder verificar
    // la ErrorCard sin depender del azar del muestreo.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const item = s.radarItem!;
    const ladoEsperado = item.fen.split(' ')[1];

    // Declarar evaluación (paso RF-5.2) y después jugar deliberadamente mal:
    // cualquier jugada legal que no sea la solución cuenta como fallo.
    s.radarEval('igual');
    const jugadaMala = s.dests.entries().next().value as [string, string[]] | undefined;
    if (!jugadaMala) throw new Error('la posición semilla no tiene jugadas legales');
    const [from, destinos] = jugadaMala;
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];

    await s.radarUserMove(from as never, to as never);
    vi.restoreAllMocks();

    s = useSessionStore.getState();
    if (s.radarUltimoAcierto) return; // esa jugada resultó ser la solución; no es el caso a probar

    expect(s.radarSubPhase).toBe('feedback');
    const cards = await db.errorCards.toArray();
    expect(cards).toHaveLength(1);
    expect(cards[0].jugadaUsuario).toBe(from + to);
    expect(cards[0].jugadaCorrecta).toBe(item.solucion[0]);
    expect(cards[0].ladoAMover).toBe(ladoEsperado);
    expect(cards[0].origen).toBe('radar');
    expect(cards[0].fsrs.lapses).toBe(0); // tarjeta nueva, todavía no hay lapso
    const attempts = await db.radarAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ itemId: item.id, acierto: false, tipo: item.tipo });
    expect(attempts[0].dificultadNormalizada).toBeGreaterThanOrEqual(0);
    expect(attempts[0].dificultadNormalizada).toBeLessThanOrEqual(100);

    // El feedback muestra la jugada correcta en SAN, no en UCI crudo.
    const solucion = item.solucion[0];
    const chess = new Chess(item.fen);
    const sanEsperado = chess.move({ from: solucion.slice(0, 2), to: solucion.slice(2, 4), promotion: solucion.slice(4, 5) || undefined }).san;
    expect(s.radarJugadaCorrecta).toBe(sanEsperado);
    expect(s.radarJugadaCorrecta).not.toBe(solucion);
  });

  it('persiste la evaluación rápida declarada (RF-5.2) en el RadarAttempt, en vez de descartarla', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // sin candidatas ni confianza, directo a feedback
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const item = s.radarItem!;

    s.radarEval('negras');
    s = useSessionStore.getState();
    expect(s.radarEvalGuess).toBe('negras');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    await s.radarUserMove(from as never, destinos[0] as never);
    vi.restoreAllMocks();

    const attempts = await db.radarAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ itemId: item.id, evalGuess: 'negras' });
  });

  it('con muestreo de confianza forzado, guarda el registro de calibración antes de crear la tarjeta', async () => {
    // Candidatas (RF-5.8) apagada durante la carga del ítem, para no
    // interponerse antes de llegar al paso de confianza que prueba este test.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const item = s.radarItem!;

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];

    randomSpy.mockReturnValue(0); // shouldSampleConfidence() → true
    await s.radarUserMove(from as never, to as never);
    s = useSessionStore.getState();
    expect(s.radarSubPhase).toBe('confianza');
    expect(await db.errorCards.count()).toBe(0); // todavía no se creó: falta confirmar confianza

    await s.radarConfirmarConfianza(30);
    vi.restoreAllMocks();

    const calibraciones = await db.calibrationRecords.toArray();
    expect(calibraciones).toHaveLength(1);
    expect(calibraciones[0].confianzaDeclarada).toBe(30);
    expect(calibraciones[0].contexto).toBe('radar');
  });

  it('termina el bloque del Radar tras servir el tamaño de sesión configurado', async () => {
    // Nunca muestrear candidatas (RF-5.8) ni confianza, avanzar rápido.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    let guard = 0;
    while (s.phase === 'radar' && guard < 50) {
      const item = s.radarItem;
      if (!item) break;
      s.radarEval('igual');
      s = useSessionStore.getState();
      const [from, destinos] = s.dests.entries().next().value as [string, string[]];
      await s.radarUserMove(from as never, destinos[0] as never);
      s = useSessionStore.getState();
      if (s.radarSubPhase === 'feedback') {
        await s.radarContinuar();
        s = useSessionStore.getState();
      }
      guard++;
    }
    vi.restoreAllMocks();
    expect(s.phase).toBe('fin');
    expect(guard).toBeLessThan(50);
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].estado).toBe('completada');
    expect(sessions[0].bloques.find((b) => b.tipo === 'radar')?.completados).toBe(RADAR_SESSION_SIZE);
  });

  it('persiste la dificultad y los aciertos recientes para la sesión siguiente (RF-5.5)', async () => {
    // Nunca muestrear candidatas (RF-5.8) ni confianza, para llegar directo a feedback.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    const dificultadInicial = s.radarSelState.dificultadCentro;
    const item = s.radarItem!;

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];
    await s.radarUserMove(from as never, to as never);
    await s.radarContinuar();
    vi.restoreAllMocks();

    const guardado = await db.radarProgress.get('principal');
    expect(guardado?.aciertosRecientes).toHaveLength(1);
    expect(guardado?.dificultadCentro).not.toBe(dificultadInicial);

    useSessionStore.getState().volver();
    await useSessionStore.getState().start();
    expect(useSessionStore.getState().radarSelState.dificultadCentro).toBe(guardado?.dificultadCentro);
    expect(useSessionStore.getState().radarAciertosRecientes).toEqual(guardado?.aciertosRecientes);
  });

  it('persiste el ajuste de dificultad de la última posición de la sesión, no solo el de las anteriores', async () => {
    // Nunca muestrear candidatas (RF-5.8) ni confianza.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    // Historial de dificultadCentro tras cada radarContinuar(), para detectar si
    // la última llamada (la que cierra la sesión) de verdad cambió algo:
    // antes del fix, esa última llamada no aplicaba el ajuste ni en memoria
    // ni en Dexie, así que el valor quedaba idéntico al de la llamada previa.
    const dificultadTrasCadaContinuar: number[] = [];
    let guard = 0;
    while (s.phase === 'radar' && guard < 20) {
      const item = s.radarItem;
      if (!item) break;
      s.radarEval('igual');
      s = useSessionStore.getState();
      const [from, destinos] = s.dests.entries().next().value as [string, string[]];
      await s.radarUserMove(from as never, destinos[0] as never);
      s = useSessionStore.getState();
      if (s.radarSubPhase === 'feedback') {
        await s.radarContinuar();
        s = useSessionStore.getState();
        dificultadTrasCadaContinuar.push(s.radarSelState.dificultadCentro);
      }
      guard++;
    }
    vi.restoreAllMocks();
    expect(s.phase).toBe('fin');
    expect(dificultadTrasCadaContinuar.length).toBe(RADAR_SESSION_SIZE);

    // La última llamada (la que cierra la sesión) tiene que haber cambiado
    // el rating respecto a la anteúltima: si no, el ajuste de la 8ª
    // respuesta se descartó en vez de aplicarse.
    const [penultimo, ultimo] = dificultadTrasCadaContinuar.slice(-2);
    expect(ultimo).not.toBe(penultimo);

    // Y lo que quedó persistido en Dexie coincide con ese último valor.
    const guardado = await db.radarProgress.get('principal');
    expect(guardado?.dificultadCentro).toBe(ultimo);
  });
});

describe('sessionStore — bloque Cola', () => {
  it('con una tarjeta vencida, arranca en Cola y la respeta antes del Radar', async () => {
    const vencida = buildErrorCard({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      ladoAMover: 'b',
      jugadaUsuario: 'e7e6',
      jugadaCorrecta: 'e7e5',
      categoria: 'tactico',
      origen: 'partida',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await db.errorCards.put(vencida);

    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    expect(s.phase).toBe('cola');
    expect(s.colaCards).toHaveLength(1);

    // Responder correctamente: la jugada correcta de la tarjeta.
    await s.colaUserMove('e7' as never, 'e5' as never);
    s = useSessionStore.getState();
    expect(s.colaSubPhase).toBe('feedback');
    expect(s.colaUltimoAcierto).toBe(true);

    const revisada = await db.errorCards.get(vencida.id);
    expect(revisada!.fsrs.reps).toBe(1);
    expect(new Date(revisada!.fsrs.due).getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00.000Z').getTime());

    // Avanzar: no quedan más tarjetas vencidas → pasa al Radar.
    s.colaContinuar();
    s = useSessionStore.getState();
    expect(s.phase).toBe('radar');
  });

  it('una jugada de promoción no rompe el flujo: corona dama por defecto y puntúa contra la solución', async () => {
    // chess.js tira si una jugada que corona llega sin pieza de promoción, y
    // el tablero de la sesión no tiene selector: antes de la corrección,
    // coronar en la Cola dejaba la sesión colgada en 'jugando'.
    const vencida = buildErrorCard({
      fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1',
      ladoAMover: 'w',
      jugadaUsuario: 'e1e2',
      jugadaCorrecta: 'e7e8q',
      categoria: 'tactico',
      origen: 'partida',
      now: new Date('2026-01-01T00:00:00.000Z'),
    });
    await db.errorCards.put(vencida);

    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    expect(s.phase).toBe('cola');

    await s.colaUserMove('e7' as never, 'e8' as never);
    s = useSessionStore.getState();
    expect(s.colaSubPhase).toBe('feedback');
    expect(s.colaUltimoAcierto).toBe(true);
  });

  it('una respuesta incorrecta en la Cola no espacia el intervalo (fallo reinicia, RF-4.2)', async () => {
    const vencida = buildErrorCard({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      ladoAMover: 'b',
      jugadaUsuario: 'e7e6',
      jugadaCorrecta: 'e7e5',
      categoria: 'tactico',
      origen: 'partida',
    });
    await db.errorCards.put(vencida);
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();

    await s.colaUserMove('d7' as never, 'd6' as never); // no es e7e5: fallo
    const after = useSessionStore.getState();
    expect(after.colaUltimoAcierto).toBe(false);
    const revisada = await db.errorCards.get(vencida.id);
    expect(revisada!.fsrs.lapses).toBe(0); // era 'new', no 'review': todavía no cuenta como lapso
    expect(revisada!.fsrs.reps).toBe(1);
  });

  it('el feedback de la Cola muestra la jugada correcta en SAN, no en UCI crudo', async () => {
    // Una captura (bxc6), para que UCI ("b7c6") y SAN de verdad difieran en forma.
    const vencida = buildErrorCard({
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
      ladoAMover: 'b',
      jugadaUsuario: 'g8f6',
      jugadaCorrecta: 'f8c5',
      categoria: 'tactico',
      origen: 'partida',
    });
    await db.errorCards.put(vencida);
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();

    await s.colaUserMove('g8' as never, 'f6' as never); // no es f8c5: fallo, dispara feedback igual
    const after = useSessionStore.getState();
    expect(after.colaJugadaCorrecta).toBe('Bc5');
    expect(after.colaJugadaCorrecta).not.toBe('f8c5');
  });
});

describe('sessionStore — volver()', () => {
  it('limpia dueCount para que Hoy vuelva a pedirlo (un fallo pudo haber creado tarjetas nuevas)', async () => {
    await useSessionStore.getState().start();
    await useSessionStore.getState().loadSummary();
    expect(useSessionStore.getState().dueCount).not.toBeNull();

    useSessionStore.getState().volver();
    expect(useSessionStore.getState().dueCount).toBeNull();
  });
});

describe('sessionStore — Triage (E9)', () => {
  it('triageDecidir persiste la decisión, si fue correcta y la latencia (RF-9.2/9.3)', async () => {
    // Poner el store directo en el bloque de Triage con una posición ofensiva
    // (decisión correcta = "calcular"): montar la fuga de tiempo real que lo
    // activa es caro y ya está cubierto por e2e/triage.spec.ts.
    const item = {
      id: 'triage-1',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      tipo: 'ofensiva' as const,
      temas: [],
      rating: 1500,
      solucion: ['f1c4'],
      fuente: 'seed-dev' as const,
    };
    useSessionStore.setState({ phase: 'triage', triageQueue: [item], triageIndex: 0, triageSubPhase: 'decidiendo' });

    useSessionStore.getState().triageDecidir('calcular'); // correcto para 'ofensiva'
    expect(useSessionStore.getState().triageUltimaCorrecta).toBe(true);

    // Dexie escribe async; esperar un tick antes de leer.
    await new Promise((r) => setTimeout(r, 0));
    const attempts = await db.triageAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      itemId: 'triage-1',
      tipo: 'ofensiva',
      decisionUsuario: 'calcular',
      decisionCorrecta: 'calcular',
      correcta: true,
    });
    expect(typeof attempts[0].tiempoMs).toBe('number');
  });

  it('registra una decisión equivocada como incorrecta', async () => {
    const item = {
      id: 'triage-2',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      tipo: 'tranquila' as const,
      temas: [],
      rating: 1500,
      solucion: ['e2e4'],
      fuente: 'seed-dev' as const,
    };
    useSessionStore.setState({ phase: 'triage', triageQueue: [item], triageIndex: 0, triageSubPhase: 'decidiendo' });

    useSessionStore.getState().triageDecidir('calcular'); // 'tranquila' → correcto sería 'alcanza'
    expect(useSessionStore.getState().triageUltimaCorrecta).toBe(false);

    await new Promise((r) => setTimeout(r, 0));
    const attempts = await db.triageAttempts.toArray();
    expect(attempts[0]).toMatchObject({ correcta: false, decisionUsuario: 'calcular', decisionCorrecta: 'alcanza' });
  });
});
