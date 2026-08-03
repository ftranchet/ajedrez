import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { estructuraDeFinal, finalesDeTusPartidas } from './finalesEnPartidas';
import type { GameRecord } from './types';

function game(over: Partial<GameRecord> & { id: string; pgn: string }): GameRecord {
  return {
    fuente: 'local',
    ritmo: 'sin-reloj',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: false,
    fecha: '2026-08-01T10:00:00.000Z',
    ...over,
  };
}

describe('estructuraDeFinal', () => {
  it('reconoce las estructuras que el catálogo sabe entrenar', () => {
    expect(estructuraDeFinal(new Chess('8/4k3/8/4K3/4P3/8/8/8 w - - 0 1'))).toBe('rey-peon');
    expect(estructuraDeFinal(new Chess('8/8/4k3/6KP/8/8/8/8 w - - 0 1'))).toBe('peon-de-torre');
    expect(estructuraDeFinal(new Chess('8/8/8/4k3/8/8/8/4K2R w - - 0 1'))).toBe('torre-contra-rey');
    expect(estructuraDeFinal(new Chess('8/8/8/4k3/8/8/8/3QK3 w - - 0 1'))).toBe('dama-contra-rey');
    expect(estructuraDeFinal(new Chess('2K5/k1P5/8/8/8/8/5r2/3R4 w - - 0 1'))).toBe('torres-con-peon');
  });

  it('el peón de torre no se confunde con un rey y peón cualquiera', () => {
    // Su técnica es la excepción —el rey defensor se salva en la esquina—, así
    // que mezclarlos recomendaría la posición equivocada.
    expect(estructuraDeFinal(new Chess('8/8/4k3/6KP/8/8/8/8 w - - 0 1'))).toBe('peon-de-torre');
    expect(estructuraDeFinal(new Chess('8/8/4k3/6KP/8/8/8/8 w - - 0 1'))).not.toBe('rey-peon');
  });

  it('no fuerza una posición con más material dentro del final más parecido', () => {
    expect(estructuraDeFinal(new Chess())).toBeNull();
    // Torre y dos peones contra torre: no es la familia Lucena/Philidor.
    expect(estructuraDeFinal(new Chess('8/2k5/2P5/2P5/8/8/5r2/3RK3 w - - 0 1'))).toBeNull();
  });
});

describe('finalesDeTusPartidas', () => {
  it('cuenta las partidas que llegaron a cada final del catálogo', () => {
    // Mate del pastor: nunca llega a un final. Sirve de control negativo.
    const sinFinal = game({ id: 'g1', pgn: '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0' });
    // Una partida que termina en rey y peón contra rey.
    const conFinal = game({
      id: 'g2',
      pgn: '[SetUp "1"]\n[FEN "8/4k3/8/4K3/4P3/8/8/8 b - - 0 1"]\n\n1... Kd7 2. Kd5 Ke7 *',
    });
    const conteo = finalesDeTusPartidas([sinFinal, conFinal]);
    expect(conteo.get('final-rey-peon')).toBe(1);
    // La regla del cuadrado se entrena con la misma estructura.
    expect(conteo.get('final-cuadrado')).toBe(1);
    expect(conteo.get('final-torre')).toBeUndefined();
  });

  it('una partida larga en un final cuenta una vez, no una por jugada', () => {
    // Sin esto, una partida de veinte jugadas en un final de torres valdría
    // veinte y aplastaría cualquier otra señal.
    const larga = game({
      id: 'g3',
      pgn: '[SetUp "1"]\n[FEN "8/8/8/4k3/8/8/8/4K2R w - - 0 1"]\n\n1. Rh5+ Kd6 2. Rh6+ Ke5 3. Rh5+ Kd6 4. Rh6+ Ke5 *',
    });
    expect(finalesDeTusPartidas([larga]).get('final-torre')).toBe(1);
  });

  it('un PGN ilegible no invalida el resto del historial', () => {
    const roto = game({ id: 'g4', pgn: 'esto no es un pgn' });
    const bueno = game({
      id: 'g5',
      pgn: '[SetUp "1"]\n[FEN "8/8/8/4k3/8/8/8/3QK3 w - - 0 1"]\n\n1. Qd5+ Kf6 *',
    });
    expect(finalesDeTusPartidas([roto, bueno]).get('final-dama')).toBe(1);
  });

  it('no cuenta partidas futuras', () => {
    const futura = game({
      id: 'g6',
      fecha: '2027-01-01T00:00:00.000Z',
      pgn: '[SetUp "1"]\n[FEN "8/8/8/4k3/8/8/8/3QK3 w - - 0 1"]\n\n1. Qd5+ Kf6 *',
    });
    expect(finalesDeTusPartidas([futura], new Date('2026-08-04T00:00:00.000Z')).size).toBe(0);
  });
});
