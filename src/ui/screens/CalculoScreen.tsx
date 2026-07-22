// Pantalla "Cálculo comprometido" (E7): dos ejercicios que comparten el
// mismo dispositivo — el tablero nunca se mueve mientras se piensa, y el
// tiempo se registra en silencio (RF-7.3) — pero distinta consigna. "Línea
// comprometida" (RF-7.1) declara una línea forzada completa por escrito,
// ply a ply, antes de revelar. "Stoyko semanal" (RF-7.2) es más abierto: sin
// reloj, se anotan todas las jugadas candidatas que se considerarían, cada
// una con su evaluación, antes de comparar con el motor — disponible una
// vez por semana.
import { useEffect, useState } from 'react';
import type { Color, EvalSymbol } from '../../core/types';
import { Board } from '../components/Board';
import { Chip } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { ConfidenceSlider } from '../components/ConfidenceSlider';
import { useCompromisoStore } from '../state/compromisoStore';
import { useStoykoStore } from '../state/stoykoStore';
import { useSlowLoading } from '../hooks/useSlowLoading';
import { t } from '../i18n/es';

type Modo = 'comprometida' | 'stoyko';

export function CalculoScreen() {
  const [modo, setModo] = useState<Modo>('comprometida');

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
      <div className="mx-auto flex w-full max-w-md flex-col gap-1 sm:mx-0 sm:max-w-none">
        <h1 className="m-0 font-display text-3xl font-medium">{t.calculo.titulo}</h1>
        <p className="m-0 text-sm text-secondary">{t.calculo.subtitulo}</p>
      </div>

      <SegmentedControl
        label={t.calculo.modosLabel}
        value={modo}
        options={[
          { value: 'comprometida', label: t.calculo.modoLineaComprometida },
          { value: 'stoyko', label: t.calculo.modoStoyko },
        ]}
        onChange={setModo}
        className="mx-auto w-full max-w-md sm:mx-0 sm:max-w-xs"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
        {modo === 'comprometida' ? <LineaComprometida /> : <Stoyko />}
      </div>
    </div>
  );
}

// ---- Línea comprometida (RF-7.1) ----

function LineaComprometida() {
  const s = useCompromisoStore();
  const slow = useSlowLoading(s.phase === 'cargando');

  // Solo al montar (deps []): empezar() ya pone phase en 'cargando' como
  // primer paso, así que depender de todo el store ([s]) reengancha el
  // efecto con esa misma condición todavía activa mientras el fetch async
  // sigue en vuelo — cada reenganche llama empezar() de nuevo, que vuelve a
  // "tocar" el store, en un ciclo que React corta con "Maximum update depth
  // exceeded" (reproducido con Playwright al alternar entre los dos modos
  // de esta pantalla, que le agregan más trabajo async concurrente a Dexie).
  useEffect(() => {
    const store = useCompromisoStore.getState();
    if (store.phase === 'cargando' && store.pool.length === 0 && !store.item) void store.empezar();
  }, []);

  if (s.phase === 'cargando') {
    return <CargaCalculo slow={slow} onRetry={() => void s.empezar(true)} />;
  }
  if (s.phase === 'error') return <ErrorCalculo onRetry={() => void s.empezar(true)} />;
  if (s.phase === 'sinContenido') return <Centro texto={t.calculo.sinContenido} />;

  const item = s.item;
  if (!item) return <Centro texto={t.calculo.cargando} />;
  const turn = (item.fen.split(' ')[1] === 'b' ? 'b' : 'w') as Color;

  return (
    <>
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
        </div>

        {s.phase === 'jugando' && <Jugando />}
        {s.phase === 'feedback' && <Feedback />}
      </aside>
    </>
  );
}

function Centro({ texto }: { texto: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2">
      <p className="m-0 text-secondary">{texto}</p>
    </div>
  );
}

function CargaCalculo({ slow, onRetry }: { slow: boolean; onRetry: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex w-full flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div
        aria-hidden="true"
        className="mx-auto grid aspect-square w-full min-w-[320px] max-w-[640px] grid-cols-8 overflow-hidden rounded-sm border border-subtle sm:mx-0 sm:w-[60%]"
      >
        {Array.from({ length: 64 }, (_, index) => (
          <span key={index} className={(Math.floor(index / 8) + index) % 2 === 0 ? 'bg-surface' : 'bg-elevated'} />
        ))}
      </div>
      <aside className="flex w-full flex-col gap-3 rounded-lg border border-subtle bg-surface p-4 sm:w-[40%] sm:max-w-xs">
        <p className="m-0 font-display text-xl font-medium text-primary">{t.calculo.cargando}</p>
        <p className="m-0 text-sm text-secondary">{t.calculo.cargaDetalle}</p>
        {slow && (
          <div className="flex flex-col gap-3 border-t border-subtle pt-3">
            <p className="m-0 text-sm text-secondary">{t.calculo.cargaLenta}</p>
            <button type="button" onClick={onRetry} className="btn-secondary">
              {t.calculo.reintentarCarga}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function ErrorCalculo({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-error/35 bg-error-subtle p-4 sm:mx-0">
      <p className="m-0 font-display text-xl font-medium text-primary">{t.calculo.cargaErrorTitulo}</p>
      <p className="m-0 text-sm text-secondary">{t.calculo.cargaErrorTexto}</p>
      <button type="button" onClick={onRetry} className="btn-secondary">
        {t.calculo.reintentarCarga}
      </button>
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

// ---- Stoyko semanal (RF-7.2) ----

const EVAL_SIMBOLOS: EvalSymbol[] = ['+-', '±', '=', '∓', '-+'];
const EVAL_LABELS: Record<EvalSymbol, string> = { '+-': '+−', '±': '±', '=': '=', '∓': '∓', '-+': '−+' };

function Stoyko() {
  const s = useStoykoStore();
  const slow = useSlowLoading(s.phase === 'cargando');

  // Solo al montar: mismo motivo que en LineaComprometida más arriba.
  useEffect(() => {
    const store = useStoykoStore.getState();
    if (store.phase === 'cargando' && store.pool.length === 0 && !store.item) void store.empezar();
  }, []);

  if (s.phase === 'cargando') return <CargaCalculo slow={slow} onRetry={() => void s.empezar(true)} />;
  if (s.phase === 'error') return <ErrorCalculo onRetry={() => void s.empezar(true)} />;
  if (s.phase === 'sinContenido') return <Centro texto={t.stoyko.sinContenido} />;
  if (s.phase === 'enfriamiento') return <StoykoEnfriamiento />;

  const item = s.item;
  if (!item) return <Centro texto={t.stoyko.cargando} />;
  const turn = (item.fen.split(' ')[1] === 'b' ? 'b' : 'w') as Color;

  return (
    <>
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
        {s.phase === 'analizando' && <StoykoAnalizando />}
        {s.phase === 'confianza' && (
          <ConfidenceSlider onConfirm={(v) => void s.confirmarConfianza(v)} label={t.stoyko.confianzaPregunta} />
        )}
        {s.phase === 'revelado' && <StoykoRevelado />}
      </aside>
    </>
  );
}

function StoykoEnfriamiento() {
  const proxima = useStoykoStore((s) => s.proximaDisponibleEn);
  const fecha = proxima ? new Date(proxima).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '';
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2">
      <p className="m-0 font-display text-xl font-medium">{t.stoyko.enfriamientoTitulo}</p>
      <p className="m-0 text-secondary">{t.stoyko.enfriamientoTexto.replace('{fecha}', fecha)}</p>
    </div>
  );
}

function StoykoAnalizando() {
  const s = useStoykoStore();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-secondary">{t.stoyko.consigna}</p>

      {s.candidatas.length > 0 && (
        <div className="rounded-lg border border-subtle bg-surface p-3">
          <p className="m-0 mb-2 text-xs tracking-wider text-tertiary uppercase">{t.stoyko.candidatasTitulo}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {s.candidatas.map((c, i) => (
              <li key={`${c.jugada}-${i}`} className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-primary">
                  {c.jugada} <span className="text-tertiary">({EVAL_LABELS[c.evaluacion]})</span>
                </span>
                <button onClick={() => s.quitarCandidata(i)} className="text-xs text-secondary underline">
                  {t.stoyko.quitar}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.stoyko.evalPregunta}</legend>
        <div className="flex gap-1.5">
          {EVAL_SIMBOLOS.map((sym) => (
            <Chip key={sym} selected={s.evalSeleccionada === sym} onClick={() => s.setEvalSeleccionada(sym)}>
              <span className="font-mono">{EVAL_LABELS[sym]}</span>
            </Chip>
          ))}
        </div>
      </fieldset>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          s.agregarCandidata();
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          value={s.inputActual}
          onChange={(e) => s.setInputActual(e.target.value)}
          placeholder={t.stoyko.placeholder}
          className="min-h-11 rounded-md border border-subtle bg-surface px-3 py-2 font-mono text-sm text-primary"
          autoFocus
        />
        {s.inputError && <p className="m-0 text-xs text-error">{s.inputError}</p>}
        <button type="submit" className="btn-secondary">
          {t.stoyko.agregarCandidata}
        </button>
      </form>

      <button onClick={() => s.terminarAnalisis()} disabled={s.candidatas.length === 0} className="btn-primary">
        {t.stoyko.terminarAnalisis}
      </button>
    </div>
  );
}

function StoykoRevelado() {
  const s = useStoykoStore();
  const acierto = s.acierto ?? false;
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${acierto ? 'border-success/35 bg-success-subtle' : 'border-error/35 bg-error-subtle'}`}>
      <p className="m-0 font-display text-xl font-medium">{acierto ? t.stoyko.acierto : t.stoyko.fallo}</p>
      <p className="m-0 font-mono text-xs text-secondary">
        {t.stoyko.lineaMotor}: {s.lineaMotorSan.join(' ')}
      </p>
    </div>
  );
}
