import { describe, expect, it } from 'vitest';
import { analizarSolucion, explicarPosicion, formatearLinea, lineaParaMostrar, motivosConNombre } from './radarExplicacion';
import { seedRadarItems } from '../services/puzzles/seedData';
import type { RadarItem } from './types';

function item(over: Partial<RadarItem>): RadarItem {
  return {
    id: 'x',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    tipo: 'ofensiva',
    temas: [],
    rating: 1500,
    solucion: ['e2e4'],
    fuente: 'seed-dev',
    ...over,
  };
}

describe('analizarSolucion', () => {
  it('reproduce la línea entera en SAN, no solo la primera jugada', () => {
    // Mate del pastor: 4 plies desde la posición inicial.
    const analisis = analizarSolucion(
      item({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', solucion: ['e2e4', 'e7e5', 'd1h5', 'b8c6'] }),
    );
    expect(analisis.lineaSan).toEqual(['e4', 'e5', 'Qh5', 'Nc6']);
  });

  it('cuenta el mate y en cuántas jugadas del que resuelve', () => {
    const analisis = analizarSolucion(
      item({ fen: 'rnbqkbnr/pppp1ppp/8/4p3/5PP1/8/PPPPP2P/RNBQKBNR b KQkq - 0 2', solucion: ['d8h4'] }),
    );
    expect(analisis.mateEn).toBe(1);
  });

  it('el mate cuenta las jugadas del solucionador, no los plies', () => {
    // Mate del pastor completo: 7 plies, mate en la 4.a jugada de las blancas.
    const analisis = analizarSolucion(
      item({ solucion: ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'] }),
    );
    expect(analisis.lineaSan.at(-1)).toBe('Qxf7#');
    expect(analisis.mateEn).toBe(4);
  });

  it('separa lo que la línea gana de cómo termina el tablero', () => {
    // Las negras empiezan 6 abajo (caballo contra dama), se llevan la dama
    // (+9) y las blancas recapturan el caballo (−3): la línea gana 6 y el
    // tablero termina igualado. Son dos números distintos y confundirlos es
    // exactamente el bug que este test protege.
    const analisis = analizarSolucion(
      item({ fen: '4k3/8/8/8/8/5n2/3Q4/4K3 b - - 0 1', solucion: ['f3d2', 'e1d2'] }),
    );
    expect(analisis.lineaSan).toEqual(['Nxd2', 'Kxd2']);
    expect(analisis.materialGanado).toBe(6);
    expect(analisis.balanceFinal).toBe(0);
  });

  it('el balance final cuenta el material del tablero, no el de la línea', () => {
    // lichess-00Cqg, del lote publicado: las blancas empiezan 8 abajo y la
    // línea recupera 6. El texto llegó a afirmar "quedás 6 peones arriba"
    // sobre una posición en la que se termina 2 abajo.
    const posicion = seedRadarItems.find((p) => p.id === 'lichess-00Cqg');
    expect(posicion, 'lichess-00Cqg debe seguir en el lote').toBeDefined();
    const analisis = analizarSolucion(posicion!);
    expect(analisis.materialGanado).toBe(6);
    expect(analisis.balanceFinal).toBe(-2);
  });

  it('respeta la pieza de promoción: c1=D y c1=C no son la misma jugada', () => {
    // El lote publicado tiene este caso (lichess-004LZ): con c1=C la línea da
    // jaque y el resto se vuelve ilegal; con c1=D sigue.
    const conDama = analizarSolucion(item({ fen: '4k3/8/8/8/8/7K/2p5/8 b - - 0 1', solucion: ['c2c1q'] }));
    const conCaballo = analizarSolucion(item({ fen: '4k3/8/8/8/8/7K/2p5/8 b - - 0 1', solucion: ['c2c1n'] }));
    expect(conDama.lineaSan).toEqual(['c1=Q']);
    expect(conCaballo.lineaSan).toEqual(['c1=N']);
  });

  it('una línea con jugada ilegal corta en vez de romper el feedback', () => {
    const analisis = analizarSolucion(item({ solucion: ['e2e4', 'h1h8'] }));
    expect(analisis.lineaSan).toEqual(['e4']);
  });
});

describe('formatearLinea', () => {
  it('numera desde la jugada real de la posición', () => {
    expect(formatearLinea('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', ['Qxf7#'])).toBe('4.Qxf7#');
  });

  it('cuando mueven las negras, arranca con puntos suspensivos y avanza el número', () => {
    expect(formatearLinea('8/8/8/8/8/8/8/8 b - - 0 27', ['Rxd8', 'Qxd8', 'Bxd8'])).toBe('27...Rxd8 28.Qxd8 Bxd8');
  });

  it('una línea vacía no imprime nada', () => {
    expect(formatearLinea('8/8/8/8/8/8/8/8 w - - 0 1', [])).toBe('');
  });
});

describe('motivosConNombre', () => {
  it('traduce los temas que describen un mecanismo', () => {
    expect(motivosConNombre(item({ temas: ['fork', 'pin'] }))).toEqual(['horquilla', 'clavada']);
  });

  it('descarta los temas que no dicen nada que el usuario no vea', () => {
    // "crushing", "short", "middlegame" describen el puzzle, no la táctica.
    expect(motivosConNombre(item({ temas: ['crushing', 'short', 'middlegame', 'advantage'] }))).toEqual([]);
  });
});

describe('motivosConNombre', () => {
  it('pone primero lo más específico', () => {
    expect(motivosConNombre(item({ temas: ['hangingPiece', 'bodenMate', 'fork'] }))).toEqual([
      'mate de Boden',
      'horquilla',
      'pieza colgada',
    ]);
  });

  it('no repite lo que el tipo ya dice', () => {
    // "El mecanismo: recurso defensivo" en una posición de defensa es ruido.
    expect(motivosConNombre(item({ tipo: 'defensa', temas: ['defensiveMove', 'skewer'] }))).toEqual(['enfilada']);
    expect(motivosConNombre(item({ tipo: 'genuina', temas: ['hangingPiece'] }))).toEqual([]);
  });
});

describe('explicarPosicion', () => {
  it('nombra el mate concreto en vez de "había una combinación ganadora"', () => {
    const texto = explicarPosicion(
      item({ fen: 'rnbqkbnr/pppp1ppp/8/4p3/5PP1/8/PPPPP2P/RNBQKBNR b KQkq - 0 2', solucion: ['d8h4'] }),
      false,
    );
    expect(texto).toContain('mate en una');
  });

  it('dice cuánto material queda al final de la línea', () => {
    // Negras (caballo contra dama, 6 abajo) se llevan la dama y nadie
    // recaptura: la línea gana 9 y el tablero termina 3 arriba. Las dos cifras
    // se dicen, cada una con su verbo.
    const texto = explicarPosicion(item({ fen: '4k3/8/8/8/8/8/1n6/3Q1K2 b - - 0 1', solucion: ['b2d1'] }), false);
    expect(texto).toContain('gana una dama');
    expect(texto).toContain('una pieza arriba');
    expect(texto).not.toContain('una dama arriba');
  });

  it('nunca afirma "arriba" sobre una línea que termina abajo en material', () => {
    // Las negras recuperan 6 peones pero terminan 1 abajo: se cuenta lo
    // recuperado y no se afirma ninguna ventaja que el tablero no muestre.
    const texto = explicarPosicion(
      item({ fen: '4k3/8/8/8/8/5n2/3Q1P2/4K3 b - - 0 1', solucion: ['f3d2', 'e1d2', 'e8e7', 'd2d3'] }),
      false,
    );
    expect(texto).toContain('recupera 6 peones');
    expect(texto).not.toContain('arriba');
  });

  it('solo nombra la pieza cuando el número es exactamente el suyo', () => {
    // 4 peones netos no son "una pieza": ahí gana el número.
    const cuatro = explicarPosicion(
      item({ fen: '4k3/8/8/8/8/5n2/3QP3/4K3 b - - 0 1', solucion: ['f3d2', 'e1d2'] }),
      false,
    );
    expect(cuatro).toContain('6 peones');
    expect(cuatro).not.toContain('una pieza');
  });

  // Esta es la regla que más protege al usuario: 8 posiciones del lote
  // publicado terminan su línea con el solucionador ABAJO en material, porque
  // la línea se corta cuando la ventaja ya es clara y la compensación llega
  // después. Contar el material ahí sería cierto del tablero y falso del juego.
  it('no dice nada de material cuando la línea termina en sacrificio', () => {
    // La dama se entrega y la línea corta antes del cobro: el tablero muestra
    // −9 y el texto no puede decir "perdés una dama".
    const texto = explicarPosicion(
      item({ fen: '4k3/8/8/8/8/5n2/8/3Q1K2 w - - 0 1', solucion: ['d1d8', 'e8d8'], temas: ['fork'] }),
      false,
    );
    expect(texto).not.toContain('peones netos');
    expect(texto).not.toContain('arriba');
    // Y sigue diciendo algo útil: el mecanismo verificado de la posición.
    expect(texto).toContain('horquilla');
  });

  it('no lista todas las jugadas equivalentes: enumera unas pocas y resume', () => {
    // El lote publicado tiene una tranquila con 23 equivalentes verificadas;
    // enumerarlas convertía el feedback en una pared de notación.
    const conMuchas = seedRadarItems.find((posicion) => (posicion.jugadasAceptables?.length ?? 0) > 10);
    expect(conMuchas, 'el lote ya no tiene una tranquila con muchas equivalentes').toBeDefined();
    const texto = explicarPosicion(conMuchas!, true);
    expect(texto).toContain('y otras');
    expect(texto.length).toBeLessThan(400);
  });

  it('un FEN inválido degrada al texto genérico en vez de romper la sesión', () => {
    const texto = explicarPosicion(item({ fen: 'esto no es un fen', tipo: 'genuina' }), false);
    expect(texto).toContain('La oferta era genuina');
  });

  // Una solución ilegal desde su FEN no debería existir (hay un test que lo
  // recorre sobre el lote publicado), pero si un lote futuro la trajera, el
  // usuario no puede leer "El motor prefiere undefined" a mitad de sesión.
  it('una solución ilegal no imprime "undefined" en la cara del usuario', () => {
    const tranquila = explicarPosicion(
      item({
        tipo: 'tranquila',
        fen: 'rn2kb1r/pbpp1p1p/1p2p1q1/7p/3PP1B1/P1N2N2/1PP2PPP/R2QK2R w KQkq - 2 9',
        solucion: ['a1a8'], // ilegal en esta posición
        jugadasAceptables: ['g4h3'],
      }),
      false,
    );
    expect(tranquila).not.toContain('undefined');

    const doble = explicarPosicion(
      item({
        fen: 'rn2kb1r/pbpp1p1p/1p2p1q1/7p/3PP1B1/P1N2N2/1PP2PPP/R2QK2R w KQkq - 2 9',
        solucion: ['a1a8'],
        dobleSolucion: { familiar: 'f3e5' },
      }),
      true,
    );
    expect(doble).not.toContain('undefined');
  });

  it('en una tranquila aclara que la jugada equivalente también valía', () => {
    const texto = explicarPosicion(
      item({
        tipo: 'tranquila',
        fen: 'rn2kb1r/pbpp1p1p/1p2p1q1/7p/3PP1B1/P1N2N2/1PP2PPP/R2QK2R w KQkq - 2 9',
        solucion: ['f3e5'],
        jugadasAceptables: ['g4h3'],
      }),
      true,
    );
    expect(texto).toContain('Bh3');
    expect(texto).toContain('también valía');
  });

  it('en una envenenada nombra la captura carnada y su refutación', () => {
    const texto = explicarPosicion(
      item({
        tipo: 'envenenada',
        fen: '2b2rk1/1rp2pp1/2pb4/3ppqBp/QP4n1/2PP1PP1/P3P1BP/RN2K2R w KQ - 1 14',
        solucion: ['g5d2'],
        carnada: { san: 'Qxc6', ganaPeones: 1, refutacionSan: ['Qxg5', 'fxg4'], costoCp: 189, profundidad: 17 },
      }),
      false,
    );
    expect(texto).toContain('Qxc6');
    expect(texto).toContain('Qxg5 fxg4');
    expect(texto).toContain('declinar');
  });

  it('una carnada que tira un mate no se describe como pérdida de material', () => {
    const texto = explicarPosicion(
      item({
        tipo: 'envenenada',
        fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
        solucion: ['d1d8'],
        carnada: { san: 'Rxd8', ganaPeones: 5, refutacionSan: [], costoCp: 100_000, profundidad: 17 },
      }),
      false,
    );
    expect(texto).toContain('tira el mate');
  });

  it('sin carnada marcada cae al texto genérico en vez de inventar una', () => {
    const texto = explicarPosicion(item({ tipo: 'envenenada', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solucion: ['d1d4'] }), false);
    expect(texto).toContain('declinar');
    expect(texto).not.toContain('parece ganar');
  });

  it('avisa cuando la jugada familiar de una doble solución también ganaba', () => {
    const texto = explicarPosicion(
      item({
        fen: '2r1k2r/1q2bp1p/2p2np1/p1Pp1N2/8/4BQ2/PPP2PPP/R3K2R w KQk - 0 16',
        solucion: ['f5d6'],
        dobleSolucion: { familiar: 'f5e7' },
      }),
      true,
    );
    expect(texto).toContain('Nxe7');
    expect(texto).toContain('objetivamente mejor');
  });
});

// El punto de toda la ronda C: el catálogo real dejó de compartir cinco
// frases. Estas comprobaciones corren sobre el lote publicado, no sobre
// fixtures, para que una regeneración del dataset que rompa la explicación
// falle acá y no en la app.
describe('el lote publicado explica cada posición (RF-5.3)', () => {
  const TIEMPO = 30_000; // recorrer 116 posiciones reproduciendo sus líneas
  it('ninguna posición se queda sin texto', () => {
    for (const posicion of seedRadarItems) {
      // El piso es una frase corta pero completa ("Es mate en una."): lo que
      // no puede pasar es que una posición quede sin explicación.
      expect(explicarPosicion(posicion, false).length, posicion.id).toBeGreaterThan(12);
      expect(explicarPosicion(posicion, true).length, posicion.id).toBeGreaterThan(12);
    }
  }, TIEMPO);

  it('toda solución del catálogo es legal desde su FEN', () => {
    for (const posicion of seedRadarItems) {
      const analisis = analizarSolucion(posicion);
      expect(analisis.lineaSan.length).toBe(posicion.solucion.length);
    }
  }, TIEMPO);

  it('la mayoría de las posiciones ya no comparte texto con otra', () => {
    const textos = seedRadarItems.map((posicion) => explicarPosicion(posicion, false));
    const distintos = new Set(textos).size;
    // Antes de la ronda C esto valía exactamente 5 —una frase por tipo—. No se
    // exige 116: dos mates en 2 sin motivo con nombre pueden coincidir, y
    // forzar textos únicos empujaría a inventar diferencias que no existen.
    expect(distintos).toBeGreaterThan(seedRadarItems.length * 0.5);
  }, TIEMPO);

  it('cada envenenada del lote tiene su carnada marcada por el motor', () => {
    const envenenadas = seedRadarItems.filter((posicion) => posicion.tipo === 'envenenada');
    expect(envenenadas.length).toBeGreaterThan(0);
    for (const posicion of envenenadas) {
      expect(posicion.carnada, `${posicion.id} sin carnada`).toBeDefined();
      // La carnada tiene que ser una jugada legal de la posición.
      expect(explicarPosicion(posicion, false)).toContain(posicion.carnada!.san);
    }
  }, TIEMPO);

  it('la línea que ve el usuario muestra más que la primera jugada cuando la hay', () => {
    const largas = seedRadarItems.filter((posicion) => posicion.solucion.length > 1);
    expect(largas.length).toBeGreaterThan(50);
    for (const posicion of largas) {
      expect(lineaParaMostrar(posicion).split(' ').length).toBeGreaterThan(1);
    }
  }, TIEMPO);
});
