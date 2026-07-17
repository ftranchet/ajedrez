// Análisis en dos fases (E3, RF-3.1–3.4): el motor está bloqueado hasta
// terminar la fase 1. Se abre desde PanelScreen para una partida puntual.
import { useState } from 'react';
import { Board } from '../components/Board';
import { EvalScalePicker } from '../components/EvalScalePicker';
import { EvalGraph } from '../components/EvalGraph';
import { MoveListPicker } from '../components/MoveListPicker';
import { Chip } from '../components/Chip';
import { useAnalysisStore } from '../state/analysisStore';
import type { CategoriaError } from '../../core/types';
import { t } from '../i18n/es';

export function AnalizarScreen() {
  const phase = useAnalysisStore((s) => s.phase);

  if (phase === 'cargando') return <p className="m-0 text-secondary">{t.sesion.cargando}</p>;
  if (phase === 'fase1-momento') return <MomentoCritico />;
  if (phase === 'fase1-plan') return <Plan />;
  if (phase === 'fase1-evaluaciones') return <Evaluaciones />;
  if (phase === 'fase2-analizando') return <Analizando />;
  if (phase === 'fase2-resultado') return <Resultado />;
  if (phase === 'confirmar-errores') return <ConfirmarErrores />;
  if (phase === 'fin') return <Fin />;
  return null;
}

function Encabezado({ titulo }: { titulo: string }) {
  return <h1 className="m-0 font-display text-2xl font-medium">{titulo}</h1>;
}

function MomentoCritico() {
  const { moves, marcarMomentoCritico, volver } = useAnalysisStore();
  const [seleccion, setSeleccion] = useState<number | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Encabezado titulo={t.analisis.fase1Titulo} />
      <p className="m-0 text-secondary">{t.analisis.momentoConsigna}</p>
      <MoveListPicker
        moves={moves.map((m) => ({ ply: m.ply, san: m.san }))}
        selectedPly={seleccion}
        onSelect={setSeleccion}
      />
      <button className="btn-primary" disabled={seleccion === null} onClick={() => seleccion !== null && marcarMomentoCritico(seleccion)}>
        {t.analisis.momentoSiguiente}
      </button>
      <button className="btn-secondary" onClick={() => volver()}>
        {t.analisis.volver}
      </button>
    </div>
  );
}

function Plan() {
  const confirmarPlan = useAnalysisStore((s) => s.confirmarPlan);
  const [texto, setTexto] = useState('');

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Encabezado titulo={t.analisis.planTitulo} />
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={t.analisis.planPlaceholder}
        rows={3}
        className="w-full resize-none rounded-lg border border-subtle bg-surface p-3 text-primary placeholder:text-tertiary focus-visible:border-accent"
      />
      <button className="btn-primary" onClick={() => confirmarPlan(texto)}>
        {t.analisis.planSiguiente}
      </button>
    </div>
  );
}

function Evaluaciones() {
  const s = useAnalysisStore();
  const ply = s.fase1Posiciones[s.fase1EvalIndex];
  const move = s.moves.find((m) => m.ply === ply);
  if (!move) return null;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board fen={move.fenAntes} orientation="w" turn={move.ladoQueMueve} lastMove={null} check={false} dests={new Map()} movableColor={null} onMove={() => {}} />
      </div>
      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-mono text-xs text-tertiary">
            {t.analisis.evalProgreso.replace('{actual}', String(s.fase1EvalIndex + 1)).replace('{total}', String(s.fase1Posiciones.length))}
          </p>
          <p className="m-0 mt-1 font-display text-xl">{t.analisis.evalTitulo}</p>
        </div>
        <EvalScalePicker onSelect={(v) => void s.evaluarPosicion(v)} />
      </aside>
    </div>
  );
}

function Analizando() {
  const progreso = useAnalysisStore((s) => s.progreso);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <Encabezado titulo={t.analisis.analizandoTitulo} />
      {progreso && (
        <p className="m-0 font-mono text-sm text-secondary">
          {t.analisis.analizandoProgreso.replace('{actual}', String(progreso.ply + 1)).replace('{total}', String(progreso.totalPlies + 1))}
        </p>
      )}
    </div>
  );
}

function Resultado() {
  const s = useAnalysisStore();
  const analysis = s.analysis;
  if (!analysis) return null;
  const errores = analysis.jugadas.filter((j) => j.clasificacion === 'grave' || j.clasificacion === 'error');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Encabezado titulo={t.analisis.fase2Titulo} />

      <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
        <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.analisis.curvaTitulo}</h2>
        <EvalGraph jugadas={analysis.jugadas} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.analisis.jugadasTitulo}</h2>
        <MoveListPicker
          moves={analysis.jugadas.map((j) => ({ ply: j.ply, san: j.san, clasificacion: j.clasificacion }))}
          selectedPly={null}
        />
      </section>

      {analysis.comparacionEvaluaciones.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.analisis.comparacionTitulo}</h2>
          <ul className="m-0 flex flex-col gap-1 p-0 text-sm">
            {analysis.comparacionEvaluaciones.map((c) => (
              <li key={c.ply} className="flex list-none items-center justify-between rounded-md bg-surface px-3 py-2">
                <span className="font-mono text-secondary">
                  {c.valorUsuario} → {c.valorMotor}
                </span>
                <span className={c.coincide ? 'text-success' : 'text-error'}>
                  {c.coincide ? t.analisis.comparacionCoincide : t.analisis.comparacionNoCoincide}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button className="btn-primary" onClick={() => s.continuarAErrores()}>
        {errores.length > 0 ? t.analisis.verErrores.replace('{n}', String(errores.length)) : t.analisis.terminarSinErrores}
      </button>
    </div>
  );
}

const CATEGORIAS: Array<{ value: CategoriaError; label: string }> = [
  { value: 'tactico', label: t.analisis.categoriaTactico },
  { value: 'posicional', label: t.analisis.categoriaPosicional },
  { value: 'tiempo', label: t.analisis.categoriaTiempo },
  { value: 'psicologico', label: t.analisis.categoriaPsicologico },
];

function ConfirmarErrores() {
  const s = useAnalysisStore();
  const entry = s.erroresPendientes[0];
  if (!entry) return null;
  const total = s.erroresPendientes.length + s.erroresConfirmados;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <Encabezado titulo={t.analisis.confirmarTitulo} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
          <Board fen={entry.fenAntes} orientation="w" turn={entry.ladoQueMueve} lastMove={null} check={false} dests={new Map()} movableColor={null} onMove={() => {}} />
        </div>
        <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
          <div className="rounded-lg border border-error/35 bg-error-subtle p-4">
            <p className="m-0 font-mono text-xs text-tertiary">
              {t.analisis.confirmarProgreso.replace('{actual}', String(s.erroresConfirmados + 1)).replace('{total}', String(total))}
            </p>
            <p className="m-0 mt-1 font-display text-xl">{entry.san}</p>
            <p className="m-0 mt-2 text-sm text-secondary">
              {t.analisis.confirmarJugadaJugada}: <span className="font-mono text-primary">{entry.jugadaUsuario}</span>
            </p>
            <p className="m-0 text-sm text-secondary">
              {t.analisis.confirmarJugadaCorrecta}: <span className="font-mono text-primary">{entry.jugadaMotor}</span>
            </p>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 p-0 text-sm text-secondary">{t.analisis.categoriaTitulo}</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((c) => (
                <Chip key={c.value} selected={s.errorActualCategoria === c.value} onClick={() => s.elegirCategoria(c.value)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <button className="btn-primary" onClick={() => void s.confirmarErrorActual()}>
            {t.analisis.confirmarBoton}
          </button>
          <button className="btn-secondary" onClick={() => s.descartarErrorActual()}>
            {t.analisis.descartarBoton}
          </button>
        </aside>
      </div>
    </div>
  );
}

function resumenErrores(n: number): string {
  if (n === 0) return t.analisis.finResumenNinguno;
  if (n === 1) return t.analisis.finResumenUno;
  return t.analisis.finResumenOtro.replace('{n}', String(n));
}

function Fin() {
  const s = useAnalysisStore();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <Encabezado titulo={t.analisis.finTitulo} />
      <p className="m-0 text-secondary">{resumenErrores(s.erroresConfirmados)}</p>
      <button className="btn-primary" onClick={() => s.volver()}>
        {t.analisis.volver}
      </button>
    </div>
  );
}
