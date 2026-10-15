import { describe, expect, it } from 'vitest';
import { buildGameAnalysis, lecturaMomentoCritico, type EngineEvalAtPly, type LecturaMomentoCritico } from '../core/analysis';
import { posicionPropiaParaCalculo } from '../core/calculoPosicion';
import { ventajaDesperdiciada } from '../core/conversion';
import { CP_MATE } from '../core/engineLevels';
import type { Color, GameRecord, PhaseOneData } from '../core/types';
import { esMate, formatDecimal, formatDuracion, formatVentaja, fraseLecturaMomento, fraseSaltoVentaja, textoVentajaDesperdiciada } from './format';
import { t } from './i18n/es';

describe('formato numérico de interfaz', () => {
  it('usa coma rioplatense y conserva la precisión solicitada', () => {
    expect(formatDecimal(1.2, 2)).toBe('1,20');
    expect(formatDecimal(0.875, 1)).toBe('0,9');
  });
});

describe('formatDuracion', () => {
  it('por debajo del minuto muestra segundos', () => {
    expect(formatDuracion(45_000)).toBe('45 s');
    expect(formatDuracion(0)).toBe('0 s');
  });

  it('desde un minuto redondea a minutos: el tiempo es profundidad, no una marca', () => {
    expect(formatDuracion(60_000)).toBe('1 min');
    expect(formatDuracion(720_000)).toBe('12 min');
    expect(formatDuracion(100_000)).toBe('2 min'); // 1 min 40 s redondea a 2
  });

  it('no produce duraciones negativas', () => {
    expect(formatDuracion(-1000)).toBe('0 s');
  });
});

describe('formatVentaja', () => {
  it('muestra peones con un decimal y el signo de quién está mejor', () => {
    expect(formatVentaja(120)).toBe('+1,2');
    expect(formatVentaja(-80)).toBe('−0,8');
  });

  it('la igualdad es 0,0 y nunca "−0,0"', () => {
    expect(formatVentaja(0)).toBe('0,0');
    expect(formatVentaja(-4)).toBe('0,0');
    expect(formatVentaja(4)).toBe('0,0');
  });

  it('usa el menos tipográfico, el mismo de los símbolos de evaluación', () => {
    expect(formatVentaja(-250)).toBe('−2,5');
    expect(formatVentaja(-250)).not.toContain('-');
  });

  // El mate se guarda como ±CP_MATE centipeones: dividido por cien salía
  // "+1000,0", una ventaja que no existe en ningún tablero (B7, RNF-10).
  it('el mate se nombra, no se cuenta: nunca "+1000,0"', () => {
    expect(formatVentaja(CP_MATE)).toBe('mate a favor');
    expect(formatVentaja(-CP_MATE)).toBe('mate en contra');
    expect(formatVentaja(CP_MATE)).not.toMatch(/\d/);
    expect(formatVentaja(-CP_MATE)).not.toMatch(/\d/);
  });

  it('una ventaja enorme pero sin mate sigue siendo un número', () => {
    // El umbral es el centinela del mate, no el tope de diez peones de la
    // aritmética: +15 es una ventaja real y llamarla mate sería inventar.
    expect(formatVentaja(1500)).toBe('+15,0');
    expect(formatVentaja(-2500)).toBe('−25,0');
    expect(esMate(1500)).toBe(false);
    expect(esMate(CP_MATE)).toBe(true);
    expect(esMate(-CP_MATE)).toBe(true);
  });
});

describe('fraseSaltoVentaja', () => {
  const analisis = { costo: t.analisis.momentoLecturaCosto, mate: t.analisis.momentoLecturaMate };

  it('sin mate dice el salto y lo que costó, en peones', () => {
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 150, ventajaDespues: -170 })).toBe(
      'Esa jugada costó 3,2 peones: la evaluación pasó de +1,5 a −1,7.',
    );
  });

  // Regresión de la revisión de B7: el costo salía de `cpPerdidos`, acotado a
  // diez peones por extremo, y dejaba de cuadrar con el salto que se ve.
  it('el costo cierra con el salto aunque un extremo pase de diez peones', () => {
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 1240, ventajaDespues: -100 })).toBe(
      'Esa jugada costó 13,4 peones: la evaluación pasó de +12,4 a −1,0.',
    );
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 200, ventajaDespues: -1500 })).toBe(
      'Esa jugada costó 17,0 peones: la evaluación pasó de +2,0 a −15,0.',
    );
  });

  it('el costo se resta con los números ya redondeados, así cierra también el decimal', () => {
    // 124 → "+1,2" y −5 → "0,0": el costo visible es 1,2, no 1,3.
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 124, ventajaDespues: -5 })).toBe(
      'Esa jugada costó 1,2 peones: la evaluación pasó de +1,2 a 0,0.',
    );
  });

  // El mate no tiene valor en peones: "de +2,0 a mate en contra — costó 12,0
  // peones" sería una cifra de la convención del tope que el lector no puede
  // reconstruir. Con el mate nombrado, el salto ya dice qué se perdió.
  it('con mate en un extremo dice el salto sin costo en peones', () => {
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: 200, ventajaDespues: -CP_MATE })).toBe(
      'Con esa jugada la evaluación pasó de +2,0 a mate en contra.',
    );
    expect(fraseSaltoVentaja(analisis, { ventajaAntes: CP_MATE, ventajaDespues: -CP_MATE })).toBe(
      'Con esa jugada la evaluación pasó de mate a favor a mate en contra.',
    );
  });
});

// El caso real del hallazgo B7: el error más caro de una partida suele ser un
// mate desperdiciado, y es justo el que eligen la lectura del momento crítico
// y la posición propia de Cálculo.
describe('una partida cuyo error más caro desperdicia un mate', () => {
  const fase1: PhaseOneData = { momentoCriticoPly: 4, plan: 'atacar el enroque', evaluaciones: [], completadaEn: '2026-10-15T10:00:00.000Z' };

  function evalEn(ply: number, ladoQueMueve: Color, cpAntes: number): EngineEvalAtPly {
    return { ply, fen: `fen-${ply}`, san: `j${ply}`, ladoQueMueve, jugadaUsuario: 'a2a3', cpAntes, jugadaMotor: 'a2a4' };
  }

  function partida(jugadorColor: Color, evals: EngineEvalAtPly[], resultado: GameRecord['resultado']): GameRecord {
    return {
      id: 'g-mate',
      pgn: '*',
      fuente: 'local',
      ritmo: 'clasica',
      resultado,
      tiemposPorJugadaMs: [],
      analizada: true,
      fecha: '2026-10-15T10:00:00.000Z',
      jugadorColor,
      analisis: buildGameAnalysis(evals, null),
    };
  }

  // Blancas tienen mate en el ply 4 y juegan algo que deja "solo" +5: con la
  // escala acotada es la pérdida más grande de la partida (5 peones).
  const blancasTiranElMate = [
    evalEn(0, 'w', 30),
    evalEn(1, 'b', 40),
    evalEn(2, 'w', 350),
    evalEn(3, 'b', 900),
    evalEn(4, 'w', CP_MATE),
    evalEn(5, 'b', 500),
  ];

  it('la lectura del momento crítico nombra el mate en vez de mostrar "+1000,0"', () => {
    const lectura = lecturaMomentoCritico(buildGameAnalysis(blancasTiranElMate, fase1), fase1)!;
    expect(lectura.plyMotor).toBe(4);
    // El dominio no pierde información: la ventaja sigue siendo el mate.
    expect(lectura.ventajaAntes).toBe(CP_MATE);
    expect(formatVentaja(lectura.ventajaAntes)).not.toMatch(/1000/);
    expect(formatVentaja(lectura.ventajaAntes)).toBe('mate a favor');
    expect(fraseSaltoVentaja({ costo: t.analisis.momentoLecturaCosto, mate: t.analisis.momentoLecturaMate }, lectura)).toBe(
      'Con esa jugada la evaluación pasó de mate a favor a +5,0.',
    );
  });

  // Revisión de B7: el vuelco no se filtra por lado. Si el que desperdicia el
  // mate es el rival, "pasó de mate a favor a −5,0" le atribuía el mate al
  // usuario, que en realidad estaba por recibirlo.
  const negrasTiranElMate = [
    evalEn(0, 'w', 20),
    evalEn(1, 'b', -300),
    evalEn(2, 'w', -800),
    evalEn(3, 'b', -CP_MATE),
    evalEn(4, 'w', 500),
  ];

  it('si el vuelco lo hizo el rival, lo dice y cuenta la evaluación desde el lado del usuario', () => {
    const lectura = lecturaMomentoCritico(buildGameAnalysis(negrasTiranElMate, fase1), fase1)!;
    expect(lectura.plyMotor).toBe(3);
    expect(lectura.ladoQueMueve).toBe('b');
    // "La evaluación": "tus evaluaciones" son, en esta pantalla, las de la fase 1.
    expect(fraseLecturaMomento(lectura, 'w')).toBe('Fue una jugada de tu rival: la evaluación, desde tu lado, pasó de mate en contra a +5,0.');
  });

  it('si el vuelco lo hizo el usuario, la frase es la del salto con su costo', () => {
    const lectura: LecturaMomentoCritico = {
      plyUsuario: 4,
      plyMotor: 4,
      ladoQueMueve: 'w',
      cpPerdidos: 320,
      ventajaAntes: 150,
      ventajaDespues: -170,
      sanMotor: 'Cf3',
      coincide: true,
      distanciaJugadas: 0,
    };
    expect(fraseLecturaMomento(lectura, 'w')).toBe('Esa jugada costó 3,2 peones: la evaluación pasó de +1,5 a −1,7.');
  });

  it('si el vuelco con mate lo hizo el usuario, la frase es la del salto, sin costo', () => {
    const lectura = lecturaMomentoCritico(buildGameAnalysis(negrasTiranElMate, fase1), fase1)!;
    expect(fraseLecturaMomento(lectura, 'b')).toBe('Con esa jugada la evaluación pasó de mate a favor a −5,0.');
  });

  it('sin el color del usuario nombra el bando y dice que la evaluación es desde su lado', () => {
    const lectura = lecturaMomentoCritico(buildGameAnalysis(negrasTiranElMate, fase1), fase1)!;
    expect(fraseLecturaMomento(lectura, undefined)).toBe(
      'Jugaban las negras, y la evaluación se cuenta desde su lado. Con esa jugada la evaluación pasó de mate a favor a −5,0.',
    );
  });

  it('la posición propia de Cálculo, con negras: el mate es de quien movió', () => {
    // Perspectiva blancas: −CP_MATE es mate de las negras; después queda −300,
    // o sea +3 para las negras, que son el usuario.
    const negrasTiranElMate = [evalEn(0, 'w', -200), evalEn(1, 'b', -CP_MATE), evalEn(2, 'w', -300)];
    const posicion = posicionPropiaParaCalculo([partida('b', negrasTiranElMate, '1/2-1/2')])!;
    expect(posicion.ply).toBe(1);
    expect(posicion.ventajaAntes).toBe(CP_MATE);
    expect(fraseSaltoVentaja({ costo: t.stoyko.origenPropiaPeones, mate: t.stoyko.origenPropiaMate }, posicion)).toBe(
      'Posición de tu propia partida: acá tu ventaja pasó de mate a favor a +3,0. Volvés a tomar esa decisión.',
    );
  });

  it('la ventaja desperdiciada de Conversión conserva el mate y se reconoce como tal', () => {
    const ventaja = ventajaDesperdiciada(partida('w', blancasTiranElMate, '1/2-1/2'))!;
    expect(ventaja.ventajaCp).toBe(CP_MATE);
    expect(esMate(ventaja.ventajaCp)).toBe(true);
  });

  it('la lista de Conversión nombra el mate en vez de "Ventaja de +1000,0"', () => {
    const ventaja = ventajaDesperdiciada(partida('w', blancasTiranElMate, '1/2-1/2'))!;
    expect(textoVentajaDesperdiciada(ventaja)).toBe('Tenías mate forzado en la jugada 3');
    expect(textoVentajaDesperdiciada({ ply: 4, ventajaCp: 450 })).toBe('Ventaja de +4,5 en la jugada 3');
  });
});
