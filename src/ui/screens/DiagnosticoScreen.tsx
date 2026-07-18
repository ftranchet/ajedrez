// Diagnóstico inicial (RF-11.4): 2 partidas cortas contra el motor local en
// niveles escalonados → 20 posiciones del Radar → banda de Elo estimada. La
// pantalla de intro vive en HoyScreen (Portada la antepone a "Tu sesión de
// hoy"), así que este componente arranca directo en la primera partida. Las
// partidas reutilizan `useGameStore` (misma mecánica que la pantalla Jugar)
// en vez de duplicar el motor de turnos.
import { useEffect } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
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
  if (phase === 'resultado') return <Resultado />;
  return null;
}

function Juego() {
  const diagPhase = useDiagnosticoStore((s) => s.phase);
  const g = useGameStore();

  useEffect(() => {
    if (g.phase === 'ended') useDiagnosticoStore.getState().registrarResultadoJuego();
  }, [g.phase]);

  const titulo = diagPhase === 'juego1' ? t.diagnostico.juego1Titulo : t.diagnostico.juego2Titulo;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={g.fen}
          orientation={g.playerColor}
          turn={g.turn}
          lastMove={g.lastMove}
          check={g.check}
          dests={g.dests}
          movableColor={g.phase === 'playing' && !g.thinking ? g.playerColor : null}
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
          <p className="m-0 font-mono text-xs text-tertiary">{titulo}</p>
          <p className="m-0 mt-1 font-display text-xl">{g.thinking ? t.jugar.pensando : t.jugar.teToca}</p>
        </div>
        <p className="m-0 text-sm text-secondary">{t.diagnostico.juegoConsigna}</p>
        {g.phase === 'playing' && (
          <button onClick={() => void g.resign()} className="btn-secondary">
            {t.jugar.rendirse}
          </button>
        )}
      </aside>
    </div>
  );
}

function RadarDiagnostico() {
  const s = useDiagnosticoStore();
  if (!s.radarItem) return null;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={s.fen}
          orientation={s.turn}
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
          <p className="m-0 mt-1 font-display text-xl">{t.radar.titulo}</p>
        </div>
        {s.radarSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.diagnostico.radarConsigna}</p>}
        {s.radarSubPhase === 'feedback' && (
          <FeedbackPanel
            acierto={s.radarUltimoAcierto ?? false}
            texto={s.radarFeedbackTexto}
            jugadaCorrecta={s.radarJugadaCorrecta ?? ''}
            onContinuar={() => void s.radarContinuar()}
          />
        )}
      </aside>
    </div>
  );
}

function Resultado() {
  const s = useDiagnosticoStore();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <h1 className="m-0 font-display text-3xl font-medium">{t.diagnostico.resultadoTitulo}</h1>
      <p className="m-0 font-display text-xl text-accent">
        {t.diagnostico.resultadoBanda.replace('{banda}', s.bandaEstimada ? t.diagnostico.bandas[s.bandaEstimada] : '')}
      </p>
      <p className="m-0 text-secondary">{t.diagnostico.resultadoTexto}</p>
      <button
        onClick={() => {
          s.volver();
          void useSessionStore.getState().loadSummary();
        }}
        className="btn-primary"
      >
        {t.diagnostico.continuar}
      </button>
    </div>
  );
}
