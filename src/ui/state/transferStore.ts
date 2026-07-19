// Flujo de RF-12.2. La batería no da feedback por posición y no crea tarjetas:
// hacerlo convertiría el instrumento reservado en entrenamiento.
import { create } from 'zustand';
import { Chess, type Square } from 'chess.js';
import type { Color, TransferItem, TransferMeasurement } from '../../core/types';
import {
  addTransferResponse,
  startTransferMeasurement,
  transferAvailability,
} from '../../core/transfer';
import { seedTransferItems, TRANSFER_DATASET_VERSION } from '../../services/puzzles/transferSeedData';
import { transferMeasurementRepo } from '../../services/storage/transferMeasurementRepo';
import { computeDests } from './chessBoardUtils';

type Phase = 'inactivo' | 'jugando' | 'resultado';

interface TransferState {
  phase: Phase;
  measurement: TransferMeasurement | null;
  item: TransferItem | null;
  itemIndex: number;
  fen: string;
  turn: Color;
  orientation: Color;
  dests: Map<string, string[]>;
  check: boolean;
  saving: boolean;
  startedItemAt: number;
  error: string | null;
  start(): Promise<void>;
  userMove(from: Square, to: Square, promotion?: string): Promise<void>;
  close(): void;
}

let chess = new Chess();

function boardSnapshot() {
  return {
    fen: chess.fen(),
    turn: chess.turn() as Color,
    dests: computeDests(chess),
    check: chess.inCheck(),
  };
}

function loadItem(index: number) {
  const item = seedTransferItems[index] ?? null;
  if (!item) return { item: null };
  chess = new Chess(item.fen);
  const turn = chess.turn() as Color;
  return { item, itemIndex: index, orientation: turn, ...boardSnapshot(), startedItemAt: Date.now() };
}

export const useTransferStore = create<TransferState>((set, get) => ({
  phase: 'inactivo',
  measurement: null,
  item: null,
  itemIndex: 0,
  fen: chess.fen(),
  turn: 'w',
  orientation: 'w',
  dests: new Map(),
  check: false,
  saving: false,
  startedItemAt: 0,
  error: null,

  async start() {
    // React StrictMode ejecuta el efecto de montaje dos veces en desarrollo.
    // El guard sincrónico evita crear dos tomas incompletas antes del primer
    // await a IndexedDB.
    if (get().phase !== 'inactivo' || get().saving) return;
    set({ saving: true });
    try {
      const measurements = await transferMeasurementRepo.list();
      const availability = transferAvailability(measurements, new Date(), TRANSFER_DATASET_VERSION);
      if (availability.status === 'scheduled') {
        set({ error: 'La próxima toma todavía no está disponible.', saving: false });
        return;
      }
      let measurement =
        availability.status === 'in-progress' ? availability.measurement : startTransferMeasurement(TRANSFER_DATASET_VERSION);
      if (availability.status === 'available') await transferMeasurementRepo.save(measurement);
      const index = measurement.responses.length;
      if (index >= seedTransferItems.length) {
        measurement = { ...measurement, completedAt: measurement.completedAt ?? new Date().toISOString() };
        await transferMeasurementRepo.save(measurement);
        set({ phase: 'resultado', measurement, item: null, saving: false });
        return;
      }
      set({ phase: 'jugando', measurement, error: null, saving: false, ...loadItem(index) });
    } catch {
      set({ error: 'No se pudo abrir la medición.', saving: false });
    }
  },

  async userMove(from, to, promotion) {
    const state = get();
    if (state.phase !== 'jugando' || state.saving || !state.item || !state.measurement) return;
    const legal = chess.moves({ verbose: true }).find((move) => move.from === from && move.to === to);
    if (!legal) {
      set(boardSnapshot());
      return;
    }
    const promo = promotion ?? (legal.promotion ? 'q' : undefined);
    const uci = from + to + (promo ?? '');
    const now = new Date();
    const response = {
      itemId: state.item.id,
      move: uci,
      correct: state.item.acceptedMoves.includes(uci),
      tiempoMs: Math.max(0, Date.now() - state.startedItemAt),
      fecha: now.toISOString(),
    };
    const measurement = addTransferResponse(state.measurement, response, seedTransferItems.length, now);
    set({ saving: true });
    try {
      await transferMeasurementRepo.save(measurement);
      if (measurement.completedAt) {
        set({ phase: 'resultado', measurement, item: null, saving: false });
        return;
      }
      set({ measurement, saving: false, ...loadItem(measurement.responses.length) });
    } catch {
      set({ saving: false, error: 'No se pudo guardar la respuesta. Probá de nuevo.' });
    }
  },

  close() {
    chess = new Chess();
    set({ phase: 'inactivo', measurement: null, item: null, error: null, saving: false });
  },
}));
