// Extracción y verificación de posiciones tranquilas desde partidas reales
// (RF-5.6). La decisión final usa Stockfish por MultiPV: no se confunde una
// posición equilibrada con una que contiene un único golpe táctico.
import { createHash } from 'node:crypto';
import { Chess } from 'chess.js';

export const DEFAULT_QUIET_CONFIG = {
  minPly: 16,
  plyStep: 8,
  maxAbsoluteCp: 120,
  maxBestMoveGapCp: 70,
  verificationDepth: 14,
};

function parseRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 800 && rating <= 3000 ? rating : null;
}

function ratingFromHeaders(headers) {
  const white = parseRating(headers.WhiteElo);
  const black = parseRating(headers.BlackElo);
  if (white !== null && black !== null) return Math.round((white + black) / 2);
  return white ?? black ?? 1200;
}

function clampRadarRating(rating) {
  return Math.max(800, Math.min(2000, rating));
}

/** Extrae FENs candidatos de una partida PGN sin hacer aún análisis de motor. */
export function quietCandidatesFromPgn(pgn, config = DEFAULT_QUIET_CONFIG) {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return [];
  }
  const headers = chess.getHeaders();
  const rating = clampRadarRating(ratingFromHeaders(headers));
  const gameId = headers.Site ?? headers.Event ?? createHash('sha256').update(pgn).digest('hex').slice(0, 12);
  const history = chess.history({ verbose: true });
  const candidates = [];

  for (let ply = config.minPly; ply < history.length; ply += config.plyStep) {
    const move = history[ply];
    if (!move?.before) continue;
    const position = new Chess(move.before);
    if (position.isGameOver() || position.inCheck()) continue;
    if (position.moves().length < 2) continue;
    candidates.push({ fen: position.fen(), rating, gameId, ply });
  }
  return candidates;
}

/** Decide si el análisis MultiPV cumple la definición conservadora de tranquila. */
export function assessQuietAnalysis(analysis, config = DEFAULT_QUIET_CONFIG) {
  const { rankedMoves, bestMove } = analysis;
  if (!Array.isArray(rankedMoves) || rankedMoves.length < 2 || !bestMove) {
    return { accepted: false, reason: 'El motor no devolvió suficientes variantes.' };
  }
  const [best, second] = rankedMoves;
  if (Math.abs(best.score) > config.maxAbsoluteCp) {
    return { accepted: false, reason: `La posición ya tiene una ventaja de ${best.score}cp.` };
  }
  if (best.score - second.score > config.maxBestMoveGapCp) {
    return { accepted: false, reason: `Hay un golpe único: ${best.score - second.score}cp entre las dos mejores jugadas.` };
  }
  // Una captura, promoción o jaque como jugada óptima es un indicador fuerte
  // de contenido táctico; se descarta aunque la evaluación quede equilibrada.
  if (bestMove.captured || bestMove.promotion || bestMove.san.includes('+') || bestMove.san.includes('#')) {
    return { accepted: false, reason: 'La mejor jugada es táctica (captura, promoción o jaque).' };
  }
  return { accepted: true, reason: 'Posición equilibrada sin golpe táctico único.' };
}

/** Verifica una candidata con todas sus jugadas legales mediante MultiPV. */
export async function verifyQuietCandidate(candidate, engine, config = DEFAULT_QUIET_CONFIG) {
  const chess = new Chess(candidate.fen);
  const legalMoves = chess.moves({ verbose: true });
  const rankedMoves = await engine.analyseMultiPv(candidate.fen, legalMoves.length, config.verificationDepth);
  const best = rankedMoves[0];
  const bestMove = best
    ? legalMoves.find((move) => `${move.from}${move.to}${move.promotion ?? ''}` === best.move)
    : undefined;
  const assessment = assessQuietAnalysis({ rankedMoves, bestMove }, config);
  if (!assessment.accepted || !best) return { accepted: false, reason: assessment.reason };

  const id = `quiet-${createHash('sha256').update(candidate.fen).digest('hex').slice(0, 16)}`;
  return {
    accepted: true,
    item: {
      id,
      fen: candidate.fen,
      tipo: 'tranquila',
      temas: ['partida-real', 'verificada-stockfish'],
      rating: candidate.rating,
      solucion: [best.move],
      fuente: 'pipeline-tranquilas',
    },
  };
}
