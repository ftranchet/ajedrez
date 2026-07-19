import { useEffect } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { useTransferStore } from '../state/transferStore';
import { t } from '../i18n/es';

export function TransferScreen({ onClose }: { onClose: () => void }) {
  const state = useTransferStore();

  useEffect(() => {
    if (useTransferStore.getState().phase === 'inactivo') void useTransferStore.getState().start();
  }, []);

  function close() {
    useTransferStore.getState().close();
    onClose();
  }

  if (state.error) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="m-0 font-display text-3xl font-medium">{t.transfer.titulo}</h1>
        <p className="m-0 text-secondary">{state.error}</p>
        <button onClick={close} className="btn-secondary">{t.transfer.volver}</button>
      </div>
    );
  }

  if (state.phase === 'resultado' && state.measurement) {
    const correct = state.measurement.responses.filter((response) => response.correct).length;
    const percentage = Math.round((correct / state.measurement.responses.length) * 100);
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <p className="m-0 font-mono text-xs tracking-wider text-tertiary uppercase">{t.transfer.instrumento}</p>
        <h1 className="m-0 font-display text-3xl font-medium">{t.transfer.completada}</h1>
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <span className="font-mono text-3xl text-primary">{percentage}%</span>
          <p className="m-0 mt-1 text-sm text-secondary">
            {t.transfer.resultado.replace('{aciertos}', String(correct)).replace('{total}', String(state.measurement.responses.length))}
          </p>
        </div>
        <p className="m-0 text-sm text-secondary">{t.transfer.resultadoAyuda}</p>
        <button onClick={close} className="btn-primary">{t.transfer.volverPanel}</button>
      </div>
    );
  }

  if (state.phase !== 'jugando' || !state.item) return null;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={state.fen}
          orientation={state.orientation}
          turn={state.turn}
          lastMove={null}
          check={state.check}
          dests={state.dests}
          movableColor={state.saving ? null : state.turn}
          onMove={(from, to) => void state.userMove(from as Square, to as Square)}
        />
      </div>
      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-mono text-xs text-tertiary">
            {t.transfer.progreso.replace('{actual}', String(state.itemIndex + 1)).replace('{total}', '30')}
          </p>
          <p className="m-0 mt-1 font-display text-xl">{t.transfer.titulo}</p>
        </div>
        <p className="m-0 text-sm text-secondary">{t.transfer.consigna}</p>
        <p className="m-0 text-xs text-tertiary">{t.transfer.sinFeedback}</p>
        <button onClick={close} disabled={state.saving} className="btn-secondary">{t.transfer.pausar}</button>
      </aside>
    </div>
  );
}
