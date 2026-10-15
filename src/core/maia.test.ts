import { describe, expect, it } from 'vitest';
import { posicionPropiaParaCalculo } from './calculoPosicion';
import type { EstadoPartidaLichess } from './ports';
import type { GameRecord, MoveAnalysisEntry } from './types';
import {
  BOTS_MAIA,
  botParaBanda,
  colorDelUsuario,
  esFalloDefinitivo,
  esperaParaReintentar,
  esTurnoDelUsuario,
  falloDesdeEstadoHttp,
  jugadasDeEstado,
  partidaEnCurso,
  resultadoDesdeLichess,
  tiemposDesdeRelojes,
} from './maia';

describe('botParaBanda (ADR-0004)', () => {
  it('propone un rival parejo, no una paliza en ninguna dirección', () => {
    expect(botParaBanda('principiante').usuario).toBe('maia1');
    expect(botParaBanda('elemental').usuario).toBe('maia1');
    expect(botParaBanda('intermedio').usuario).toBe('maia5');
    expect(botParaBanda('avanzado').usuario).toBe('maia9');
    expect(botParaBanda('experto').usuario).toBe('maia9');
  });

  it('los tres bots publicados cubren la banda del PRD', () => {
    expect(BOTS_MAIA.map((bot) => bot.elo)).toEqual([1100, 1500, 1900]);
  });
});

describe('colorDelUsuario', () => {
  it('reconoce de qué lado juega, sin importar mayúsculas', () => {
    expect(colorDelUsuario({ white: { id: 'fran' }, black: { id: 'maia1' } }, 'Fran')).toBe('w');
    expect(colorDelUsuario({ white: { id: 'maia1' }, black: { id: 'fran' } }, 'fran')).toBe('b');
  });

  it('devuelve null si el usuario no está en la partida, en vez de suponer', () => {
    expect(colorDelUsuario({ white: { id: 'otro' }, black: { id: 'maia1' } }, 'fran')).toBeNull();
    expect(colorDelUsuario({}, 'fran')).toBeNull();
  });
});

describe('esTurnoDelUsuario', () => {
  // Lichess manda la lista completa de jugadas en cada actualización: es la
  // fuente de verdad del turno, y evita llevar un contador propio que se
  // desincronice si se pierde un mensaje.
  it('con cero jugadas mueven las blancas', () => {
    expect(esTurnoDelUsuario('', 'w')).toBe(true);
    expect(esTurnoDelUsuario('', 'b')).toBe(false);
  });

  it('alterna con cada jugada', () => {
    expect(esTurnoDelUsuario('e2e4', 'b')).toBe(true);
    expect(esTurnoDelUsuario('e2e4', 'w')).toBe(false);
    expect(esTurnoDelUsuario('e2e4 e7e5', 'w')).toBe(true);
  });

  it('tolera espacios de más', () => {
    expect(esTurnoDelUsuario('  e2e4   e7e5  ', 'w')).toBe(true);
  });
});

describe('jugadasDeEstado', () => {
  it('una partida sin jugadas no produce una jugada vacía', () => {
    expect(jugadasDeEstado('')).toEqual([]);
    expect(jugadasDeEstado('   ')).toEqual([]);
  });

  it('separa la cadena que manda Lichess', () => {
    expect(jugadasDeEstado('e2e4 e7e5 g1f3')).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });
});

describe('resultadoDesdeLichess', () => {
  it('traduce el desenlace a notación PGN', () => {
    expect(resultadoDesdeLichess('mate', 'white')).toBe('1-0');
    expect(resultadoDesdeLichess('resign', 'black')).toBe('0-1');
    expect(resultadoDesdeLichess('draw')).toBe('1/2-1/2');
    expect(resultadoDesdeLichess('stalemate')).toBe('1/2-1/2');
  });

  it('una partida en curso todavía no tiene resultado', () => {
    expect(resultadoDesdeLichess('started')).toBe('*');
    expect(resultadoDesdeLichess('created')).toBe('*');
    expect(partidaEnCurso('started')).toBe(true);
    expect(partidaEnCurso('mate')).toBe(false);
  });

  it('una partida abortada no es tablas: no se jugó', () => {
    expect(resultadoDesdeLichess('aborted')).toBe('*');
  });
});

describe('falloDesdeEstadoHttp', () => {
  // Que un bot esté ocupado es un desenlace normal, no un error de la app: la
  // interfaz tiene que poder decir cuál de todos pasó.
  it('distingue los motivos que el usuario puede resolver', () => {
    expect(falloDesdeEstadoHttp(401)).toBe('token-invalido');
    expect(falloDesdeEstadoHttp(403)).toBe('sin-permisos');
    expect(falloDesdeEstadoHttp(404)).toBe('bot-no-disponible');
    expect(falloDesdeEstadoHttp(429)).toBe('limite-de-tasa');
    expect(falloDesdeEstadoHttp(500)).toBe('desconocido');
  });
});

describe('reintentos de una jugada (B12)', () => {
  it('solo 401, 403 y 404 son definitivos', () => {
    expect(esFalloDefinitivo(falloDesdeEstadoHttp(401))).toBe(true);
    expect(esFalloDefinitivo(falloDesdeEstadoHttp(403))).toBe(true);
    expect(esFalloDefinitivo(falloDesdeEstadoHttp(404))).toBe(true);
    expect(esFalloDefinitivo(falloDesdeEstadoHttp(429))).toBe(false);
    expect(esFalloDefinitivo(falloDesdeEstadoHttp(503))).toBe(false);
    expect(esFalloDefinitivo('sin-conexion')).toBe(false);
  });

  it('un corte de red se reintenta con esperas crecientes, y después se rinde', () => {
    expect([0, 1, 2, 3].map((intento) => esperaParaReintentar('sin-conexion', intento))).toEqual([
      1_000, 2_000, 4_000, null,
    ]);
  });

  it('un 429 espera el minuto que pide Lichess, una sola vez', () => {
    expect(esperaParaReintentar('limite-de-tasa', 0)).toBe(60_000);
    expect(esperaParaReintentar('limite-de-tasa', 1)).toBeNull();
  });

  it('un fallo definitivo no se reintenta', () => {
    expect(esperaParaReintentar('token-invalido', 0)).toBeNull();
  });
});

describe('tiemposDesdeRelojes (RF-7.2, D21)', () => {
  // 30+20, en milisegundos, como los manda Lichess.
  const INICIAL = 1_800_000;
  const INC = 20_000;
  const JUGADAS = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'];
  const estado = (n: number, wtime: number, btime: number, status = 'started'): EstadoPartidaLichess => ({
    moves: JUGADAS.slice(0, n).join(' '),
    status,
    wtime,
    btime,
    winc: INC,
    binc: INC,
  });

  // Blancas tardan 12 s en 2.Cf3 y 45 s en 3.Ab5; negras, 3 s en 2...Cc6.
  // La primera jugada de cada lado no mueve el reloj en Lichess.
  const partidaNormal = [
    estado(0, INICIAL, INICIAL),
    estado(1, INICIAL, INICIAL),
    estado(2, INICIAL, INICIAL),
    estado(3, INICIAL - 12_000 + INC, INICIAL),
    estado(4, INICIAL - 12_000 + INC, INICIAL - 3_000 + INC),
    estado(5, INICIAL - 12_000 + INC - 45_000 + INC, INICIAL - 3_000 + INC),
  ];

  it('lo consumido en cada ply es la diferencia de reloj más el incremento', () => {
    expect(tiemposDesdeRelojes(partidaNormal)).toEqual([0, 0, 12_000, 3_000, 45_000]);
  });

  it('la jugada que termina la partida no recibió incremento', () => {
    const conMate = [...partidaNormal.slice(0, 5), estado(5, INICIAL - 12_000 + INC - 45_000, INICIAL - 3_000 + INC, 'mate')];
    expect(tiemposDesdeRelojes(conMate)[4]).toBe(45_000);
  });

  it('un abandono después de la jugada no le quita el incremento', () => {
    const final = partidaNormal[5];
    expect(tiemposDesdeRelojes([...partidaNormal, { ...final, status: 'resign', winner: 'white' }])[4]).toBe(45_000);
  });

  it('sin los dos relojes que rodean una jugada, queda en 0 en vez de inventarla', () => {
    // Falta el estado posterior a 2.Cf3: no hay forma de saber cuánto tardó
    // en esa jugada, ni en la siguiente de blancas, que la necesita de base.
    const sinUno = partidaNormal.filter((_, i) => i !== 3);
    expect(tiemposDesdeRelojes(sinUno)).toEqual([0, 0, 0, 3_000, 0]);
  });

  it('un stream sin relojes da un cero por ply, alineado con la partida', () => {
    expect(tiemposDesdeRelojes([{ moves: 'e2e4 e7e5 g1f3', status: 'started' }])).toEqual([0, 0, 0]);
    expect(tiemposDesdeRelojes([])).toEqual([]);
  });

  // El índice es el mismo `ply` que usa el análisis: así el ejercicio de
  // cálculo encuentra la jugada propia en la que más tiempo se consumió.
  it('el ejercicio de cálculo elige la jugada propia donde más tiempo consumiste', () => {
    const jugada = (ply: number): MoveAnalysisEntry => ({
      ply,
      san: '',
      fenAntes: `fen-${ply}`,
      ladoQueMueve: ply % 2 === 0 ? 'w' : 'b',
      jugadaUsuario: JUGADAS[ply],
      jugadaMotor: JUGADAS[ply],
      cpAntes: 0,
      cpDespues: 0,
      cpPerdidos: 0,
      clasificacion: 'buena',
    });
    const juego: GameRecord = {
      id: 'maia-1',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 *',
      fuente: 'lichess',
      ritmo: 'clasica',
      resultado: '*',
      tiemposPorJugadaMs: tiemposDesdeRelojes(partidaNormal),
      analizada: true,
      fecha: '2026-07-17T15:00:00.000Z',
      jugadorColor: 'w',
      analisis: { jugadas: JUGADAS.map((_, ply) => jugada(ply)), comparacionEvaluaciones: [], analizadaEn: '2026-07-17T16:00:00.000Z' },
    };

    expect(posicionPropiaParaCalculo([juego])).toMatchObject({ motivo: 'mas-tiempo', ply: 4, fen: 'fen-4', tiempoMs: 45_000 });
  });
});
