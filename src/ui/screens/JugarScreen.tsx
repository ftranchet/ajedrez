// Pantalla Jugar: partida local contra el motor (RF-1.1, RF-1.2, RF-1.3).
import { useState } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { Chip } from '../components/Chip';
import { PromotionDialog } from '../components/PromotionDialog';
import { ENGINE_LEVELS, useGameStore } from '../state/gameStore';
import type { Color } from '../../core/types';
import { t } from '../i18n/es';

export function JugarScreen() {
  const s = useGameStore();

  if (s.phase === 'setup' || s.phase === 'loading') return <Setup />;

  const statusText =
    s.phase === 'ended'
      ? resultText(s)
      : s.thinking
        ? t.jugar.pensando
        : `${t.jugar.teToca}${s.check ? ` — ${t.jugar.jaque}` : ''}`;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      {/* El tablero manda (§1): elemento dominante, mínimo 320 px */}
      <div className="relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={s.fen}
          orientation={s.playerColor}
          turn={s.turn}
          lastMove={s.lastMove}
          check={s.check}
          dests={s.dests}
          movableColor={s.phase === 'playing' && !s.thinking ? s.playerColor : null}
          onMove={(from, to) => void s.userMove(from as Square, to as Square)}
        />
        {s.pendingPromotion && (
          <PromotionDialog
            color={s.playerColor}
            onPick={(p) => void s.userMove(s.pendingPromotion!.from, s.pendingPromotion!.to, p)}
            onCancel={() => s.cancelPromotion()}
          />
        )}
      </div>

      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-display text-xl">{statusText}</p>
          {s.phase === 'ended' && s.saved && (
            <p className="mt-1 mb-0 text-sm text-success">{t.jugar.partidaGuardada}</p>
          )}
        </div>

        {/* Fallo del motor durante la partida: antes solo se veía en la pantalla
            de configuración, así que en juego el usuario quedaba sin turno del
            motor y sin explicación. */}
        {s.engineError && s.phase === 'playing' && (
          <div className="flex flex-col gap-2 rounded-lg border border-error/35 bg-error-subtle p-3">
            <p className="m-0 text-sm text-primary">{t.jugar.errorMotorEnJuego}</p>
            <button onClick={() => s.reset()} className="btn-secondary">
              {t.jugar.nuevaPartida}
            </button>
          </div>
        )}

        <MoveList moves={s.sanMoves} />

        {s.phase === 'playing' && !s.engineError && <ResignButton />}
        {s.phase === 'ended' && (
          <button onClick={() => s.reset()} className="btn-primary">
            {t.jugar.nuevaPartida}
          </button>
        )}
      </aside>
    </div>
  );
}

function resultText(s: ReturnType<typeof useGameStore.getState>): string {
  const r = t.jugar.resultado;
  const motivo =
    s.endReason === 'mate'
      ? r.porMate
      : s.endReason === 'abandono'
        ? r.porAbandono
        : s.endReason === 'ahogado'
          ? r.porAhogado
          : r.porRegla;
  if (s.resultado === '1/2-1/2') return `${r.tablas} ${motivo}`;
  const playerWon = (s.resultado === '1-0' && s.playerColor === 'w') || (s.resultado === '0-1' && s.playerColor === 'b');
  return `${playerWon ? r.ganaste : r.perdiste} ${motivo}`;
}

function MoveList({ moves }: { moves: string[] }) {
  const rows: Array<[number, string, string | undefined]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push([i / 2 + 1, moves[i], moves[i + 1]]);
  }
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-subtle bg-surface p-3 font-mono text-sm sm:max-h-80">
      <p className="m-0 mb-1 text-xs tracking-wider text-tertiary uppercase">{t.jugar.jugadas}</p>
      {rows.length === 0 ? (
        <span className="text-tertiary">—</span>
      ) : (
        <ol className="m-0 list-none columns-2 p-0">
          {rows.map(([n, w, b]) => (
            <li key={n} className="text-secondary">
              <span className="text-tertiary">{n}.</span> {w} {b ?? ''}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResignButton() {
  const resign = useGameStore((st) => st.resign);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-secondary">
        {t.jugar.rendirse}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-3">
      <p className="m-0 text-sm">{t.jugar.confirmarRendirse}</p>
      <div className="flex gap-2">
        <button onClick={() => void resign()} className="btn-danger flex-1">
          {t.jugar.confirmarSi}
        </button>
        <button onClick={() => setConfirming(false)} className="btn-secondary flex-1">
          {t.jugar.confirmarNo}
        </button>
      </div>
    </div>
  );
}

function Setup() {
  const s = useGameStore();
  const [levelId, setLevelId] = useState(ENGINE_LEVELS[0].id);
  const [color, setColor] = useState<Color | 'random'>('w');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header>
        <h1 className="m-0 font-display text-3xl font-medium">{t.jugar.titulo}</h1>
        <p className="mt-1 mb-0 text-secondary">{t.jugar.subtitulo}</p>
      </header>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.jugar.nivel}</legend>
        <div className="flex flex-col gap-2">
          {ENGINE_LEVELS.map((l) => (
            <Chip key={l.id} selected={levelId === l.id} onClick={() => setLevelId(l.id)}>
              {t.jugar.niveles[l.id] ?? l.id}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.jugar.color}</legend>
        <div className="flex gap-2">
          <Chip selected={color === 'w'} onClick={() => setColor('w')}>{t.jugar.blancas}</Chip>
          <Chip selected={color === 'b'} onClick={() => setColor('b')}>{t.jugar.negras}</Chip>
          <Chip selected={color === 'random'} onClick={() => setColor('random')}>{t.jugar.aleatorio}</Chip>
        </div>
      </fieldset>

      {s.engineError && (
        <p className="m-0 rounded-md border border-error/35 bg-error-subtle p-3 text-sm text-primary">
          {t.jugar.errorMotor}
        </p>
      )}

      <button
        onClick={() => void s.start(levelId, color)}
        disabled={s.phase === 'loading'}
        className="btn-primary"
      >
        {s.phase === 'loading' ? t.jugar.cargandoMotor : t.jugar.empezar}
      </button>

      <p className="m-0 text-sm text-tertiary">{t.jugar.notaMotor}</p>
    </div>
  );
}

