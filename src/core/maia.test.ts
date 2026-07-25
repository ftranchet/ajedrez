import { describe, expect, it } from 'vitest';
import {
  BOTS_MAIA,
  botParaBanda,
  colorDelUsuario,
  esTurnoDelUsuario,
  falloDesdeEstadoHttp,
  jugadasDeEstado,
  partidaEnCurso,
  resultadoDesdeLichess,
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
