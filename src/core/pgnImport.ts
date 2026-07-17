// Importación manual de PGN (RF-2.2): vía alternativa que no depende de
// Lichess/Chess.com, único subtipo de E2 que no requiere red (ADR pendiente
// para RF-2.1/2.3: import por API, bloqueado en este entorno sin acceso a
// lichess.org/api.chess.com).
import { Chess } from 'chess.js';
import type { Resultado } from './types';

export type PgnParseError = 'vacio' | 'invalido' | 'sin-jugadas';

export type PgnParseResult = { ok: true; pgn: string; resultado: Resultado; plyCount: number } | { ok: false; error: PgnParseError };

function normalizeResultado(raw: string | undefined): Resultado {
  return raw === '1-0' || raw === '0-1' || raw === '1/2-1/2' ? raw : '*';
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

  return { ok: true, pgn, resultado: normalizeResultado(chess.getHeaders().Result), plyCount };
}
