import { describe, expect, it } from 'vitest';
import {
  buildGameAnalysis,
  classifyMoveLoss,
  computeCpLoss,
  detectedErrorMoves,
  esMomentoCriticoValido,
  evalToSymbol,
  lecturaMomentoCritico,
  momentoCriticoDelMotor,
  pickPhaseOnePositions,
  type EngineEvalAtPly,
} from './analysis';
import type { PhaseOneData } from './types';

describe('classifyMoveLoss', () => {
  it('clasifica grave desde 200cp', () => {
    expect(classifyMoveLoss(200)).toBe('grave');
    expect(classifyMoveLoss(500)).toBe('grave');
  });
  it('clasifica error entre 100 y 199cp', () => {
    expect(classifyMoveLoss(100)).toBe('error');
    expect(classifyMoveLoss(199)).toBe('error');
  });
  it('clasifica imprecisión entre 50 y 99cp', () => {
    expect(classifyMoveLoss(50)).toBe('imprecision');
    expect(classifyMoveLoss(99)).toBe('imprecision');
  });
  it('clasifica buena por debajo de 50cp', () => {
    expect(classifyMoveLoss(0)).toBe('buena');
    expect(classifyMoveLoss(49)).toBe('buena');
  });
});

describe('evalToSymbol', () => {
  it('mapea los cinco valores de la escala', () => {
    expect(evalToSymbol(300)).toBe('+-');
    expect(evalToSymbol(149)).toBe('±');
    expect(evalToSymbol(80)).toBe('±');
    expect(evalToSymbol(0)).toBe('=');
    expect(evalToSymbol(-40)).toBe('=');
    expect(evalToSymbol(-80)).toBe('∓');
    expect(evalToSymbol(-300)).toBe('-+');
  });

  it('el límite de 150cp entra en la categoría "claro" (+-/-+), no en "±/∓"', () => {
    expect(evalToSymbol(150)).toBe('+-');
    expect(evalToSymbol(-150)).toBe('-+');
  });
});

describe('computeCpLoss', () => {
  it('blancas: empeorar el eval blanco es la pérdida', () => {
    expect(computeCpLoss(50, -100, 'w')).toBe(150);
  });
  it('blancas: mejorar no da pérdida negativa, da 0', () => {
    expect(computeCpLoss(50, 200, 'w')).toBe(0);
  });
  it('negras: empeorar significa que el eval blanco sube', () => {
    // Negras mueven en una posición de -50 (mejor para negras) y el eval
    // blanco sube a +100: negras perdieron 150cp de su propia perspectiva.
    expect(computeCpLoss(-50, 100, 'b')).toBe(150);
  });
  it('negras: mejorar (bajar el eval blanco) da 0 de pérdida', () => {
    expect(computeCpLoss(50, -100, 'b')).toBe(0);
  });
});

describe('pickPhaseOnePositions', () => {
  it('reparte 3 posiciones evitando apertura y desenlace en una partida larga', () => {
    const positions = pickPhaseOnePositions(60, 3);
    expect(positions).toHaveLength(3);
    expect(positions[0]).toBeGreaterThan(0);
    expect(positions[positions.length - 1]).toBeLessThan(59);
    // Ordenadas y sin repetidos.
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('con una partida muy corta, devuelve como mucho una posición por ply', () => {
    const positions = pickPhaseOnePositions(2, 3);
    expect(positions.length).toBeLessThanOrEqual(2);
    for (const p of positions) expect(p).toBeLessThan(2);
  });

  it('con 0 plies, no devuelve nada', () => {
    expect(pickPhaseOnePositions(0, 3)).toEqual([]);
  });
});

describe('esMomentoCriticoValido', () => {
  it('acepta un ply dentro de rango', () => {
    expect(esMomentoCriticoValido(10, 40)).toBe(true);
    expect(esMomentoCriticoValido(0, 40)).toBe(true);
    expect(esMomentoCriticoValido(39, 40)).toBe(true);
  });
  it('rechaza fuera de rango o no entero', () => {
    expect(esMomentoCriticoValido(-1, 40)).toBe(false);
    expect(esMomentoCriticoValido(40, 40)).toBe(false);
    expect(esMomentoCriticoValido(1.5, 40)).toBe(false);
  });
});

describe('buildGameAnalysis', () => {
  const fase1: PhaseOneData = {
    momentoCriticoPly: 1,
    plan: 'Desarrollar y enroscar',
    evaluaciones: [
      { ply: 0, valorUsuario: '=' },
      { ply: 1, valorUsuario: '+-' }, // el usuario se equivoca acá: el motor dirá que sigue igual
    ],
    completadaEn: '2026-07-17T00:00:00.000Z',
  };

  // 3 jugadas → 4 evaluaciones (una por posición, incluida la final).
  const evals: EngineEvalAtPly[] = [
    { ply: 0, fen: 'fen0', san: 'e4', ladoQueMueve: 'w', jugadaUsuario: 'e2e4', cpAntes: 20, jugadaMotor: 'e2e4' },
    { ply: 1, fen: 'fen1', san: 'e5', ladoQueMueve: 'b', jugadaUsuario: 'e7e5', cpAntes: 25, jugadaMotor: 'e7e5' },
    { ply: 2, fen: 'fen2', san: 'Qh5??', ladoQueMueve: 'w', jugadaUsuario: 'd1h5', cpAntes: 30, jugadaMotor: 'g1f3' },
    { ply: 3, fen: 'fen3', san: 'Nc6', ladoQueMueve: 'b', jugadaUsuario: 'b8c6', cpAntes: -180, jugadaMotor: 'b8c6' },
  ];

  it('arma una entrada por jugada con la clasificación correcta', () => {
    const analysis = buildGameAnalysis(evals, fase1);
    expect(analysis.jugadas).toHaveLength(3);
    // ply 2: blancas van de +30 a -180 → pierden 210cp → grave.
    const jugadaGrave = analysis.jugadas.find((j) => j.ply === 2)!;
    expect(jugadaGrave.cpPerdidos).toBe(210);
    expect(jugadaGrave.clasificacion).toBe('grave');
    // ply 0 y 1: sin pérdida relevante.
    expect(analysis.jugadas.find((j) => j.ply === 0)!.clasificacion).toBe('buena');
  });

  it('compara las evaluaciones declaradas contra las del motor', () => {
    const analysis = buildGameAnalysis(evals, fase1);
    expect(analysis.comparacionEvaluaciones).toHaveLength(2);
    const ply0 = analysis.comparacionEvaluaciones.find((c) => c.ply === 0)!;
    expect(ply0.valorMotor).toBe('='); // 20cp → '='
    expect(ply0.coincide).toBe(true);
    const ply1 = analysis.comparacionEvaluaciones.find((c) => c.ply === 1)!;
    expect(ply1.valorMotor).toBe('='); // 25cp → '=', el usuario dijo '+-'
    expect(ply1.coincide).toBe(false);
  });
});

describe('detectedErrorMoves', () => {
  it('filtra grave y error, pero no imprecisión ni buena (RF-3.3)', () => {
    // Puntos de eval (perspectiva blancas) elegidos para que cada jugada
    // caiga en una categoría distinta y verificable a mano:
    //   ply0 (blancas, 50→-70): pierde 120cp → error
    //   ply1 (negras, -70→-10): pierde 60cp  → imprecisión (se excluye)
    //   ply2 (blancas, -10→-260): pierde 250cp → grave
    const analysis = buildGameAnalysis(
      [
        { ply: 0, fen: 'f0', san: 'a', ladoQueMueve: 'w', jugadaUsuario: 'x', cpAntes: 50, jugadaMotor: 'x' },
        { ply: 1, fen: 'f1', san: 'b', ladoQueMueve: 'b', jugadaUsuario: 'x', cpAntes: -70, jugadaMotor: 'x' },
        { ply: 2, fen: 'f2', san: 'c', ladoQueMueve: 'w', jugadaUsuario: 'x', cpAntes: -10, jugadaMotor: 'x' },
        { ply: 3, fen: 'f3', san: 'd', ladoQueMueve: 'b', jugadaUsuario: 'x', cpAntes: -260, jugadaMotor: 'x' },
      ],
      { momentoCriticoPly: 0, plan: '', evaluaciones: [], completadaEn: '2026-07-17T00:00:00.000Z' },
    );
    expect(analysis.jugadas.map((j) => j.clasificacion)).toEqual(['error', 'imprecision', 'grave']);
    const errores = detectedErrorMoves(analysis);
    expect(errores.map((e) => e.ply)).toEqual([0, 2]);
  });

  it('con jugadorColor conocido, solo devuelve los errores de ese lado (no los del motor, RF-1.3/RF-3.3)', () => {
    // ply0 (blancas) pierde 120cp → error; ply2 (blancas) pierde 250cp → grave;
    // ambos son de blancas. Un usuario que jugó negras no debe recibir tarjetas
    // por estos: son errores del motor.
    const analysis = buildGameAnalysis(
      [
        { ply: 0, fen: 'f0', san: 'a', ladoQueMueve: 'w', jugadaUsuario: 'x', cpAntes: 50, jugadaMotor: 'x' },
        { ply: 1, fen: 'f1', san: 'b', ladoQueMueve: 'b', jugadaUsuario: 'x', cpAntes: -70, jugadaMotor: 'x' },
        { ply: 2, fen: 'f2', san: 'c', ladoQueMueve: 'w', jugadaUsuario: 'x', cpAntes: -10, jugadaMotor: 'x' },
        { ply: 3, fen: 'f3', san: 'd', ladoQueMueve: 'b', jugadaUsuario: 'x', cpAntes: -260, jugadaMotor: 'x' },
      ],
      { momentoCriticoPly: 0, plan: '', evaluaciones: [], completadaEn: '2026-07-17T00:00:00.000Z' },
    );
    // Usuario jugó blancas: recibe sus dos errores.
    expect(detectedErrorMoves(analysis, 'w').map((e) => e.ply)).toEqual([0, 2]);
    // Usuario jugó negras: ninguno de esos dos errores es suyo.
    expect(detectedErrorMoves(analysis, 'b').map((e) => e.ply)).toEqual([]);
  });
});

describe('momento crítico: percibido vs. el del motor (RF-3.1a)', () => {
  const fase1 = (ply: number): PhaseOneData => ({
    momentoCriticoPly: ply,
    plan: 'un plan',
    evaluaciones: [],
    completadaEn: '2026-07-17T00:00:00.000Z',
  });

  // 4 jugadas: el vuelco real está en el ply 4 (blancas pierden 300cp).
  const evals: EngineEvalAtPly[] = [
    { ply: 0, fen: 'f0', san: 'e4', ladoQueMueve: 'w', jugadaUsuario: 'e2e4', cpAntes: 20, jugadaMotor: 'e2e4' },
    { ply: 1, fen: 'f1', san: 'e5', ladoQueMueve: 'b', jugadaUsuario: 'e7e5', cpAntes: 25, jugadaMotor: 'e7e5' },
    { ply: 2, fen: 'f2', san: 'Nf3', ladoQueMueve: 'w', jugadaUsuario: 'g1f3', cpAntes: 30, jugadaMotor: 'g1f3' },
    { ply: 3, fen: 'f3', san: 'Nc6', ladoQueMueve: 'b', jugadaUsuario: 'b8c6', cpAntes: 10, jugadaMotor: 'b8c6' },
    { ply: 4, fen: 'f4', san: 'Bxf7??', ladoQueMueve: 'w', jugadaUsuario: 'c4f7', cpAntes: 20, jugadaMotor: 'd2d4' },
    { ply: 5, fen: 'f5', san: 'Kxf7', ladoQueMueve: 'b', jugadaUsuario: 'e8f7', cpAntes: -280, jugadaMotor: 'e8f7' },
  ];

  it('el motor ubica el vuelco en la jugada de mayor pérdida', () => {
    const analysis = buildGameAnalysis(evals, fase1(0));
    const motor = momentoCriticoDelMotor(analysis);
    expect(motor?.ply).toBe(4);
    expect(motor?.san).toBe('Bxf7??');
    expect(motor?.cpPerdidos).toBe(300);
  });

  it('sin jugadas que muevan la evaluación, no inventa un momento', () => {
    const planas: EngineEvalAtPly[] = [
      { ply: 0, fen: 'f0', san: 'e4', ladoQueMueve: 'w', jugadaUsuario: 'e2e4', cpAntes: 0, jugadaMotor: 'e2e4' },
      { ply: 1, fen: 'f1', san: 'e5', ladoQueMueve: 'b', jugadaUsuario: 'e7e5', cpAntes: 0, jugadaMotor: 'e7e5' },
    ];
    expect(momentoCriticoDelMotor(buildGameAnalysis(planas, fase1(0)))).toBeNull();
    expect(lecturaMomentoCritico(buildGameAnalysis(planas, fase1(0)), fase1(0))).toBeNull();
  });

  it('acierta si marcó la jugada del vuelco', () => {
    const analysis = buildGameAnalysis(evals, fase1(4));
    const lectura = lecturaMomentoCritico(analysis, fase1(4))!;
    expect(lectura.coincide).toBe(true);
    expect(lectura.distanciaJugadas).toBe(0);
    expect(lectura.plyMotor).toBe(4);
    expect(lectura.cpPerdidos).toBe(300);
  });

  it('acierta dentro de una jugada completa de tolerancia', () => {
    // ply 2 está a 2 medias jugadas del 4: sigue contando como percibido.
    expect(lecturaMomentoCritico(buildGameAnalysis(evals, fase1(2)), fase1(2))!.coincide).toBe(true);
    // ply 5 está a 1 media jugada: también.
    expect(lecturaMomentoCritico(buildGameAnalysis(evals, fase1(5)), fase1(5))!.coincide).toBe(true);
  });

  it('no acierta si lo ubicó lejos, y reporta a cuántas jugadas', () => {
    const lectura = lecturaMomentoCritico(buildGameAnalysis(evals, fase1(0)), fase1(0))!;
    expect(lectura.coincide).toBe(false);
    expect(lectura.distanciaJugadas).toBe(2); // 4 medias jugadas = 2 completas
  });
});
