// Test de integración del store de la sesión simple (Fase 1): Cola vencida
// + Radar (E4, E5, E10) contra una base real (fake-indexeddb). Cubre las
// dos rutas del bug que encontré a mano: jugadaUsuario vacía y ladoAMover
// tomado del turno equivocado al crear una tarjeta desde un fallo del Radar.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RADAR_SESSION_SIZE, useSessionStore } from './sessionStore';
import { db } from '../../services/storage/db';
import { seedRadarItems } from '../../services/puzzles/seedData';
import { buildErrorCard } from '../../core/errorCard';

beforeEach(async () => {
  await db.games.clear();
  await db.errorCards.clear();
  await db.radarItems.clear();
  await db.calibrationRecords.clear();
  await db.radarProgress.clear();
  await db.radarDatasetMeta.clear();
  await db.radarAttempts.clear();
});

describe('sessionStore — bloque Radar', () => {
  it('sin tarjetas vencidas, arranca directo en el Radar con el pool sembrado', async () => {
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    expect(s.phase).toBe('radar');
    expect(s.radarItem).not.toBeNull();
    expect(await db.radarItems.count()).toBe(seedRadarItems.length);
  });

  it('un fallo en el Radar crea una ErrorCard con la jugada del usuario y el lado correcto', async () => {
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

    // Forzar que no se muestree confianza, para llegar directo a feedback y
    // poder verificar la ErrorCard sin depender del azar del muestreo.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
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
  });

  it('con muestreo de confianza forzado, guarda el registro de calibración antes de crear la tarjeta', async () => {
    await useSessionStore.getState().start();
    let s = useSessionStore.getState();
    const item = s.radarItem!;

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];

    vi.spyOn(Math, 'random').mockReturnValue(0); // shouldSampleConfidence() → true
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
    await useSessionStore.getState().start();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // nunca muestrear confianza, avanzar rápido
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
  });

  it('persiste la dificultad y los aciertos recientes para la sesión siguiente (RF-5.5)', async () => {
    await useSessionStore.getState().start();
    const s = useSessionStore.getState();
    const ratingInicial = s.radarSelState.ratingCentro;
    const item = s.radarItem!;

    s.radarEval('igual');
    const [from, destinos] = s.dests.entries().next().value as [string, string[]];
    const to = destinos.find((d) => from + d !== item.solucion[0]) ?? destinos[0];
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await s.radarUserMove(from as never, to as never);
    await s.radarContinuar();
    vi.restoreAllMocks();

    const guardado = await db.radarProgress.get('principal');
    expect(guardado?.aciertosRecientes).toHaveLength(1);
    expect(guardado?.ratingCentro).not.toBe(ratingInicial);

    useSessionStore.getState().volver();
    await useSessionStore.getState().start();
    expect(useSessionStore.getState().radarSelState.ratingCentro).toBe(guardado?.ratingCentro);
    expect(useSessionStore.getState().radarAciertosRecientes).toEqual(guardado?.aciertosRecientes);
  });

  it('persiste el ajuste de dificultad de la última posición de la sesión, no solo el de las anteriores', async () => {
    await useSessionStore.getState().start();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // nunca muestrear confianza
    let s = useSessionStore.getState();
    // Historial de ratingCentro tras cada radarContinuar(), para detectar si
    // la última llamada (la que cierra la sesión) de verdad cambió algo:
    // antes del fix, esa última llamada no aplicaba el ajuste ni en memoria
    // ni en Dexie, así que el valor quedaba idéntico al de la llamada previa.
    const ratingCentroTrasCadaContinuar: number[] = [];
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
        ratingCentroTrasCadaContinuar.push(s.radarSelState.ratingCentro);
      }
      guard++;
    }
    vi.restoreAllMocks();
    expect(s.phase).toBe('fin');
    expect(ratingCentroTrasCadaContinuar.length).toBe(RADAR_SESSION_SIZE);

    // La última llamada (la que cierra la sesión) tiene que haber cambiado
    // el rating respecto a la anteúltima: si no, el ajuste de la 8ª
    // respuesta se descartó en vez de aplicarse.
    const [penultimo, ultimo] = ratingCentroTrasCadaContinuar.slice(-2);
    expect(ultimo).not.toBe(penultimo);

    // Y lo que quedó persistido en Dexie coincide con ese último valor.
    const guardado = await db.radarProgress.get('principal');
    expect(guardado?.ratingCentro).toBe(ultimo);
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
