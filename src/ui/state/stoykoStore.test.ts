// Test de integración del preset abierto del cálculo declarado (E7, RF-7.2,
// ADR-0015) contra Dexie real: se declaran ramas —las dos primeras con su
// línea— antes de revelar, se comparan con el motor y se registra para
// calibración (E10) y para el enfriamiento semanal.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoykoStore } from './stoykoStore';
import { db } from '../../services/storage/db';
import { STOYKO_DATASET_VERSION } from '../../services/puzzles/stoykoSeedData';
import type { EvalSymbol, GameRecord, Profile, StoykoItem } from '../../core/types';
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

/** Declara una rama completa: sus plies y su evaluación. */
function declararRama(plies: string[], evaluacion?: EvalSymbol) {
  for (const ply of plies) {
    useStoykoStore.getState().setInputActual(ply);
    useStoykoStore.getState().agregarPly();
  }
  if (evaluacion) useStoykoStore.getState().setEvalSeleccionada(evaluacion);
  useStoykoStore.getState().cerrarRama();
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await db.stoykoItems.clear();
  await db.stoykoDatasetMeta.clear();
  await db.calibrationRecords.clear();
  await db.calculoAttempts.clear();
  await db.games.clear();
  await db.profile.clear();
  await db.stoykoItems.put(item);
  await db.stoykoDatasetMeta.put({ id: 'catalogo', version: STOYKO_DATASET_VERSION, seededAt: new Date().toISOString() });
});

describe('stoykoStore — preset abierto', () => {
  it('sale de la carga ante un fallo del catálogo y permite reintentar', async () => {
    const failure = vi.spyOn(stoykoItemRepo, 'ensureSeeded').mockRejectedValueOnce(new Error('indexeddb'));

    await useStoykoStore.getState().empezar(true);
    expect(useStoykoStore.getState().phase).toBe('error');

    failure.mockRestore();
    await useStoykoStore.getState().empezar(true);
    expect(useStoykoStore.getState().phase).toBe('analizando');
  });

  it('sin partidas analizadas sirve el ítem del catálogo', async () => {
    await useStoykoStore.getState().empezar();
    const s = useStoykoStore.getState();
    expect(s.phase).toBe('analizando');
    expect(s.origen).toMatchObject({ tipo: 'catalogo' });
    expect(s.fen).toBe(item.fen);
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

  it('rechaza formato inválido sin sumar el ply', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('caballo a f3');
    useStoykoStore.getState().agregarPly();
    const s = useStoykoStore.getState();
    expect(s.ramaEnCurso.linea).toEqual([]);
    expect(s.inputError).not.toBeNull();
  });

  it('rechaza una jugada ilegal en la posición', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('a2a5'); // el peón de a2 no llega a a5 de un salto
    useStoykoStore.getState().agregarPly();
    expect(useStoykoStore.getState().ramaEnCurso.linea).toEqual([]);
    expect(useStoykoStore.getState().inputError).toBe('Esa jugada no es legal en esta posición.');
  });

  // Cada ply se valida contra la posición que dejó el anterior: una línea
  // declarada tiene que ser jugable, si no no es una línea.
  it('valida cada ply contra la posición que deja el ply anterior', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('f1c4');
    useStoykoStore.getState().agregarPly();
    // Le toca a las negras: una jugada blanca no es legal acá.
    useStoykoStore.getState().setInputActual('e1g1');
    useStoykoStore.getState().agregarPly();
    expect(useStoykoStore.getState().ramaEnCurso.linea).toEqual(['f1c4']);
    expect(useStoykoStore.getState().inputError).not.toBeNull();
  });

  it('rechaza una candidata repetida entre ramas', async () => {
    await useStoykoStore.getState().empezar();
    declararRama(['f1c4', 'f8c5']);
    useStoykoStore.getState().setInputActual('f1c4');
    useStoykoStore.getState().agregarPly();
    expect(useStoykoStore.getState().ramaEnCurso.linea).toEqual([]);
    expect(useStoykoStore.getState().inputError).toBe('Ya anotaste esa candidata.');
  });

  // Decisión de producto: línea en las dos primeras, el resto sueltas.
  it('las dos primeras ramas piden línea; de la tercera alcanza la candidata suelta', async () => {
    await useStoykoStore.getState().empezar();
    useStoykoStore.getState().setInputActual('f1c4');
    useStoykoStore.getState().agregarPly();
    useStoykoStore.getState().cerrarRama(); // un solo ply en la primera rama: no alcanza
    expect(useStoykoStore.getState().ramas).toHaveLength(0);
    expect(useStoykoStore.getState().inputError).not.toBeNull();

    useStoykoStore.getState().setInputActual('f8c5');
    useStoykoStore.getState().agregarPly();
    useStoykoStore.getState().cerrarRama();
    expect(useStoykoStore.getState().ramas).toHaveLength(1);

    declararRama(['d2d4', 'e5d4']);
    expect(useStoykoStore.getState().ramas).toHaveLength(2);

    // Tercera: suelta alcanza.
    useStoykoStore.getState().setInputActual('b1c3');
    useStoykoStore.getState().agregarPly();
    useStoykoStore.getState().cerrarRama();
    expect(useStoykoStore.getState().ramas).toHaveLength(3);
  });

  it('terminarAnalisis no avanza con una sola rama', async () => {
    await useStoykoStore.getState().empezar();
    declararRama(['f1c4', 'f8c5']);
    useStoykoStore.getState().terminarAnalisis();
    expect(useStoykoStore.getState().phase).toBe('analizando');
    expect(useStoykoStore.getState().inputError).not.toBeNull();
  });

  it('mide las tres varas por separado y persiste calibración y enfriamiento', async () => {
    await useStoykoStore.getState().empezar();
    declararRama(['d2d4', 'e5d4'], '∓');
    declararRama(['f1c4', 'f8c5', 'e1g1'], '='); // coincide con la línea del motor
    useStoykoStore.getState().terminarAnalisis();
    expect(useStoykoStore.getState().phase).toBe('confianza');

    await useStoykoStore.getState().confirmarConfianza(80);
    const s = useStoykoStore.getState();
    expect(s.phase).toBe('revelado');
    expect(s.acierto).toBe(true);
    expect(s.lineaMotorSan.length).toBeGreaterThan(0);
    // Declaró '=' en la rama de la mejor jugada y el motor dice '=': brecha 0.
    expect(s.resultado).toEqual({ cobertura: true, profundidadVista: 3, brechaEvaluacion: 0 });

    const records = await db.calibrationRecords.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ contexto: 'stoyko', confianzaDeclarada: 80, acierto: true });

    const profile = await db.profile.get('principal');
    expect(profile?.stoykoUltimaCompletadaEn).toBe(records[0].fecha);

    const attempts = await db.calculoAttempts.toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      preset: 'abierto',
      itemId: item.id,
      cobertura: true,
      profundidadVista: 3,
      brechaEvaluacion: 0,
      confianzaDeclarada: 80,
    });
    // Las líneas declaradas quedan enteras, no solo su primera jugada.
    expect(attempts[0].ramas.map((rama) => rama.linea)).toEqual([
      ['d2d4', 'e5d4'],
      ['f1c4', 'f8c5', 'e1g1'],
    ]);
    expect(typeof attempts[0].tiempoMs).toBe('number');
  });

  it('dos confirmaciones simultáneas guardan una sola calibración y un solo intento', async () => {
    // Regresión del doble envío: la guarda del store miraba `phase`, que recién
    // pasa a 'revelado' después de esperar al motor y a IndexedDB. Dos clics
    // rápidos pasaban los dos y guardaban dos observaciones del mismo acto,
    // contaminando el Brier y el historial de cálculo.
    await useStoykoStore.getState().empezar();
    declararRama(['d2d4', 'e5d4'], '∓');
    declararRama(['f1c4', 'f8c5', 'e1g1'], '=');
    useStoykoStore.getState().terminarAnalisis();
    expect(useStoykoStore.getState().phase).toBe('confianza');

    await Promise.all([
      useStoykoStore.getState().confirmarConfianza(80),
      useStoykoStore.getState().confirmarConfianza(80),
    ]);

    expect(await db.calibrationRecords.count()).toBe(1);
    expect(await db.calculoAttempts.count()).toBe(1);
  });

  it('la brecha se mide aunque no se tenga la mejor jugada del motor', async () => {
    await useStoykoStore.getState().empezar();
    declararRama(['d2d4', 'e5d4'], '+-'); // el motor dice '=': dos pasos
    declararRama(['b1c3', 'g8f6'], '=');
    useStoykoStore.getState().terminarAnalisis();
    await useStoykoStore.getState().confirmarConfianza(40);

    const s = useStoykoStore.getState();
    expect(s.acierto).toBe(false);
    expect(s.resultado).toMatchObject({ cobertura: false, profundidadVista: 0, brechaEvaluacion: 2 });
  });

  it('practicar durante el enfriamiento sirve una posición y NO mide ni resetea la semana', async () => {
    // Relativa a hoy: una fecha fija venció el enfriamiento (7 días) por
    // calendario y el test empezó a fallar solo, sin cambio de código.
    const ultima = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await seedProfile({ stoykoUltimaCompletadaEn: ultima });
    await useStoykoStore.getState().empezar();
    expect(useStoykoStore.getState().phase).toBe('enfriamiento');

    await useStoykoStore.getState().practicar();
    expect(useStoykoStore.getState().phase).toBe('analizando');
    expect(useStoykoStore.getState().practica).toBe(true);

    declararRama(['f1c4', 'f8c5'], '=');
    declararRama(['d2d4', 'e5d4'], '±');
    useStoykoStore.getState().terminarAnalisis();
    await useStoykoStore.getState().confirmarConfianza(70);

    expect(useStoykoStore.getState().phase).toBe('revelado');
    expect(useStoykoStore.getState().acierto).toBe(true); // se ve el resultado

    // Pero nada se persiste: sin calibración, sin intento, y el enfriamiento intacto.
    expect(await db.calibrationRecords.toArray()).toHaveLength(0);
    expect(await db.calculoAttempts.toArray()).toHaveLength(0);
    const profile = await db.profile.get('principal');
    expect(profile?.stoykoUltimaCompletadaEn).toBe(ultima);
  });

  // ADR-0015, punto 4: el material propio le gana al catálogo minado.
  it('con una partida analizada, la posición sale de ahí y no del catálogo', async () => {
    const game: GameRecord = {
      id: 'g-propia',
      pgn: '1. e4 e5 *',
      fuente: 'local',
      ritmo: 'clasica',
      resultado: '*',
      tiemposPorJugadaMs: [],
      analizada: true,
      fecha: '2026-07-20T10:00:00.000Z',
      jugadorColor: 'w',
      analisis: {
        jugadas: [
          {
            ply: 0,
            san: 'Nf3',
            fenAntes: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            ladoQueMueve: 'w',
            jugadaUsuario: 'g1f3',
            jugadaMotor: 'e2e4',
            cpAntes: 20,
            cpDespues: -180,
            cpPerdidos: 200,
            clasificacion: 'error',
          },
        ],
        comparacionEvaluaciones: [],
        analizadaEn: '2026-07-20T11:00:00.000Z',
      },
    };
    await db.games.put(game);

    await useStoykoStore.getState().empezar(true);
    const s = useStoykoStore.getState();
    expect(s.phase).toBe('analizando');
    expect(s.origen).toMatchObject({ tipo: 'propia', posicion: { gameId: 'g-propia', motivo: 'mas-centipeones' } });
    expect(s.fen).toBe(game.analisis!.jugadas[0].fenAntes);
  });
});
