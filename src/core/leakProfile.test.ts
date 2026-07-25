import { describe, expect, it } from 'vitest';
import {
  MIN_OBSERVACIONES_FUGA,
  fugasPrincipales,
  lecturaPerfilDeFugas,
  perfilDeFugasDesdeIntentos,
  tasaGlobalPerfil,
} from './leakProfile';
import type { PerfilDeFugas, TipoRadar } from './types';

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
