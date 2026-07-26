// Diagnóstico inicial (RF-11.4): 2 partidas sin reloj contra el motor local en
// niveles escalonados → 20 posiciones del Radar → banda de Elo estimada. La
// pantalla de intro vive en HoyScreen (Portada la antepone a "Tu sesión de
// hoy"), así que este componente arranca directo en la primera partida. Las
// partidas reutilizan `useGameStore` (misma mecánica que la pantalla Jugar)
// en vez de duplicar el motor de turnos.
import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { BoardSkeleton } from '../components/BoardSkeleton';
import { PromotionDialog } from '../components/PromotionDialog';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { EvalPicker } from '../components/EvalPicker';
import { ConfidenceSlider } from '../components/ConfidenceSlider';
import { SectionHeading } from '../components/SectionHeading';
import { Chip } from '../components/Chip';
import { DIAGNOSTICO_RADAR_TOTAL, useDiagnosticoStore, type LineaBaseDiagnostico } from '../state/diagnosticoStore';
import { useAnalysisStore } from '../state/analysisStore';
import { useGameStore } from '../state/gameStore';
import { useSessionStore } from '../state/sessionStore';
import { fugasPrincipales, lecturaPerfilDeFugas } from '../../core/leakProfile';
import type { RatingExterno } from '../../core/types';
import { formatDecimal } from '../format';
import { t } from '../i18n/es';

export function DiagnosticoScreen() {
  const phase = useDiagnosticoStore((s) => s.phase);

  if (phase === 'juego1' || phase === 'juego2') return <Juego />;
  if (phase === 'radar') return <RadarDiagnostico />;
  if (phase === 'pausado') return <DiagnosticoPausado />;
  if (phase === 'resultado') return <Resultado />;
  return null;
}

function DiagnosticoHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [children]);
  return (
    <h1 ref={ref} tabIndex={-1} className="m-0 font-display text-3xl font-medium focus:outline-none">
      {children}
    </h1>
  );
}

function ProgresoGlobal({ etapa }: { etapa: 1 | 2 | 3 }) {
  const texto = t.diagnostico.etapaProgreso
    .replace('{actual}', String(etapa))
    .replace('{total}', '3');
  return (
    <div className="flex flex-col gap-2" role="progressbar" aria-label={t.diagnostico.progresoLabel} aria-valuemin={1} aria-valuemax={3} aria-valuenow={etapa} aria-valuetext={texto}>
      <span className="font-mono text-xs tracking-wider text-tertiary uppercase">{texto}</span>
      <span className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((paso) => (
          <span key={paso} className={`h-1 rounded-full ${paso <= etapa ? 'bg-accent' : 'bg-elevated'}`} />
        ))}
      </span>
    </div>
  );
}

function EstadoEtapa({
  etapa,
  titulo,
  texto,
  error = false,
  onRetry,
  pauseAvailable = true,
}: {
  etapa: 1 | 2 | 3;
  titulo: string;
  texto: string;
  error?: boolean;
  onRetry?: () => void;
  pauseAvailable?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <ProgresoGlobal etapa={etapa} />
        <DiagnosticoHeading>{titulo}</DiagnosticoHeading>
      </header>
      {!error && <span role="status" className="sr-only">{texto}</span>}
      <div aria-busy={error ? undefined : true} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <BoardSkeleton />
        <aside className="flex min-h-40 w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
          <div
            role={error ? 'alert' : undefined}
            aria-live={error ? 'assertive' : undefined}
            className={`flex flex-col gap-3 rounded-lg border p-4 ${error ? 'border-error/35 bg-error-subtle' : 'border-subtle bg-surface'}`}
          >
            <p className="m-0 text-sm text-primary">{texto}</p>
            {onRetry && (
              <button onClick={onRetry} className="btn-primary">
                {etapa === 3 ? t.diagnostico.reintentarRadar : t.diagnostico.reintentarMotor}
              </button>
            )}
          </div>
          {pauseAvailable && (
            <button onClick={() => useDiagnosticoStore.getState().pausar()} className="btn-secondary">
              {t.diagnostico.pausar}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function Juego() {
  const diagPhase = useDiagnosticoStore((s) => s.phase);
  const g = useGameStore();

  useEffect(() => {
    if (g.phase === 'ended') void useDiagnosticoStore.getState().registrarResultadoJuego();
  }, [g.phase]);

  const titulo = diagPhase === 'juego1' ? t.diagnostico.juego1Titulo : t.diagnostico.juego2Titulo;
  const etapa = diagPhase === 'juego1' ? 1 : 2;

  if (g.phase === 'loading') {
    return <EstadoEtapa etapa={etapa} titulo={titulo} texto={t.diagnostico.preparandoMotor} pauseAvailable={false} />;
  }

  // start() vuelve a `setup` cuando Stockfish no inicializa. Sin este estado
  // el tablero parecía listo, pero no aceptaba jugadas ni ofrecía salida.
  if (g.phase === 'setup') {
    return (
      <EstadoEtapa
        etapa={etapa}
        titulo={titulo}
        texto={t.diagnostico.errorMotor}
        error
        onRetry={() => void useDiagnosticoStore.getState().reintentarJuego()}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <ProgresoGlobal etapa={etapa} />
        <DiagnosticoHeading>{titulo}</DiagnosticoHeading>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
          <Board
            fen={g.fen}
            orientation={g.playerColor}
            turn={g.turn}
            lastMove={g.lastMove}
            check={g.check}
            dests={g.dests}
            movableColor={g.phase === 'playing' && !g.thinking && !g.engineError ? g.playerColor : null}
            onMove={(from, to) => void g.userMove(from as Square, to as Square)}
          />
          {g.pendingPromotion && (
            <PromotionDialog
              color={g.playerColor}
              onPick={(p) => void g.userMove(g.pendingPromotion!.from, g.pendingPromotion!.to, p)}
              onCancel={() => g.cancelPromotion()}
            />
          )}
        </div>
        <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
          <div className="rounded-lg border border-subtle bg-surface p-4">
            <p className="m-0 font-display text-xl">{g.thinking ? t.jugar.pensando : t.jugar.teToca}</p>
          </div>
          <p className="m-0 text-sm text-secondary">{t.diagnostico.juegoConsigna}</p>
          {g.engineError && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-error/35 bg-error-subtle p-3">
              <p className="m-0 text-sm text-primary">{t.diagnostico.errorMotorEnJuego}</p>
              <button onClick={() => void useDiagnosticoStore.getState().reintentarJuego()} className="btn-secondary">
                {t.diagnostico.reiniciarPartida}
              </button>
            </div>
          )}
          {g.phase === 'playing' && !g.engineError && (
            <button onClick={() => void g.resign()} className="btn-secondary">
              {t.jugar.rendirse}
            </button>
          )}
          <button
            onClick={() => useDiagnosticoStore.getState().pausar()}
            disabled={g.thinking}
            aria-describedby={g.thinking ? 'diagnostico-pausa-espera' : undefined}
            className="btn-secondary"
          >
            {t.diagnostico.pausar}
          </button>
          {g.thinking && <p id="diagnostico-pausa-espera" className="m-0 text-xs text-tertiary">{t.diagnostico.pausaEsperaMotor}</p>}
        </aside>
      </div>
    </div>
  );
}

function RadarDiagnostico() {
  const s = useDiagnosticoStore();
  /** Ya se jugó la posición actual: el contador la incluye y el tablero se congela. */
  const respondida = s.radarSubPhase === 'confianza' || s.radarSubPhase === 'feedback';

  if (s.radarLoadStatus === 'cargando') {
    return <EstadoEtapa etapa={3} titulo={t.radar.titulo} texto={t.diagnostico.preparandoRadar} />;
  }

  if (s.radarLoadStatus === 'error' || !s.radarItem) {
    return (
      <EstadoEtapa
        etapa={3}
        titulo={t.radar.titulo}
        texto={t.diagnostico.errorRadar}
        error
        onRetry={() => void s.reintentarRadar()}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <ProgresoGlobal etapa={3} />
        <DiagnosticoHeading>{t.radar.titulo}</DiagnosticoHeading>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
          <Board
            fen={s.fen}
            orientation={s.boardOrientation}
            turn={s.turn}
            lastMove={s.lastMove}
            check={s.check}
            dests={s.dests}
            movableColor={s.radarSubPhase === 'jugando' ? s.turn : null}
            onMove={(from, to) => void s.radarUserMove(from as Square, to as Square)}
            feedback={
              s.radarSubPhase === 'feedback'
                ? s.radarUltimoAcierto
                  ? { kind: 'success', move: s.lastMove }
                  : { kind: 'error', move: null }
                : null
            }
          />
        </div>
        <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
          <div className="rounded-lg border border-subtle bg-surface p-4">
            <p className="m-0 font-mono text-xs text-tertiary">
              {/* radarServidos ya cuenta la posición actual una vez respondida
                  (se incrementa al jugar); sin esto, el cierre de la posición
                  20 mostraba "21 de 20". */}
              {t.diagnostico.radarProgreso
                .replace('{actual}', String(respondida ? s.radarServidos : s.radarServidos + 1))
                .replace('{total}', String(DIAGNOSTICO_RADAR_TOTAL))}
            </p>
          </div>
          {/* Mismo recorrido que el Radar de la sesión (RF-5.2): declarar la
              evaluación, después jugar. Que el diagnóstico se saltara este paso
              lo convertía en un instrumento distinto del que después mide el
              progreso. */}
          {s.radarSubPhase === 'evaluando' && (
            <EvalPicker selected={s.radarEvalGuess} onSelect={(v) => s.radarEval(v)} />
          )}
          {s.radarSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.diagnostico.radarConsigna}</p>}
          {s.radarSubPhase === 'confianza' && (
            <ConfidenceSlider onConfirm={(v) => void s.radarConfirmarConfianza(v)} />
          )}
          {s.radarSubPhase === 'feedback' && s.resultSaveStatus === 'inactivo' && (
            <FeedbackPanel
              acierto={s.radarUltimoAcierto ?? false}
              texto={s.radarFeedbackTexto}
              linea={s.radarLinea ?? undefined}
              jugadaCorrecta={s.radarJugadaCorrecta ?? ''}
              onContinuar={() => void s.radarContinuar()}
            />
          )}
          {s.resultSaveStatus === 'guardando' && (
            <div role="status" aria-live="polite" className="rounded-lg border border-subtle bg-surface p-4 text-sm text-secondary">
              {t.diagnostico.guardandoResultado}
            </div>
          )}
          {s.resultSaveStatus === 'error' && (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-error/35 bg-error-subtle p-4">
              <p className="m-0 text-sm text-primary">{t.diagnostico.errorResultado}</p>
              <button onClick={() => void s.radarContinuar()} className="btn-primary">
                {t.diagnostico.reintentarResultado}
              </button>
            </div>
          )}
          {s.resultSaveStatus !== 'guardando' && (
            <button onClick={() => s.pausar()} className="btn-secondary">
              {t.diagnostico.pausar}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function DiagnosticoPausado() {
  const s = useDiagnosticoStore();
  const etapa = s.pausedPhase === 'juego1' ? 1 : s.pausedPhase === 'juego2' ? 2 : 3;
  const nombreEtapa = s.pausedPhase === 'juego1'
    ? t.diagnostico.juego1Titulo
    : s.pausedPhase === 'juego2'
      ? t.diagnostico.juego2Titulo
      : t.radar.titulo;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <ProgresoGlobal etapa={etapa} />
      <DiagnosticoHeading>{t.diagnostico.pausadoTitulo}</DiagnosticoHeading>
      <p className="m-0 font-mono text-sm text-primary">{t.diagnostico.pausadoEtapa.replace('{etapa}', nombreEtapa)}</p>
      <p className="m-0 text-secondary">{t.diagnostico.pausadoTexto}</p>
      <button onClick={() => s.reanudar()} className="btn-primary">
        {t.diagnostico.reanudar}
      </button>
    </div>
  );
}

/** Una métrica de la línea base: valor grande, y debajo qué significa. El
 * "para qué sirve" no es decoración — es lo que separa una medición de un
 * puntaje, y sin eso el usuario no tiene cómo saber si la app le está
 * sirviendo. */
function MetricaBase({ label, valor, ayuda, pendiente = false }: { label: string; valor: string; ayuda: string; pendiente?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-elevated p-3">
      <span className="text-sm text-secondary">{label}</span>
      {pendiente ? (
        <span className="text-sm text-tertiary">{valor}</span>
      ) : (
        <strong className="font-display text-2xl font-medium leading-tight text-primary tabular-nums">{valor}</strong>
      )}
      <p className="m-0 text-xs text-secondary">{ayuda}</p>
    </div>
  );
}

function PerfilDeFugasCard({ lineaBase }: { lineaBase: LineaBaseDiagnostico }) {
  const lectura = lecturaPerfilDeFugas(lineaBase.perfilDeFugas);
  const fugas = fugasPrincipales(lineaBase.perfilDeFugas);
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading>{t.diagnostico.informeFugasTitulo}</SectionHeading>
      {fugas.length > 0 ? (
        <p className="m-0 text-primary">
          {t.diagnostico.informeFugaDestacada.replace('{tipo}', t.diagnostico.tiposRadar[fugas[0].tipo].toLowerCase())}
        </p>
      ) : (
        <p className="m-0 text-sm text-secondary">{t.diagnostico.informeFugasSinSenal}</p>
      )}
      {lectura.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 tabular-nums">
          {lectura.map((entrada) => (
            <li key={entrada.tipo} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-secondary">{t.diagnostico.tiposRadar[entrada.tipo]}</span>
              <span className="font-mono text-primary">
                {entrada.aciertos}/{entrada.total}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-xs text-tertiary">{t.diagnostico.informeFugasAyuda}</p>
    </section>
  );
}

const FUENTES_RATING: RatingExterno['fuente'][] = ['lichess', 'chesscom', 'otro'];

/** Captura del rating real (PRD §3.1). Es opcional y no bloquea nada: sin él
 * la app sigue funcionando, pero la métrica estrella se queda sin línea base
 * con la cual comparar. */
function RatingExternoCard() {
  const guardado = useDiagnosticoStore((state) => state.ratingExternoGuardado);
  const [valor, setValor] = useState('');
  const [fuente, setFuente] = useState<RatingExterno['fuente']>('lichess');
  const [error, setError] = useState(false);

  if (guardado) {
    return (
      <section className="flex flex-col gap-1 rounded-lg border border-success/35 bg-success-subtle p-4">
        <SectionHeading>{t.diagnostico.informeRatingTitulo}</SectionHeading>
        <p className="m-0 text-sm text-primary">
          {t.diagnostico.informeRatingGuardado.replace('{valor}', String(guardado.valor))}
        </p>
      </section>
    );
  }

  const numero = Number(valor);
  function guardar() {
    if (!Number.isInteger(numero) || numero < 100 || numero > 4000) {
      setError(true);
      return;
    }
    setError(false);
    void useDiagnosticoStore.getState().guardarRatingExterno(numero, fuente);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-info/40 bg-surface p-4">
      <div>
        <SectionHeading>{t.diagnostico.informeRatingTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.diagnostico.informeRatingTexto}</p>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.diagnostico.informeRatingFuente}</legend>
        <div className="flex flex-wrap gap-2">
          {FUENTES_RATING.map((f) => (
            <Chip key={f} selected={fuente === f} onClick={() => setFuente(f)}>
              {t.diagnostico.fuentesRating[f]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm text-secondary">
        {t.diagnostico.informeRatingLabel}
        <input
          type="number"
          min="100"
          max="4000"
          value={valor}
          onChange={(event) => setValor(event.target.value)}
          className="min-h-11 rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-primary"
        />
      </label>
      {error && <p role="alert" className="m-0 text-xs text-error-text">{t.diagnostico.informeRatingInvalido}</p>}
      <button onClick={guardar} disabled={valor.trim() === ''} className="btn-secondary">
        {t.diagnostico.informeRatingGuardar}
      </button>
    </section>
  );
}

/**
 * Informe de cierre del diagnóstico (RF-11.4). Antes acá solo se anunciaba la
 * banda: 20 a 40 minutos de medición terminaban en una etiqueta categórica,
 * mientras el acierto por tipo, la calibración y las partidas quedaban
 * guardadas sin que nadie las leyera. Ahora el diagnóstico devuelve la línea
 * base completa, dice qué mide cada número y por qué, y encamina al único paso
 * que puede completarla: analizar una partida propia.
 */
function Resultado() {
  const s = useDiagnosticoStore();
  const lineaBase = s.lineaBase;
  const fugas = lineaBase ? fugasPrincipales(lineaBase.perfilDeFugas) : [];
  const partidaId = lineaBase?.partidaIds.at(-1) ?? null;

  function salirAHoy() {
    // loadSummary cambia a `loading` de forma sincrónica. Salimos al skeleton
    // recuperable de Hoy sin mostrar la invitación vieja ni dejar el botón
    // bloqueado si IndexedDB demora.
    void useSessionStore.getState().loadSummary(true);
    s.volver();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <DiagnosticoHeading>{t.diagnostico.informeTitulo}</DiagnosticoHeading>
        <p className="m-0 text-secondary">{t.diagnostico.informeIntro}</p>
      </header>

      <section className="flex flex-col gap-1 rounded-lg border border-accent bg-surface p-4">
        <SectionHeading>{t.diagnostico.informeBandaLabel}</SectionHeading>
        <p className="m-0 font-display text-2xl font-medium text-accent">
          {s.bandaEstimada ? t.diagnostico.bandas[s.bandaEstimada] : ''}
        </p>
        <p className="m-0 text-sm text-secondary">{t.diagnostico.informeBandaAyuda}</p>
      </section>

      {lineaBase && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
            <SectionHeading>{t.diagnostico.informeLineaBaseTitulo}</SectionHeading>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricaBase
                label={t.diagnostico.informeRadarLabel}
                valor={t.diagnostico.informeRadarValor
                  .replace('{aciertos}', String(lineaBase.radarAciertos))
                  .replace('{total}', String(lineaBase.radarTotal))
                  .replace(
                    '{porcentaje}',
                    String(lineaBase.radarTotal > 0 ? Math.round((lineaBase.radarAciertos / lineaBase.radarTotal) * 100) : 0),
                  )}
                ayuda={t.diagnostico.informeRadarAyuda}
              />
              <MetricaBase
                label={t.diagnostico.informeBrierLabel}
                valor={lineaBase.brier === null ? t.diagnostico.informeBrierSinDatos : formatDecimal(lineaBase.brier, 2)}
                ayuda={t.diagnostico.informeBrierAyuda}
                pendiente={lineaBase.brier === null}
              />
              <MetricaBase
                label={t.diagnostico.informeErroresLabel}
                valor={t.diagnostico.informeErroresPendiente}
                ayuda={t.diagnostico.informeErroresAyuda}
                pendiente
              />
            </div>
          </section>

          <PerfilDeFugasCard lineaBase={lineaBase} />
        </>
      )}

      <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
        <SectionHeading>{t.diagnostico.informeRecomendacionesTitulo}</SectionHeading>
        <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-sm text-secondary">
          <li>{t.diagnostico.informeRecomendacionAnalisis}</li>
          <li>{t.diagnostico.informeRecomendacionPartida}</li>
          {fugas.length > 0 && (
            <li>
              {t.diagnostico.informeRecomendacionFuga.replace(
                '{tipo}',
                t.diagnostico.tiposRadar[fugas[0].tipo].toLowerCase(),
              )}
            </li>
          )}
        </ol>
      </section>

      <RatingExternoCard />

      <section className="flex flex-col gap-1 rounded-lg border border-info/40 bg-surface p-4">
        <SectionHeading>{t.diagnostico.informeMedicionTitulo}</SectionHeading>
        <p className="m-0 text-sm text-secondary">{t.diagnostico.informeMedicionTexto}</p>
      </section>

      <div className="flex flex-col gap-2">
        {partidaId && (
          <button
            onClick={() => {
              // El análisis vive dentro del Panel (AnalizarScreen se monta ahí
              // cuando el store deja de estar inactivo), así que hay que llevar
              // la ruta con la acción.
              void useSessionStore.getState().loadSummary(true);
              void useAnalysisStore.getState().iniciar(partidaId);
              s.volver();
              window.history.pushState(null, '', '#/panel');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="btn-primary"
          >
            {t.diagnostico.informeAnalizarCta}
          </button>
        )}
        <button onClick={salirAHoy} className={partidaId ? 'btn-secondary' : 'btn-primary'}>
          {t.diagnostico.informeEmpezar}
        </button>
      </div>
    </div>
  );
}
