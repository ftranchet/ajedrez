import { describe, expect, it } from 'vitest';
import {
  ESQUEMA_MINIMO_MIGRABLE,
  esEsquemaMigrable,
  migrarDatosImportados,
  partidasDelDiagnostico,
  recalcularPerdidas,
  type DatosMigrables,
} from './importMigrations';
import { SCHEMA_VERSION } from './schemaVersion';
import type { CompromisoAttempt, GameRecord, RadarAttempt, StoykoAttempt } from './types';

const CIERRE = '2026-03-10T18:00:00.000Z';

function game(over: Partial<GameRecord> & { id: string }): GameRecord {
  return {
    pgn: '1. e4 e5 *',
    fuente: 'local',
    ritmo: 'sin-reloj',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: false,
    fecha: '2026-03-10T17:00:00.000Z',
    ...over,
  };
}

function radarAttempt(over: Partial<RadarAttempt> & { id: string }): RadarAttempt {
  return {
    itemId: 'lichess-000aY',
    tipo: 'ofensiva',
    rating: 1500,
    acierto: true,
    fecha: '2026-03-10T17:30:00.000Z',
    ...over,
  } as RadarAttempt;
}

function datos(over: Partial<DatosMigrables> = {}): DatosMigrables {
  return {
    games: [],
    radarAttempts: [],
    compromisoAttempts: [],
    stoykoAttempts: [],
    calculoAttempts: [],
    profile: { diagnosticoCompletadoEn: CIERRE },
    ...over,
  };
}

describe('migrarDatosImportados', () => {
  it('un paquete al día no se toca', () => {
    const original = datos({ games: [game({ id: 'g1' })] });
    const { datos: salida, aplicadas } = migrarDatosImportados(original, SCHEMA_VERSION);
    expect(aplicadas).toEqual([]);
    expect(salida).toEqual(original);
  });

  it('aplica en orden todos los pasos que le faltan a un respaldo v15', () => {
    const { aplicadas } = migrarDatosImportados(datos(), 15);
    expect(aplicadas).toEqual([16, 18, 19]);
  });

  it('un respaldo v17 recibe solo los pasos posteriores', () => {
    const { aplicadas } = migrarDatosImportados(datos(), 17);
    expect(aplicadas).toEqual([18, 19]);
  });

  it('un respaldo v18 recibe solo la corrección de pérdidas', () => {
    expect(migrarDatosImportados(datos(), 18).aplicadas).toEqual([19]);
  });

  describe('v16 — atribución del diagnóstico', () => {
    it('marca las dos partidas del diagnóstico y deja las demás como propias', () => {
      // Tres candidatas dentro de la ventana: el diagnóstico son dos, y las
      // dos más cercanas al cierre. La tercera es una partida suelta.
      const salida = migrarDatosImportados(
        datos({
          games: [
            game({ id: 'vieja', fecha: '2026-03-10T09:00:00.000Z' }),
            game({ id: 'media', fecha: '2026-03-10T17:00:00.000Z' }),
            game({ id: 'nueva', fecha: '2026-03-10T17:45:00.000Z' }),
          ],
        }),
        15,
      ).datos;
      const contextos = Object.fromEntries(salida.games.map((g) => [g.id, g.contexto]));
      expect(contextos).toEqual({ vieja: undefined, media: 'diagnostico', nueva: 'diagnostico' });
    });

    it('no atribuye partidas fuera de la ventana ni con reloj ni importadas', () => {
      const salida = migrarDatosImportados(
        datos({
          games: [
            game({ id: 'anteayer', fecha: '2026-03-08T17:00:00.000Z' }),
            game({ id: 'con-reloj', ritmo: 'blitz' }),
            game({ id: 'importada', fuente: 'lichess' }),
            game({ id: 'posterior', fecha: '2026-03-10T19:00:00.000Z' }),
          ],
        }),
        15,
      ).datos;
      expect(salida.games.every((g) => g.contexto === undefined)).toBe(true);
    });

    it('sin diagnóstico cerrado no atribuye nada', () => {
      const salida = migrarDatosImportados(
        datos({ games: [game({ id: 'g1' })], profile: { diagnosticoCompletadoEn: null } }),
        15,
      ).datos;
      expect(salida.games[0]!.contexto).toBeUndefined();
    });

    it('marca las respuestas del Radar del diagnóstico y respeta las ya atribuidas', () => {
      const salida = migrarDatosImportados(
        datos({
          radarAttempts: [
            radarAttempt({ id: 'diag' }),
            radarAttempt({ id: 'catalogo', dificultadNormalizada: 62 }),
            radarAttempt({ id: 'propio', origenContenido: 'error-propio' }),
            radarAttempt({ id: 'vieja', fecha: '2026-03-01T10:00:00.000Z' }),
          ],
        }),
        15,
      ).datos;
      const origenes = Object.fromEntries(salida.radarAttempts.map((a) => [a.id, a.origenContenido]));
      expect(origenes).toEqual({
        diag: 'diagnostico',
        catalogo: undefined,
        propio: 'error-propio',
        vieja: undefined,
      });
    });
  });

  describe('v18 — intentos de cálculo', () => {
    const compromiso: CompromisoAttempt = {
      id: 'c1',
      itemId: 'lichess-000aY',
      profundidad: 3,
      correcta: false,
      primerErrorEn: 1,
      tiempoMs: 42_000,
      fecha: '2026-02-01T10:00:00.000Z',
    };
    const stoyko: StoykoAttempt = {
      id: 's1',
      itemId: 'stoyko-1',
      candidatas: [{ jugada: 'e4', evaluacion: '=' }],
      acierto: true,
      confianzaDeclarada: 70,
      tiempoMs: 60_000,
      fecha: '2026-02-02T10:00:00.000Z',
    };

    it('convierte los intentos viejos: el historial deja de ser invisible para el Panel', () => {
      // El síntoma que arregla: el Panel y los experimentos leen
      // `calculoAttempts`, así que un respaldo v17 restaurado sin migrar
      // parecía haber perdido todo el historial de cálculo.
      const salida = migrarDatosImportados(
        datos({ compromisoAttempts: [compromiso], stoykoAttempts: [stoyko] }),
        17,
        { solucionPorItem: new Map([['lichess-000aY', ['a5c3', 'b2c3', 'c6e7']]]) },
      ).datos;
      expect(salida.calculoAttempts.map((a) => a.id)).toEqual(['c1', 's1']);
      expect(salida.calculoAttempts[0]!.preset).toBe('forzado');
      // La línea se reconstruye hasta el ply divergente, con el catálogo local.
      expect(salida.calculoAttempts[0]!.ramas[0]!.linea).toEqual(['a5c3']);
      expect(salida.calculoAttempts[1]!.preset).toBe('abierto');
    });

    it('no borra las tablas viejas: son el original de la conversión', () => {
      const salida = migrarDatosImportados(
        datos({ compromisoAttempts: [compromiso], stoykoAttempts: [stoyko] }),
        17,
      ).datos;
      expect(salida.compromisoAttempts).toHaveLength(1);
      expect(salida.stoykoAttempts).toHaveLength(1);
    });

    it('no duplica un intento que el respaldo ya trae convertido', () => {
      const yaConvertido = {
        id: 'c1',
        preset: 'forzado' as const,
        itemId: 'lichess-000aY',
        ramas: [{ linea: ['a5c3', 'b2c3'] }],
        correcta: false,
        primerErrorEn: 1,
        fecha: compromiso.fecha,
      };
      const salida = migrarDatosImportados(
        datos({ compromisoAttempts: [compromiso], calculoAttempts: [yaConvertido] }),
        17,
      ).datos;
      expect(salida.calculoAttempts).toHaveLength(1);
      // Gana el que ya estaba en el formato nuevo: tiene más información que
      // la que la conversión puede reconstruir.
      expect(salida.calculoAttempts[0]!.ramas[0]!.linea).toEqual(['a5c3', 'b2c3']);
    });

    it('sin catálogo local la rama queda vacía en vez de inventada', () => {
      const salida = migrarDatosImportados(datos({ compromisoAttempts: [compromiso] }), 17).datos;
      expect(salida.calculoAttempts[0]!.ramas[0]!.linea).toEqual([]);
    });
  });

  describe('v19 — pérdidas de centipeones imposibles', () => {
    // El mate se codifica como ±100.000 cp: restarlo daba pérdidas de decenas
    // de miles de centipeones que se mostraban tal cual para siempre.
    const conMate = game({
      id: 'g1',
      analizada: true,
      analisis: {
        analizadaEn: '2026-01-01T00:00:00.000Z',
        comparacionEvaluaciones: [],
        jugadas: [
          {
            ply: 0,
            san: 'Qh5',
            fenAntes: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            ladoQueMueve: 'w',
            jugadaUsuario: 'd1h5',
            jugadaMotor: 'e2e4',
            cpAntes: 1092,
            cpDespues: -100_000,
            cpPerdidos: 98_908,
            clasificacion: 'grave',
          },
        ],
      },
    });

    it('recalcula la pérdida y su clasificación de un análisis guardado', () => {
      const salida = migrarDatosImportados(datos({ games: [conMate] }), 18).datos;
      const jugada = salida.games[0]!.analisis!.jugadas[0]!;
      expect(jugada.cpPerdidos).toBeLessThan(98_908);
      expect(jugada.cpPerdidos).toBe(recalcularPerdidas(conMate).analisis!.jugadas[0]!.cpPerdidos);
    });

    it('una partida sin análisis pasa intacta', () => {
      const sinAnalisis = game({ id: 'g2' });
      expect(recalcularPerdidas(sinAnalisis)).toBe(sinAnalisis);
    });
  });

  it('el resultado no depende de en cuántos pasos se llegue', () => {
    // Restaurar un v15 y actualizar in situ un v15 tienen que terminar igual:
    // aplicar la cadena entera o solo el último paso sobre datos ya migrados
    // debe converger al mismo estado.
    const base = datos({
      games: [game({ id: 'g1', fecha: '2026-03-10T17:45:00.000Z' })],
      radarAttempts: [radarAttempt({ id: 'r1' })],
    });
    const deUnaVez = migrarDatosImportados(base, 15).datos;
    const enDosPasos = migrarDatosImportados(migrarDatosImportados(base, 15).datos, 15).datos;
    expect(enDosPasos).toEqual(deUnaVez);
  });
});

describe('esEsquemaMigrable', () => {
  it('acepta el rango que la cadena sabe cubrir', () => {
    expect(esEsquemaMigrable(ESQUEMA_MINIMO_MIGRABLE)).toBe(true);
    expect(esEsquemaMigrable(SCHEMA_VERSION)).toBe(true);
  });

  it('rechaza lo que está fuera del rango', () => {
    expect(esEsquemaMigrable(0)).toBe(false);
    expect(esEsquemaMigrable(SCHEMA_VERSION + 1)).toBe(false);
  });
});

describe('partidasDelDiagnostico', () => {
  it('nunca atribuye más de dos partidas', () => {
    const cierre = new Date(CIERRE).getTime();
    const candidatas = Array.from({ length: 5 }, (_, i) =>
      game({ id: `g${i}`, fecha: new Date(cierre - i * 60_000).toISOString() }),
    );
    expect(partidasDelDiagnostico(candidatas, cierre).size).toBe(2);
  });
});
