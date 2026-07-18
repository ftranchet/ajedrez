// Pantalla Cálculo comprometido (E7, RF-7.1): la línea se declara por
// escrito, ply a ply, con el tablero en solo lectura y siempre en la
// posición inicial — nunca se mueve mientras el usuario calcula. Recién al
// completar la línea entera se revela y se puntúa (RF-7.1: "se puntúa la
// línea entera, no solo la primera jugada").
import { useEffect } from 'react';
import type { Color } from '../../core/types';
import { Board } from '../components/Board';
import { useCompromisoStore } from '../state/compromisoStore';
import { t } from '../i18n/es';

export function CalculoScreen() {
  const s = useCompromisoStore();

  useEffect(() => {
    if (s.phase === 'cargando' && s.pool.length === 0 && !s.item) void s.empezar();
  }, [s]);

  if (s.phase === 'cargando') return <Centro texto={t.calculo.cargando} />;
  if (s.phase === 'sinContenido') return <Centro texto={t.calculo.sinContenido} />;

  const item = s.item;
  if (!item) return <Centro texto={t.calculo.cargando} />;
  const turn = (item.fen.split(' ')[1] === 'b' ? 'b' : 'w') as Color;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={item.fen}
          orientation={turn}
          turn={turn}
          lastMove={null}
          check={false}
          dests={new Map()}
          movableColor={null}
          onMove={() => {}}
        />
      </div>

      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-mono text-xs text-tertiary">
            {t.calculo.progreso.replace('{actual}', String(s.lineaIngresada.length + (s.phase === 'jugando' ? 1 : 0))).replace('{total}', String(item.solucion.length))}
          </p>
          <p className="m-0 mt-1 font-display text-xl">{t.calculo.titulo}</p>
        </div>

        {s.phase === 'jugando' && <Jugando />}
        {s.phase === 'feedback' && <Feedback />}
      </aside>
    </div>
  );
}

function Centro({ texto }: { texto: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.calculo.titulo}</h1>
      <p className="m-0 text-secondary">{texto}</p>
    </div>
  );
}

function Jugando() {
  const s = useCompromisoStore();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-secondary">{t.calculo.consigna}</p>
      {s.lineaIngresada.length > 0 && (
        <div className="rounded-lg border border-subtle bg-surface p-3">
          <p className="m-0 mb-1 text-xs tracking-wider text-tertiary uppercase">{t.calculo.lineaTitulo}</p>
          <p className="m-0 font-mono text-sm text-secondary">{s.lineaIngresada.join('  ')}</p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          s.agregarJugada();
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          value={s.inputActual}
          onChange={(e) => s.setInputActual(e.target.value)}
          placeholder={t.calculo.placeholder}
          className="min-h-11 rounded-md border border-subtle bg-surface px-3 py-2 font-mono text-sm text-primary"
          autoFocus
        />
        {s.inputError && <p className="m-0 text-xs text-error">{s.inputError}</p>}
        <button type="submit" className="btn-primary">
          {t.calculo.agregar}
        </button>
      </form>
      {s.lineaIngresada.length > 0 && (
        <button onClick={() => s.borrarUltima()} className="btn-secondary">
          {t.calculo.borrar}
        </button>
      )}
    </div>
  );
}

function Feedback() {
  const s = useCompromisoStore();
  const acierto = s.resultado?.correcta ?? false;
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${acierto ? 'border-success/35 bg-success-subtle' : 'border-error/35 bg-error-subtle'}`}>
      <p className="m-0 font-display text-xl font-medium">{acierto ? t.calculo.correcta : t.calculo.incorrecta}</p>
      <p className="m-0 font-mono text-xs text-secondary">
        {t.calculo.tuLinea}: {s.lineaUsuarioSan.join(' ') || '—'}
      </p>
      {!acierto && (
        <p className="m-0 font-mono text-xs text-secondary">
          {t.calculo.lineaCorrecta}: {s.lineaSolucionSan.join(' ')}
        </p>
      )}
      <button onClick={() => s.siguiente()} className="btn-primary mt-1">
        {t.calculo.otraPosicion}
      </button>
    </div>
  );
}
