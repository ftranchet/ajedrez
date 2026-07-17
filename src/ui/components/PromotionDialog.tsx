// Selector de promoción (RF-1.1). Overlay sobre el tablero.
import type { Color } from '../../core/types';
import { pieceUrl } from '../styles/pieceTheme';
import { t } from '../i18n/es';

interface Props {
  color: Color;
  onPick: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

const PIECES: Array<{ code: 'q' | 'r' | 'b' | 'n'; file: string }> = [
  { code: 'q', file: 'Q' },
  { code: 'r', file: 'R' },
  { code: 'b', file: 'B' },
  { code: 'n', file: 'N' },
];

export function PromotionDialog({ color, onPick, onCancel }: Props) {
  return (
    <div
      role="dialog"
      aria-label={t.jugar.promocion}
      className="absolute inset-0 z-10 flex items-center justify-center bg-base/70"
      onClick={onCancel}
    >
      <div
        className="flex gap-2 rounded-lg border border-subtle bg-elevated p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {PIECES.map((p) => (
          <button
            key={p.code}
            aria-label={p.code}
            onClick={() => onPick(p.code)}
            className="h-16 w-16 min-h-11 min-w-11 rounded-md bg-surface bg-[length:90%] bg-center bg-no-repeat hover:bg-elevated"
            style={{ backgroundImage: `url(${pieceUrl(color, p.file)})` }}
          />
        ))}
      </div>
    </div>
  );
}
