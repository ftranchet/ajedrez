import { describe, expect, it } from 'vitest';
import {
  classifyPuzzleThemes,
  datasetVersion,
  interleaveByType,
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
