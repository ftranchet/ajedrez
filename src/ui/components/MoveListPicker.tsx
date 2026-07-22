// Lista de jugadas clicable, para marcar el momento crítico (RF-3.1a) o
// como referencia visual con clasificación por color en la fase 2 (design
// system §5 MoveList: "error grave/error/imprecisión con marca de color").
import type { MoveClassification } from '../../core/types';

export interface MoveListEntry {
  ply: number;
  san: string;
  clasificacion?: MoveClassification;
}

const COLOR_CLASIFICACION: Record<MoveClassification, string> = {
  grave: 'text-error-text',
  error: 'text-error-text',
  imprecision: 'text-info',
  buena: 'text-secondary',
};

export function MoveListPicker({
  moves,
  selectedPly,
  onSelect,
}: {
  moves: MoveListEntry[];
  selectedPly: number | null;
  onSelect?: (ply: number) => void;
}) {
  const rows: Array<[number, MoveListEntry, MoveListEntry | undefined]> = [];
  for (let i = 0; i < moves.length; i += 2) rows.push([i / 2 + 1, moves[i], moves[i + 1]]);

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-subtle bg-surface p-3 font-mono text-sm">
      <ol className="m-0 list-none columns-2 p-0">
        {rows.map(([n, w, b]) => (
          <li key={n} className="py-0.5">
            <span className="text-tertiary">{n}.</span>{' '}
            <MoveButton entry={w} selected={selectedPly === w.ply} onSelect={onSelect} />
            {b && <MoveButton entry={b} selected={selectedPly === b.ply} onSelect={onSelect} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function MoveButton({ entry, selected, onSelect }: { entry: MoveListEntry; selected: boolean; onSelect?: (ply: number) => void }) {
  const color = entry.clasificacion ? COLOR_CLASIFICACION[entry.clasificacion] : 'text-primary';
  if (!onSelect) {
    return <span className={`${color} mr-2`}>{entry.san}</span>;
  }
  return (
    <button
      onClick={() => onSelect(entry.ply)}
      className={`mr-2 rounded-sm px-1 transition-colors duration-[120ms] ${
        selected ? 'bg-accent-subtle text-primary' : `${color} hover:bg-elevated`
      }`}
    >
      {entry.san}
    </button>
  );
}
