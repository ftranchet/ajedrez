import { describe, expect, it } from 'vitest';
import { assessQuietAnalysis, quietCandidatesFromPgn } from './quietPositions.mjs';

const pgn = `[Event "Fixture"]
[Site "https://lichess.org/fixture"]
[WhiteElo "1200"]
[BlackElo "1400"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 *`;

describe('pipeline de posiciones tranquilas', () => {
  it('extrae posiciones reproducibles de una partida PGN real', () => {
    const candidates = quietCandidatesFromPgn(pgn, { minPly: 6, plyStep: 4 });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.rating).toBe(1300);
    expect(candidates[0]?.fen).toContain(' ');
  });

  it('acepta solo una posición equilibrada sin golpe táctico único', () => {
    const result = assessQuietAnalysis(
      {
        rankedMoves: [
          { move: 'b1c3', score: 18 },
          { move: 'g1f3', score: 4 },
        ],
        bestMove: { san: 'Nc3' },
      },
      { maxAbsoluteCp: 120, maxBestMoveGapCp: 70 },
    );
    expect(result.accepted).toBe(true);
  });

  it('rechaza una posición con un golpe único, incluso si está equilibrada', () => {
    const result = assessQuietAnalysis(
      {
        rankedMoves: [
          { move: 'd1h5', score: 30 },
          { move: 'g1f3', score: -60 },
        ],
        bestMove: { san: 'Qh5+' },
      },
      { maxAbsoluteCp: 120, maxBestMoveGapCp: 70 },
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('golpe único');
  });

  it('rechaza una mejor jugada que captura o da jaque', () => {
    const result = assessQuietAnalysis(
      {
        rankedMoves: [
          { move: 'c4f7', score: 25 },
          { move: 'g1f3', score: 10 },
        ],
        bestMove: { san: 'Bxf7+' },
      },
      { maxAbsoluteCp: 120, maxBestMoveGapCp: 70 },
    );
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('táctica');
  });
});
