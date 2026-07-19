// Importación manual de PGN (RF-2.2): vía alternativa que no depende de
// Lichess/Chess.com, único subtipo de E2 que no requiere red (ADR pendiente
// para RF-2.1/2.3: import por API, bloqueado en este entorno sin acceso a
// lichess.org/api.chess.com).
import { Chess } from 'chess.js';
import type { Resultado } from './types';

export type PgnParseError = 'vacio' | 'invalido' | 'sin-jugadas';

export type PgnParseResult = {
  ok: true;
  pgn: string;
  resultado: Resultado;
  plyCount: number;
  whiteElo?: number;
  blackElo?: number;
  playedAt?: string;
} | { ok: false; error: PgnParseError };

function normalizeResultado(raw: string | undefined): Resultado {
  return raw === '1-0' || raw === '0-1' || raw === '1/2-1/2' ? raw : '*';
}

function parseElo(raw: string | undefined): number | undefined {
  if (!raw || !/^\d{3,4}$/.test(raw)) return undefined;
  const value = Number(raw);
  return value >= 100 && value <= 4000 ? value : undefined;
}

/** Fecha PGN `YYYY.MM.DD`; los signos `?` indican que no es utilizable. */
function parsePlayedAt(raw: string | undefined): string | undefined {
  const match = raw?.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  // Evita que Date normalice silenciosamente fechas imposibles como 31/02.
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return undefined;
  return date.toISOString();
}

export function parsePastedPgn(raw: string): PgnParseResult {
  const pgn = raw.trim();
  if (!pgn) return { ok: false, error: 'vacio' };

  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    return { ok: false, error: 'invalido' };
  }

  const plyCount = chess.history().length;
  if (plyCount === 0) return { ok: false, error: 'sin-jugadas' };

  const headers = chess.getHeaders();
  const whiteElo = parseElo(headers.WhiteElo);
  const blackElo = parseElo(headers.BlackElo);
  const playedAt = parsePlayedAt(headers.Date);
  return {
    ok: true,
    pgn,
    resultado: normalizeResultado(headers.Result),
    plyCount,
    ...(whiteElo !== undefined ? { whiteElo } : {}),
    ...(blackElo !== undefined ? { blackElo } : {}),
    ...(playedAt !== undefined ? { playedAt } : {}),
  };
}
