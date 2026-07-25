import { describe, expect, it } from 'vitest';
import { partidaLentaSemanal } from './slowGame';
import type { GameRecord } from './types';

// El compromiso semanal exige una partida de largo realista (ver
// JUGADAS_MINIMAS_COMPROMISO): rendirse en la jugada 4 produce una partida
// real, pero no es el ejercicio que el compromiso pide.
const PGN_COMPLETA = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *';

function game(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: crypto.randomUUID(),
    pgn: PGN_COMPLETA,
    fuente: 'local',
    ritmo: 'clasica',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: false,
    fecha: '2026-07-22T10:00:00.000Z', // miércoles de la semana del 20–26
    ...overrides,
  };
}

describe('partidaLentaSemanal (RF-11.7)', () => {
  const ahora = new Date(2026, 6, 22, 20); // miércoles 22/07 (semana lun 20 – dom 26), local

  it('sin partidas lentas esta semana', () => {
    expect(partidaLentaSemanal([], ahora)).toBe('sin-jugar');
    // Una partida de la semana pasada no cuenta.
    expect(partidaLentaSemanal([game({ fecha: new Date(2026, 6, 15, 10).toISOString() })], ahora)).toBe('sin-jugar');
    // Blitz/bullet no cuentan como lenta.
    expect(partidaLentaSemanal([game({ ritmo: 'blitz', fecha: new Date(2026, 6, 21, 10).toISOString() })], ahora)).toBe('sin-jugar');
  });

  it('jugada esta semana pero sin analizar', () => {
    const g = game({ analizada: false, fecha: new Date(2026, 6, 21, 10).toISOString() });
    expect(partidaLentaSemanal([g], ahora)).toBe('sin-analizar');
  });

  it('jugada y analizada esta semana = completa', () => {
    const g = game({ analizada: true, fecha: new Date(2026, 6, 21, 10).toISOString() });
    expect(partidaLentaSemanal([g], ahora)).toBe('completa');
  });

  // Borde clásico de `(getDay() + 6) % 7`: el domingo es el ÚLTIMO día de la
  // semana (lunes a domingo), no el primero. Si se calculara mal, el domingo
  // "reiniciaría" la semana y una partida del lunes anterior dejaría de contar.
  it('el domingo sigue perteneciendo a la semana que arrancó el lunes', () => {
    const domingo = new Date(2026, 6, 26, 22); // domingo 26/07, cierre de esa semana
    const delLunes = game({ analizada: true, fecha: new Date(2026, 6, 20, 9).toISOString() });
    expect(partidaLentaSemanal([delLunes], domingo)).toBe('completa');

    // Y el lunes siguiente ya es una semana nueva: esa misma partida no cuenta.
    const lunesSiguiente = new Date(2026, 6, 27, 9);
    expect(partidaLentaSemanal([delLunes], lunesSiguiente)).toBe('sin-jugar');
  });

  it('una partida del mismo lunes a la madrugada entra en la semana en curso', () => {
    const lunes = new Date(2026, 6, 20, 23, 30);
    const madrugada = game({ fecha: new Date(2026, 6, 20, 0, 5).toISOString() });
    expect(partidaLentaSemanal([madrugada], lunes)).toBe('sin-analizar');
  });

  // El diagnóstico (RF-11.4) juega dos partidas sin reloj con el mismo motor
  // de partidas que la pantalla Jugar. Sin marcarlas, el compromiso semanal se
  // daba por cumplido apenas terminaba el diagnóstico: Hoy anunciaba la
  // partida lenta de la semana como jugada —o como jugada y analizada, si el
  // usuario analizaba una desde el Panel— sin que hubiera jugado ninguna.
  describe('las partidas del diagnóstico no ocupan el compromiso', () => {
    const delDiagnostico = () =>
      game({ contexto: 'diagnostico', ritmo: 'sin-reloj', fecha: new Date(2026, 6, 21, 10).toISOString() });

    it('terminar el diagnóstico deja la semana sin jugar', () => {
      expect(partidaLentaSemanal([delDiagnostico(), delDiagnostico()], ahora)).toBe('sin-jugar');
    });

    it('analizar una partida del diagnóstico tampoco la da por cumplida', () => {
      const analizada = { ...delDiagnostico(), analizada: true };
      expect(partidaLentaSemanal([analizada, delDiagnostico()], ahora)).toBe('sin-jugar');
    });

    it('una partida propia de la misma semana sí cuenta, con el diagnóstico presente', () => {
      const propia = game({ fecha: new Date(2026, 6, 22, 9).toISOString() });
      expect(partidaLentaSemanal([delDiagnostico(), propia], ahora)).toBe('sin-analizar');
      expect(partidaLentaSemanal([delDiagnostico(), { ...propia, analizada: true }], ahora)).toBe('completa');
    });
  });
});

// Rendirse en la jugada 4 guarda una derrota real —y con razón—, pero no es
// "tu partida lenta de la semana". Sin este piso, entrar a probar el motor y
// arrepentirse daba el compromiso por cumplido.
describe('una partida demasiado corta no cumple el compromiso', () => {
  const ahora = new Date(2026, 6, 22, 20);

  it('una rendición temprana no cuenta', () => {
    const abandonada = game({ pgn: '1. e4 e5 2. Nf3 Nc6 0-1', fecha: new Date(2026, 6, 21, 10).toISOString() });
    expect(partidaLentaSemanal([abandonada], ahora)).toBe('sin-jugar');
  });

  it('pero una partida de largo normal sí', () => {
    const completa = game({ fecha: new Date(2026, 6, 21, 10).toISOString() });
    expect(partidaLentaSemanal([completa], ahora)).toBe('sin-analizar');
  });
});
