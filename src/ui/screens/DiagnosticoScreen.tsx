// Diagnóstico inicial (RF-11.4): 2 partidas sin reloj contra el motor local en
// niveles escalonados → 20 posiciones del Radar → banda de Elo estimada. La
// pantalla de intro vive en HoyScreen (Portada la antepone a "Tu sesión de
// hoy"), así que este componente arranca directo en la primera partida. Las
// partidas reutilizan `useGameStore` (misma mecánica que la pantalla Jugar)
// en vez de duplicar el motor de turnos.
import { useEffect, useRef } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { BoardSkeleton } from '../components/BoardSkeleton';
import { PromotionDialog } from '../components/PromotionDialog';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { useDiagnosticoStore } from '../state/diagnosticoStore';
import { useGameStore } from '../state/gameStore';
import { useSessionStore } from '../state/sessionStore';
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
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
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
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
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
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-4">
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
          />
        </div>
        <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
          <div className="rounded-lg border border-subtle bg-surface p-4">
            <p className="m-0 font-mono text-xs text-tertiary">
              {/* radarServidos ya cuenta la posición actual durante el feedback
                  (se incrementa al responder); sin esto, el feedback de la
                  posición 20 mostraba "21 de 20". */}
              {t.diagnostico.radarProgreso
                .replace('{actual}', String(s.radarSubPhase === 'feedback' ? s.radarServidos : s.radarServidos + 1))
                .replace('{total}', '20')}
            </p>
          </div>
          {s.radarSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.diagnostico.radarConsigna}</p>}
          {s.radarSubPhase === 'feedback' && s.resultSaveStatus === 'inactivo' && (
            <FeedbackPanel
              acierto={s.radarUltimoAcierto ?? false}
              texto={s.radarFeedbackTexto}
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

function Resultado() {
  const s = useDiagnosticoStore();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <DiagnosticoHeading>{t.diagnostico.resultadoTitulo}</DiagnosticoHeading>
      <p className="m-0 font-display text-xl text-accent">
        {t.diagnostico.resultadoBanda.replace('{banda}', s.bandaEstimada ? t.diagnostico.bandas[s.bandaEstimada] : '')}
      </p>
      <p className="m-0 text-secondary">{t.diagnostico.resultadoTexto}</p>
      <button
        onClick={() => {
          // loadSummary cambia a `loading` de forma sincrónica. Salimos al
          // skeleton recuperable de Hoy sin mostrar la invitación vieja ni
          // dejar este botón bloqueado si IndexedDB demora.
          void useSessionStore.getState().loadSummary(true);
          s.volver();
        }}
        className="btn-primary"
      >
        {t.diagnostico.continuar}
      </button>
    </div>
  );
}
