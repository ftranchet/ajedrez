import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { seedRadarItems } from './seedData';
import { seedCurriculumItems } from './curriculumSeedData';
import { seedStoykoItems } from './stoykoSeedData';
import { seedTransferItems, TRANSFER_DATASET_VERSION } from './transferSeedData';

describe('catálogo reservado de transferencia', () => {
  it('tiene exactamente 30 posiciones únicas y una versión trazable', () => {
    expect(seedTransferItems).toHaveLength(30);
    expect(new Set(seedTransferItems.map((item) => item.id)).size).toBe(30);
    expect(new Set(seedTransferItems.map((item) => item.fen)).size).toBe(30);
    expect(TRANSFER_DATASET_VERSION).toMatch(/^transfer-[a-f0-9]{12}$/);
  });

  it('cada solución es legal desde su FEN y fue reconfirmada a profundidad 17', () => {
    for (const item of seedTransferItems) {
      const chess = new Chess(item.fen);
      const legal = chess.moves({ verbose: true }).map((move) => move.from + move.to + (move.promotion ?? ''));
      expect(item.acceptedMoves.length).toBeGreaterThan(0);
      expect(item.verificationDepth).toBe(17);
      for (const move of item.acceptedMoves) expect(legal).toContain(move);
    }
  });

  it('balancea lado a mover y tres tramos distintos de la partida', () => {
    expect(seedTransferItems.filter((item) => item.fen.split(' ')[1] === 'w')).toHaveLength(15);
    expect(seedTransferItems.filter((item) => item.fen.split(' ')[1] === 'b')).toHaveLength(15);
    const fullmoves = seedTransferItems.map((item) => Number(item.fen.split(' ')[5]));
    expect(fullmoves.filter((move) => move <= 12)).toHaveLength(10);
    expect(fullmoves.filter((move) => move >= 13 && move <= 18)).toHaveLength(10);
    expect(fullmoves.filter((move) => move > 18)).toHaveLength(10);
  });

  it('no comparte ninguna posición con los catálogos de entrenamiento', () => {
    const trainingFens = new Set([
      ...seedRadarItems.map((item) => item.fen),
      ...seedCurriculumItems.map((item) => item.fen),
      ...seedStoykoItems.map((item) => item.fen),
    ]);
    for (const item of seedTransferItems) expect(trainingFens.has(item.fen)).toBe(false);
  });
});
