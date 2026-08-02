// Pantalla "Cálculo" (E7): un solo ejercicio de cálculo declarado (RF-7.1).
// Se anotan las candidatas —las dos primeras con su línea— y la evaluación de
// la posición a la que llega cada una, sin reloj y con el tablero quieto
// (RF-7.3), antes de comparar con el motor. Disponible una vez por semana
// (RF-7.2), con práctica libre durante el enfriamiento.
//
// Hasta ADR-0016 esta pantalla tenía dos pestañas —"Línea comprometida" y
// "Stoyko semanal"—. La primera servía posiciones del catálogo del Radar y su
// mecánica (declarar una línea ply a ply) ya vive acá dentro, en cada rama: era
// el caso "una rama, sin evaluación" de este mismo ejercicio, con el costo de
// un selector de modo que contradice el principio 1 del PRD.
import { useEffect } from 'react';
import type { Color, EvalSymbol } from '../../core/types';
import { Board } from '../components/Board';
import { BoardSkeleton } from '../components/BoardSkeleton';
import { Chip } from '../components/Chip';
import { ConfidenceSlider } from '../components/ConfidenceSlider';
import { useStoykoStore } from '../state/stoykoStore';
import { useSlowLoading } from '../hooks/useSlowLoading';
import { PLIES_MIN_LINEA, declaracionCompleta, ramaPideLinea } from '../../core/calculo';
import { formatDuracion } from '../format';
import { t } from '../i18n/es';

// La sub-ruta #/calculo/stoyko sigue entrando acá (el router resuelve por el
// primer segmento): era el deep-link de la prescripción y puede estar
// marcado en favoritos. Ya no distingue nada, porque hay un solo ejercicio.
export function CalculoScreen() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-3">
      <div className="mx-auto flex w-full max-w-md flex-col gap-1 sm:mx-0 sm:max-w-none">
        <h1 className="m-0 font-display text-3xl font-medium">{t.calculo.titulo}</h1>
        <p className="m-0 text-sm text-secondary">{t.calculo.subtitulo}</p>
      </div>

      {/* Colapsable: en celular el ejercicio necesita el alto para el tablero y
          el input; la explicación se lee una vez y no debe empujar todo abajo. */}
      <details className="rounded-lg border border-info/40 bg-surface px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium tracking-wider text-secondary uppercase marker:content-none">
          {t.calculo.queEsTitulo}
        </summary>
        <p className="m-0 mt-2 text-sm text-secondary">{t.calculo.explicacion}</p>
        {/* Qué parte del ejercicio original implementa esta versión. El código
            documentaba la simplificación (una jugada por candidata, en vez de
            la línea entera) y la pantalla la presentaba como si fuera el
            ejercicio completo: quien lo conoce se da cuenta, y quien no,
            aprende una versión recortada creyendo que es la de Stoyko. */}
        <p className="m-0 mt-2 text-sm text-tertiary">{t.calculo.explicacionAlcance}</p>
      </details>

      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
        <CalculoDeclarado />
      </div>
    </div>
  );
}

const EVAL_SIMBOLOS: EvalSymbol[] = ['+-', '±', '=', '∓', '-+'];
const EVAL_LABELS: Record<EvalSymbol, string> = { '+-': '+−', '±': '±', '=': '=', '∓': '∓', '-+': '−+' };

function CalculoDeclarado() {
  const s = useStoykoStore();
  const slow = useSlowLoading(s.phase === 'cargando');

  // Solo al montar (deps []): empezar() ya pone phase en 'cargando' como primer
  // paso, así que depender de todo el store ([s]) reengancha el efecto con esa
  // misma condición todavía activa mientras el fetch async sigue en vuelo —
  // cada reenganche llama empezar() de nuevo, que vuelve a "tocar" el store, en
  // un ciclo que React corta con "Maximum update depth exceeded".
  useEffect(() => {
    const store = useStoykoStore.getState();
    if (store.phase === 'cargando' && !store.origen) void store.empezar();
  }, []);

  if (s.phase === 'cargando') return <CargaCalculo slow={slow} onRetry={() => void s.empezar(true)} />;
  if (s.phase === 'error') return <ErrorCalculo onRetry={() => void s.empezar(true)} />;
  if (s.phase === 'sinContenido') return <Centro texto={t.stoyko.sinContenido} />;
  if (s.phase === 'enfriamiento') return <Enfriamiento />;

  if (!s.origen || !s.fen) return <Centro texto={t.stoyko.cargando} />;
  const turn = (s.fen.split(' ')[1] === 'b' ? 'b' : 'w') as Color;

  return (
    <>
      <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[52vh] sm:mx-0 sm:w-[60%] sm:max-w-[640px]">
        <Board
          fen={s.fen}
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
        {/* De dónde salió la posición. Servir una posición de tu propia partida
            sin decirlo sería raro; y decirlo es la mitad del valor (ADR-0015). */}
        <OrigenDeLaPosicion />
        {s.phase === 'analizando' && <Analizando />}
        {s.phase === 'confianza' && (
          <ConfidenceSlider onConfirm={(v) => void s.confirmarConfianza(v)} label={t.stoyko.confianzaPregunta} />
        )}
        {s.phase === 'revelado' && <Revelado />}
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
    <div className="w-full">
      <span role="status" className="sr-only">
        {slow ? t.calculo.cargaLenta : t.calculo.cargando}
      </span>
      <div aria-busy="true" className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
        <BoardSkeleton />
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

function Enfriamiento() {
  const proxima = useStoykoStore((s) => s.proximaDisponibleEn);
  const fecha = proxima ? new Date(proxima).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '';
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <p className="m-0 font-display text-xl font-medium">{t.stoyko.enfriamientoTitulo}</p>
      <p className="m-0 text-secondary">{t.stoyko.enfriamientoTexto.replace('{fecha}', fecha)}</p>
      <button onClick={() => void useStoykoStore.getState().practicar()} className="btn-secondary">
        {t.stoyko.practicar}
      </button>
      <p className="m-0 text-xs text-tertiary">{t.stoyko.practicaNota}</p>
    </div>
  );
}

/** Qué posición se está sirviendo y por qué. */
function OrigenDeLaPosicion() {
  const origen = useStoykoStore((s) => s.origen);
  if (!origen) return null;
  const texto = origen.tipo === 'catalogo'
    ? t.stoyko.origenCatalogo
    : origen.posicion.motivo === 'mas-centipeones'
      ? t.stoyko.origenPropiaCentipeones.replace('{cp}', String(origen.posicion.cpPerdidos))
      : t.stoyko.origenPropiaTiempo.replace('{duracion}', formatDuracion(origen.posicion.tiempoMs ?? 0));
  return <p className="m-0 rounded-md border border-info/40 bg-info-subtle px-3 py-2 text-xs text-secondary">{texto}</p>;
}

function Analizando() {
  const s = useStoykoStore();
  const pideLinea = ramaPideLinea(s.ramas.length);
  const pliesMinimos = pideLinea ? PLIES_MIN_LINEA : 1;
  const puedeCerrar = s.ramaEnCurso.linea.length >= pliesMinimos;
  const completa = declaracionCompleta(s.ramas);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-secondary">{t.stoyko.consigna}</p>

      {/* Las ramas ya cerradas, con su línea en UCI y su evaluación al final.
          Mostrar la línea entera —y no solo la candidata— es lo que hace que el
          ejercicio se parezca al de Stoyko (ADR-0015). */}
      {s.ramas.length > 0 && (
        <div className="rounded-lg border border-subtle bg-surface p-3">
          <p className="m-0 mb-2 text-xs tracking-wider text-tertiary uppercase">{t.stoyko.candidatasTitulo}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {s.ramas.map((rama, i) => (
              <li key={`${rama.linea.join('-')}-${i}`} className="flex items-start justify-between gap-2">
                <span className="min-w-0 font-mono text-sm break-words text-primary">
                  {rama.linea.join(' ')}{' '}
                  <span className="text-tertiary">({rama.evaluacion ? EVAL_LABELS[rama.evaluacion] : ''})</span>
                </span>
                <button onClick={() => s.quitarRama(i)} className="shrink-0 text-xs text-secondary underline">
                  {t.stoyko.quitar}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* La rama en curso se carga ply a ply: es la mecánica que traía la
          pestaña de línea comprometida, ahora dentro del único ejercicio. */}
      <div className="flex flex-col gap-2 rounded-lg border border-accent/45 bg-surface p-3">
        <p className="m-0 text-xs tracking-wider text-accent uppercase">
          {(pideLinea ? t.stoyko.ramaConLinea : t.stoyko.ramaSuelta).replace('{n}', String(s.ramas.length + 1))}
        </p>
        <p className="m-0 font-mono text-sm text-primary">
          {s.ramaEnCurso.linea.length > 0 ? s.ramaEnCurso.linea.join(' ') : t.stoyko.ramaVacia}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            s.agregarPly();
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
          {s.inputError && <p className="m-0 text-xs text-error-text">{s.inputError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary flex-1">
              {t.stoyko.agregarPly}
            </button>
            <button
              type="button"
              onClick={() => s.borrarUltimoPly()}
              disabled={s.ramaEnCurso.linea.length === 0}
              className="min-h-11 px-3 text-sm text-secondary underline-offset-4 hover:underline disabled:opacity-40"
            >
              {t.stoyko.borrarPly}
            </button>
          </div>
        </form>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-sm text-secondary">{t.stoyko.evalPregunta}</legend>
          <div className="flex gap-1.5">
            {EVAL_SIMBOLOS.map((sym) => (
              <Chip key={sym} selected={s.ramaEnCurso.evaluacion === sym} onClick={() => s.setEvalSeleccionada(sym)}>
                <span className="font-mono">{EVAL_LABELS[sym]}</span>
              </Chip>
            ))}
          </div>
        </fieldset>

        {/* No se deshabilita: un botón muerto sin explicación es peor que uno
            que dice qué falta. La validación vive en el store y su mensaje
            aparece arriba, junto al input. */}
        <button onClick={() => s.cerrarRama()} className="btn-secondary">
          {t.stoyko.cerrarRama}
        </button>
        {!puedeCerrar && (
          <p className="m-0 text-xs text-tertiary">
            {t.stoyko.faltaLinea.replace('{n}', String(pliesMinimos))}
          </p>
        )}
      </div>

      <button onClick={() => s.terminarAnalisis()} disabled={!completa} className="btn-primary">
        {t.stoyko.terminarAnalisis}
      </button>
      {!completa && <p className="m-0 text-xs text-tertiary">{t.stoyko.faltanRamas}</p>}
    </div>
  );
}

function Revelado() {
  const s = useStoykoStore();
  const acierto = s.acierto ?? false;
  const brechaTexto = s.resultado?.brechaEvaluacion !== null && s.resultado?.brechaEvaluacion !== undefined
    ? s.resultado.brechaEvaluacion === 0
      ? t.stoyko.brechaCoincide.replace('{tuya}', EVAL_LABELS[s.evaluacionMotor ?? '='])
      : t.stoyko.brechaDifiere
          .replace('{tuya}', EVAL_LABELS[evaluacionDeclarada(s.ramas) ?? '='])
          .replace('{motor}', EVAL_LABELS[s.evaluacionMotor ?? '='])
          .replace('{pasos}', String(s.resultado.brechaEvaluacion))
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex flex-col gap-2 rounded-lg border p-4 ${acierto ? 'border-success/35 bg-success-subtle' : 'border-error/35 bg-error-subtle'}`}>
        <p className="m-0 font-display text-xl font-medium">{acierto ? t.stoyko.acierto : t.stoyko.fallo}</p>
        {s.lineaMotorSan.length > 0 && (
          <p className="m-0 font-mono text-xs text-secondary">
            {t.stoyko.lineaMotor}: {s.lineaMotorSan.join(' ')}
          </p>
        )}
        {/* Las tres varas, por separado y nunca promediadas (ADR-0015): tener la
            jugada no es lo mismo que haberla calculado, y ninguna de las dos es
            lo mismo que haber evaluado bien la posición. */}
        {s.resultado && s.resultado.profundidadVista > 0 && (
          <p className="m-0 text-xs text-secondary">
            {t.stoyko.profundidadVista.replace('{plies}', String(s.resultado.profundidadVista))}
          </p>
        )}
      </div>

      {brechaTexto && (
        <div className="rounded-lg border border-info/40 bg-info-subtle p-3">
          <p className="m-0 text-xs tracking-wider text-tertiary uppercase">{t.stoyko.brechaTitulo}</p>
          <p className="m-0 mt-1 text-sm text-secondary">{brechaTexto}</p>
        </div>
      )}

      {s.motorError && <p className="m-0 text-xs text-error-text">{t.stoyko.motorNoEvaluo}</p>}

      {s.practica && (
        <>
          <p className="m-0 text-xs text-tertiary">{t.stoyko.practicaNota}</p>
          <button onClick={() => void useStoykoStore.getState().practicar()} className="btn-secondary">
            {t.stoyko.otraPractica}
          </button>
        </>
      )}
    </div>
  );
}

/** La evaluación que el usuario declaró para la rama que se comparó: la de la
 * mejor jugada del motor si la tuvo, si no la primera que evaluó. */
function evaluacionDeclarada(ramas: { evaluacion?: EvalSymbol }[]): EvalSymbol | undefined {
  return ramas.find((rama) => rama.evaluacion !== undefined)?.evaluacion;
}
