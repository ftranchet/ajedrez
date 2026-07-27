import { describe, expect, it } from 'vitest';
import {
  MIN_OBSERVACIONES_FUGA,
  SESGO_FUGA,
  fugasPrincipales,
  lecturaPerfilDeFugas,
  perfilDeFugasDesdeIntentos,
  perfilVigente,
  sesgoPorFugas,
  tasaGlobalPerfil,
} from './leakProfile';
import type { PerfilDeFugas, RadarAttempt, TipoRadar } from './types';

function intentos(especificacion: Array<[TipoRadar, number, number]>) {
  return especificacion.flatMap(([tipo, aciertos, total]) =>
    Array.from({ length: total }, (_, index) => ({ tipo, acierto: index < aciertos })),
  );
}

function perfil(porTipo: PerfilDeFugas['porTipo']): PerfilDeFugas {
  return { porTipo, registradoEn: '2026-07-25T00:00:00.000Z' };
}

describe('perfilDeFugasDesdeIntentos (RF-11.4)', () => {
  it('cuenta aciertos y total por tipo, omitiendo los tipos sin observaciones', () => {
    const resultado = perfilDeFugasDesdeIntentos(
      intentos([
        ['ofensiva', 3, 4],
        ['defensa', 1, 4],
      ]),
      new Date('2026-07-25T10:00:00.000Z'),
    );
    expect(resultado.porTipo).toEqual([
      { tipo: 'ofensiva', aciertos: 3, total: 4 },
      { tipo: 'defensa', aciertos: 1, total: 4 },
    ]);
    expect(resultado.registradoEn).toBe('2026-07-25T10:00:00.000Z');
  });

  it('sin respuestas devuelve un perfil vacío en vez de tipos en 0/0', () => {
    expect(perfilDeFugasDesdeIntentos([]).porTipo).toEqual([]);
  });
});

describe('lecturaPerfilDeFugas', () => {
  it('ordena de peor a mejor acierto', () => {
    const lectura = lecturaPerfilDeFugas(
      perfil([
        { tipo: 'ofensiva', aciertos: 4, total: 4 },
        { tipo: 'defensa', aciertos: 1, total: 4 },
        { tipo: 'tranquila', aciertos: 2, total: 4 },
      ]),
    );
    expect(lectura.map((entrada) => entrada.tipo)).toEqual(['defensa', 'tranquila', 'ofensiva']);
    expect(lectura[0].tasa).toBeCloseTo(0.25);
  });

  it('sin perfil no inventa filas', () => {
    expect(lecturaPerfilDeFugas(undefined)).toEqual([]);
    expect(tasaGlobalPerfil(undefined)).toBeNull();
  });
});

describe('fugasPrincipales — honestidad con muestras chicas', () => {
  it('señala el tipo claramente peor que el promedio propio', () => {
    const fugas = fugasPrincipales(
      perfil([
        { tipo: 'ofensiva', aciertos: 4, total: 4 },
        { tipo: 'genuina', aciertos: 4, total: 4 },
        { tipo: 'tranquila', aciertos: 3, total: 4 },
        { tipo: 'defensa', aciertos: 1, total: 4 },
      ]),
    );
    expect(fugas.map((fuga) => fuga.tipo)).toEqual(['defensa']);
  });

  it('no señala nada cuando el usuario falla parejo en todo', () => {
    // Acierto global 50%: ningún tipo se separa del resto, así que no hay una
    // fuga que nombrar — el informe tiene que decirlo, no elegir el menor.
    expect(
      fugasPrincipales(
        perfil([
          { tipo: 'ofensiva', aciertos: 2, total: 4 },
          { tipo: 'defensa', aciertos: 2, total: 4 },
          { tipo: 'tranquila', aciertos: 2, total: 4 },
        ]),
      ),
    ).toEqual([]);
  });

  it('no señala un tipo con menos observaciones que el mínimo', () => {
    const conPocas = perfil([
      { tipo: 'ofensiva', aciertos: 8, total: 8 },
      { tipo: 'defensa', aciertos: 0, total: MIN_OBSERVACIONES_FUGA - 1 },
    ]);
    expect(fugasPrincipales(conPocas)).toEqual([]);
  });

  it('un tipo con acierto bajo pero mejor que el promedio no es fuga', () => {
    // El usuario acierta 20% en todo salvo un tipo donde acierta 40%: ese 40%
    // es bajo en absoluto, pero es lo mejor que tiene y no es la fuga.
    const fugas = fugasPrincipales(
      perfil([
        { tipo: 'ofensiva', aciertos: 2, total: 5 },
        { tipo: 'defensa', aciertos: 1, total: 5 },
        { tipo: 'tranquila', aciertos: 1, total: 5 },
      ]),
    );
    expect(fugas.map((fuga) => fuga.tipo)).not.toContain('ofensiva');
  });

  it('nombra como mucho dos fugas, las peores', () => {
    const fugas = fugasPrincipales(
      perfil([
        { tipo: 'ofensiva', aciertos: 6, total: 6 },
        { tipo: 'genuina', aciertos: 6, total: 6 },
        { tipo: 'defensa', aciertos: 1, total: 6 },
        { tipo: 'tranquila', aciertos: 2, total: 6 },
        { tipo: 'envenenada', aciertos: 0, total: 6 },
      ]),
    );
    expect(fugas).toHaveLength(2);
    expect(fugas.map((fuga) => fuga.tipo)).toEqual(['envenenada', 'defensa']);
  });
});

describe('perfilVigente (RF-11.2)', () => {
  const AHORA = new Date('2026-07-27T12:00:00.000Z');
  const diagnostico = perfil([
    { tipo: 'defensa', aciertos: 0, total: 4 },
    { tipo: 'ofensiva', aciertos: 4, total: 4 },
  ]);

  function respuestas(
    especificacion: Array<[TipoRadar, number, number]>,
    diasAtras = 1,
    origenContenido: RadarAttempt['origenContenido'] = 'catalogo',
  ) {
    const fecha = new Date(AHORA.getTime() - diasAtras * 24 * 60 * 60 * 1000).toISOString();
    return intentos(especificacion).map((intento) => ({ ...intento, fecha, origenContenido }));
  }

  it('sin evidencia propia suficiente, sigue rigiendo el perfil del diagnóstico', () => {
    expect(perfilVigente(diagnostico, [], AHORA)).toBe(diagnostico);
    // 10 respuestas no alcanzan el mínimo: la foto del diagnóstico sigue.
    expect(perfilVigente(diagnostico, respuestas([['defensa', 5, 10]]), AHORA)).toBe(diagnostico);
  });

  it('con evidencia propia reciente, esa manda sobre el diagnóstico', () => {
    // El usuario mejoró en defensa: el perfil vigente ya no la muestra como fuga.
    const vigente = perfilVigente(
      diagnostico,
      respuestas([
        ['defensa', 12, 15],
        ['tranquila', 3, 15],
      ]),
      AHORA,
    );
    expect(vigente).not.toBe(diagnostico);
    expect(fugasPrincipales(vigente).map((fuga) => fuga.tipo)).toEqual(['tranquila']);
  });

  it('ignora las respuestas viejas, las del diagnóstico y las de errores propios', () => {
    // 30 respuestas, pero ninguna computable: fuera de ventana o de otro origen.
    const viejas = respuestas([['defensa', 0, 30]], 45);
    expect(perfilVigente(diagnostico, viejas, AHORA)).toBe(diagnostico);

    const delDiagnostico = respuestas([['defensa', 0, 30]], 1, 'diagnostico');
    expect(perfilVigente(diagnostico, delDiagnostico, AHORA)).toBe(diagnostico);

    const propios = respuestas([['defensa', 0, 30]], 1, 'error-propio');
    expect(perfilVigente(diagnostico, propios, AHORA)).toBe(diagnostico);
  });
});

describe('sesgoPorFugas', () => {
  it('sesga solo los tipos con fuga declarada, con el multiplicador acotado', () => {
    const sesgo = sesgoPorFugas(
      perfil([
        { tipo: 'ofensiva', aciertos: 6, total: 6 },
        { tipo: 'defensa', aciertos: 1, total: 6 },
      ]),
    );
    expect(sesgo.get('defensa')).toBe(SESGO_FUGA);
    expect(sesgo.get('ofensiva')).toBeUndefined();
    expect(SESGO_FUGA).toBeLessThanOrEqual(2); // acotado a propósito
  });

  it('sin fuga con evidencia no sesga nada: el Radar sirve su mezcla de siempre', () => {
    expect(sesgoPorFugas(undefined).size).toBe(0);
    expect(sesgoPorFugas(perfil([{ tipo: 'defensa', aciertos: 0, total: 2 }])).size).toBe(0);
  });
});
