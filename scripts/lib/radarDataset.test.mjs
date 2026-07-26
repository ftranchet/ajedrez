import { describe, expect, it } from 'vitest';
import {
  clasificarPorTablero,
  classifyPuzzleThemes,
  datasetVersion,
  interleaveByType,
  netoDeCaptura,
  parseCsvLine,
  puzzleRowToRadarItem,
  validateRadarDataset,
} from './radarDataset.mjs';

const row = [
  'abc123',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'e7e5 g1f3 b8c6',
  '1200',
  '80',
  '75',
  '1000',
  'defensiveMove middlegame',
  'https://lichess.org/example',
  '',
];

describe('pipeline de puzzles de Lichess', () => {
  it('parsea CSV con comillas escapadas', () => {
    expect(parseCsvLine('uno,"dos, tres","cuatro ""literal"""')).toEqual(['uno', 'dos, tres', 'cuatro "literal"']);
  });

  it('aplica la jugada de armado antes de servir el puzzle (formato oficial de Lichess)', () => {
    const item = puzzleRowToRadarItem(row);
    expect(item).toMatchObject({
      id: 'lichess-abc123',
      tipo: 'defensa',
      solucion: ['g1f3', 'b8c6'],
    });
    expect(item?.fen).toContain(' w ');
  });

  it('filtra rating, popularidad y jugadas corruptas', () => {
    expect(puzzleRowToRadarItem([...row.slice(0, 3), '700', ...row.slice(4)])).toBeNull();
    expect(puzzleRowToRadarItem([...row.slice(0, 5), '20', ...row.slice(6)])).toBeNull();
    expect(puzzleRowToRadarItem([...row.slice(0, 2), 'e7e9 g1f3', ...row.slice(3)])).toBeNull();
  });

  it('clasifica las cuatro familias tácticas con reglas auditables', () => {
    expect(classifyPuzzleThemes(['defensiveMove'])).toBe('defensa');
    expect(classifyPuzzleThemes(['hangingPiece'])).toBe('genuina');
    expect(classifyPuzzleThemes(['sacrifice'])).toBe('envenenada');
    expect(classifyPuzzleThemes(['fork'])).toBe('ofensiva');
  });
});

describe('validación del lote del Radar', () => {
  function item(index, tipo) {
    return {
      id: `${tipo}-${index}`,
      fen: `8/8/8/8/8/8/8/${index}K6 w - - 0 1`,
      tipo,
      temas: [],
      rating: 1200,
      solucion: ['a1a2'],
      fuente: tipo === 'tranquila' ? 'pipeline-tranquilas' : 'lichess-cc0',
    };
  }

  it('exige una cuota de cada uno de los cinco tipos', () => {
    const incomplete = ['ofensiva', 'defensa', 'genuina', 'envenenada'].map((tipo, index) => item(index, tipo));
    const result = validateRadarDataset(incomplete, 1);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('tranquila');
  });

  it('intercala tipos y produce una versión estable según el contenido', () => {
    const all = ['ofensiva', 'defensa', 'tranquila', 'genuina', 'envenenada'].map((tipo, index) => item(index, tipo));
    const mixed = interleaveByType(all);
    expect(mixed.map((candidate) => candidate.tipo)).toEqual(['ofensiva', 'defensa', 'tranquila', 'genuina', 'envenenada']);
    expect(datasetVersion(mixed)).toBe(datasetVersion(mixed));
    expect(validateRadarDataset(mixed, 1).ok).toBe(true);
  });
});

// El prefiltro que volvió practicable ingerir el export completo de Lichess.
// La clasificación autoritativa (auditoría 2026-07) parecía exigir el motor en
// cada posición; medido sobre el lote publicado, 1 de 80 lo necesita. Corriendo
// el reclasificador con este prefiltro contra los 80 puzzles reales dio
// **0 cambios** respecto de la versión que buscaba en todos.
describe('clasificarPorTablero', () => {
  const base = {
    id: 'x',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    temas: [],
    rating: 1500,
    solucion: ['e2e4'],
    fuente: 'lichess-cc0',
  };

  it('la etiqueta defensiveMove de Lichess decide sola, sin mirar el tablero', () => {
    expect(clasificarPorTablero({ ...base, temas: ['defensiveMove', 'crushing'] })).toEqual({
      tipo: 'defensa',
      carnadas: [],
    });
  });

  it('una captura que gana material libre es oferta genuina', () => {
    // Cxd1 se lleva la dama y nadie recaptura: +9 neto.
    expect(
      clasificarPorTablero({ ...base, fen: '4k3/8/8/8/8/8/1n6/3Q1K2 b - - 0 1', solucion: ['b2d1'] }).tipo,
    ).toBe('genuina');
  });

  it('capturar un peón suelto no alcanza para "oferta genuina"', () => {
    // Txd2 se lleva un peón (+1) sin recaptura: material real, pero por debajo
    // del umbral de 2 que define "material libre" en la reclasificación.
    expect(
      clasificarPorTablero({ ...base, fen: '4k3/8/8/8/8/8/3p4/3RK3 w - - 0 1', solucion: ['d1d2'] }).tipo,
    ).toBe('ofensiva');
  });

  it('si la solución captura, nunca pide el motor: una envenenada se define por declinar', () => {
    const previa = clasificarPorTablero({ ...base, fen: '4k3/8/8/8/8/8/1n6/3Q1K2 b - - 0 1', solucion: ['b2d1'] });
    expect(previa.tipo).not.toBeNull();
    expect(previa.carnadas).toEqual([]);
  });

  it('sin ninguna captura que aparente ganar material, tampoco pide el motor', () => {
    // Posición inicial: no hay capturas siquiera.
    const previa = clasificarPorTablero(base);
    expect(previa).toEqual({ tipo: 'ofensiva', carnadas: [] });
  });

  it('solo pide el motor cuando la solución declina Y hay carnada aparente', () => {
    // El alfil de a1 puede comerse la torre de h8 y nadie recaptura; la
    // solución declina. Es la única forma en que "envenenada" puede aplicar,
    // y lo que el motor tiene que juzgar es si esa captura es realmente mala.
    const previa = clasificarPorTablero({
      ...base,
      fen: '4k2r/8/8/8/8/8/8/B3K3 w - - 0 1',
      solucion: ['e1e2'],
    });
    expect(previa.tipo).toBeNull();
    expect(previa.carnadas.map((c) => c.uci)).toContain('a1h8');
  });

  it('un FEN corrupto no tira: cae a ofensiva', () => {
    expect(clasificarPorTablero({ ...base, fen: 'no es un fen' })).toEqual({ tipo: 'ofensiva', carnadas: [] });
  });
});

describe('netoDeCaptura', () => {
  it('descuenta la recaptura', () => {
    // Cxd2 se lleva la dama (9) y el rey recaptura el caballo (3): +6.
    expect(netoDeCaptura('4k3/8/8/8/8/5n2/3Q4/4K3 b - - 0 1', 'f3d2')).toBe(6);
  });

  it('sin recaptura, el neto es el material capturado', () => {
    expect(netoDeCaptura('4k3/8/8/8/8/8/1n6/3Q1K2 b - - 0 1', 'b2d1')).toBe(9);
  });

  it('una jugada que no captura devuelve null', () => {
    expect(netoDeCaptura('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4')).toBeNull();
  });
});
