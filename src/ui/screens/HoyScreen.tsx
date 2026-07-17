// Pantalla principal: "Tu sesión de hoy" (RF-11.1, layout héroe validado en
// docs/prototipos/sesion-de-hoy.dc.html). Cola vencida → currículo vencido →
// Radar (E4 + E6 + E5 + E10), compuestos por el Prescriptor (E11) según la
// banda de Elo del perfil y el ajuste por fugas (RF-11.2, RF-11.3).
import { useEffect } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { EvalPicker } from '../components/EvalPicker';
import { ConfidenceSlider } from '../components/ConfidenceSlider';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { TRIAGE_SESSION_SIZE, useSessionStore } from '../state/sessionStore';
import { useDiagnosticoStore } from '../state/diagnosticoStore';
import { DiagnosticoScreen } from './DiagnosticoScreen';
import { t } from '../i18n/es';

export function HoyScreen() {
  const s = useSessionStore();
  const diagnosticoPhase = useDiagnosticoStore((d) => d.phase);

  useEffect(() => {
    if (s.phase === 'sinEmpezar' && s.dueCount === null) void s.loadSummary();
  }, [s]);

  if (diagnosticoPhase !== 'inactivo') return <DiagnosticoScreen />;
  if (s.phase === 'sinEmpezar' || s.phase === 'cargando') return <Portada />;
  if (s.phase === 'fin') return <Fin />;
  return <SesionActiva />;
}

// Minutos estimados por elemento de cada bloque: heurística simple v1 (RF-11.1
// pide una duración visible, no un cronómetro exacto) para mostrar "~N min"
// antes de empezar.
const MIN_POR_COLA = 0.75;
const MIN_POR_CURRICULO = 0.75;
const MIN_POR_RADAR = 1.25;
const DURACION_MINIMA_MIN = 15;

interface Bloque {
  texto: string;
  porque: string;
}

function bloquesDeLaSesion(s: ReturnType<typeof useSessionStore.getState>): Bloque[] {
  const bloques: Bloque[] = [];
  const vencidas = s.dueCount ?? 0;
  if (vencidas > 0) {
    bloques.push({
      texto: vencidas === 1 ? t.sesion.bloqueColaUno : t.sesion.bloqueColaOtro.replace('{n}', String(vencidas)),
      porque: vencidas === 1 ? t.sesion.cardsVencidas_uno : t.sesion.cardsVencidas_otro.replace('{n}', String(vencidas)),
    });
  }
  const curriculo = Math.min(s.curriculumDueCount ?? 0, s.dieta.curriculumMax);
  if (curriculo > 0) {
    bloques.push({ texto: t.sesion.bloqueCurriculo.replace('{n}', String(curriculo)), porque: t.sesion.bloqueCurriculoPorque });
  }
  if (s.dieta.triageActivo) {
    bloques.push({
      texto: t.sesion.bloqueTriage.replace('{n}', String(TRIAGE_SESSION_SIZE)),
      porque: t.sesion.bloqueTriagePorque,
    });
  }
  bloques.push({
    texto: t.sesion.bloqueRadar.replace('{n}', String(s.dieta.radarCount)),
    porque: s.dieta.ajusteFugas.categoria === 'tactico' ? t.sesion.bloqueRadarPorqueFuga : t.sesion.bloqueRadarPorque,
  });
  return bloques;
}

function Portada() {
  const s = useSessionStore();

  if (s.dueCount === null) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
        <p className="m-0 text-secondary">{t.sesion.cargando}</p>
      </div>
    );
  }

  if (!s.profile.diagnosticoCompletadoEn) return <DiagnosticoPrompt />;

  const bloques = bloquesDeLaSesion(s);
  const vencidas = s.dueCount ?? 0;
  const curriculo = Math.min(s.curriculumDueCount ?? 0, s.dieta.curriculumMax);
  const duracionMin = Math.max(
    DURACION_MINIMA_MIN,
    Math.round(vencidas * MIN_POR_COLA + curriculo * MIN_POR_CURRICULO + s.dieta.radarCount * MIN_POR_RADAR),
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
      {/* Bloque héroe (design system §4.1): tarjeta destacada, un solo botón primario */}
      <div className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs tracking-wider text-accent uppercase">{t.sesion.subtitulo}</span>
          <span className="font-mono text-xs text-tertiary">{t.sesion.duracion.replace('{n}', String(duracionMin))}</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {bloques.map((b) => (
            <li key={b.texto} className="flex flex-col">
              <span className="text-sm text-primary">{b.texto}</span>
              <span className="text-xs text-secondary">{b.porque}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => void useSessionStore.getState().start()}
          disabled={s.phase === 'cargando'}
          className="btn-primary"
        >
          {s.phase === 'cargando' ? t.sesion.cargando : t.sesion.empezar}
        </button>
      </div>
    </div>
  );
}

function DiagnosticoPrompt() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
      <div className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-5">
        <span className="font-mono text-xs tracking-wider text-accent uppercase">{t.diagnostico.titulo}</span>
        <p className="m-0 text-sm text-secondary">{t.diagnostico.introTexto}</p>
        <p className="m-0 text-xs text-tertiary">{t.diagnostico.introNota}</p>
        <button onClick={() => void useDiagnosticoStore.getState().empezarJuego1()} className="btn-primary">
          {t.diagnostico.empezar}
        </button>
        <button onClick={() => void useSessionStore.getState().start()} className="btn-secondary">
          {t.diagnostico.saltear}
        </button>
      </div>
    </div>
  );
}

function Fin() {
  const s = useSessionStore();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
      <h1 className="m-0 font-display text-3xl font-medium">{t.sesion.fin}</h1>
      <p className="m-0 text-secondary">{t.sesion.finTexto}</p>
      <button onClick={() => s.volver()} className="btn-primary">
        {t.sesion.volverAHoy}
      </button>
    </div>
  );
}

function SesionActiva() {
  const s = useSessionStore();
  const enCola = s.phase === 'cola';
  const enCurriculo = s.phase === 'curriculo';
  const enTriage = s.phase === 'triage';
  const jugando = enCola
    ? s.colaSubPhase === 'jugando'
    : enCurriculo
      ? s.curriculumSubPhase === 'jugando'
      : enTriage
        ? false // Triage es una decisión (RF-9.2), no una jugada en el tablero.
        : s.radarSubPhase === 'jugando';

  function onMove(from: string, to: string) {
    if (enCola) void s.colaUserMove(from as Square, to as Square);
    else if (enCurriculo) void s.curriculumUserMove(from as Square, to as Square);
    else if (!enTriage) void s.radarUserMove(from as Square, to as Square);
  }

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
          movableColor={jugando ? s.turn : null}
          onMove={onMove}
        />
      </div>

      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        {enCola ? <ColaPanel /> : enCurriculo ? <CurriculumPanel /> : enTriage ? <TriagePanel /> : <RadarPanel />}
      </aside>
    </div>
  );
}

function ColaPanel() {
  const s = useSessionStore();
  const total = s.colaCards.length;
  const actual = Math.min(s.colaIndex + 1, total);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="m-0 font-mono text-xs text-tertiary">
          {t.cola.progreso.replace('{actual}', String(actual)).replace('{total}', String(total))}
        </p>
        <p className="m-0 mt-1 font-display text-xl">{t.cola.titulo}</p>
      </div>
      {s.colaSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.cola.consigna}</p>}
      {s.colaSubPhase === 'feedback' && (
        <FeedbackPanel
          acierto={s.colaUltimoAcierto ?? false}
          texto={s.colaUltimoAcierto ? '' : `${t.radar.jugadaCorrecta}: ${s.colaJugadaCorrecta}`}
          jugadaCorrecta={s.colaJugadaCorrecta ?? ''}
          onContinuar={() => s.colaContinuar()}
        />
      )}
    </div>
  );
}

function CurriculumPanel() {
  const s = useSessionStore();
  const total = s.curriculumQueue.length;
  const actual = Math.min(s.curriculumIndex + 1, total);
  const item = s.curriculumQueue[s.curriculumIndex];

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="m-0 font-mono text-xs text-tertiary">
          {t.curriculo.progreso.replace('{actual}', String(actual)).replace('{total}', String(total))}
        </p>
        <p className="m-0 mt-1 font-display text-xl">{item?.nombre ?? t.curriculo.titulo}</p>
      </div>
      {s.curriculumSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.curriculo.consigna}</p>}
      {s.curriculumSubPhase === 'feedback' && (
        <FeedbackPanel
          acierto={s.curriculumUltimaLimpia ?? false}
          texto={s.curriculumUltimaLimpia ? '' : `${t.radar.jugadaCorrecta}: ${s.curriculumJugadaCorrecta}`}
          jugadaCorrecta={s.curriculumJugadaCorrecta ?? ''}
          onContinuar={() => s.curriculumContinuar()}
        />
      )}
    </div>
  );
}

function TriagePanel() {
  const s = useSessionStore();
  const total = s.triageQueue.length;
  const actual = Math.min(s.triageIndex + 1, total);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="m-0 font-mono text-xs text-tertiary">
          {t.triage.progreso.replace('{actual}', String(actual)).replace('{total}', String(total))}
        </p>
        <p className="m-0 mt-1 font-display text-xl">{t.triage.titulo}</p>
      </div>
      {s.triageSubPhase === 'decidiendo' && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-secondary">{t.triage.consigna}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => s.triageDecidir('calcular')} className="btn-secondary">
              {t.triage.calcular}
            </button>
            <button onClick={() => s.triageDecidir('alcanza')} className="btn-secondary">
              {t.triage.alcanza}
            </button>
          </div>
        </div>
      )}
      {s.triageSubPhase === 'feedback' && (
        <FeedbackPanel
          acierto={s.triageUltimaCorrecta ?? false}
          texto={s.triageDecisionCorrecta === 'calcular' ? t.triage.respuestaCalcular : t.triage.respuestaAlcanza}
          jugadaCorrecta={s.triageDecisionCorrecta === 'calcular' ? t.triage.calcular : t.triage.alcanza}
          onContinuar={() => s.triageContinuar()}
        />
      )}
    </div>
  );
}

function RadarPanel() {
  const s = useSessionStore();
  const actual = Math.min(s.radarServidos + 1, s.dieta.radarCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="m-0 font-mono text-xs text-tertiary">
          {t.radar.progreso.replace('{actual}', String(actual)).replace('{total}', String(s.dieta.radarCount))}
        </p>
        <p className="m-0 mt-1 font-display text-xl">{t.radar.titulo}</p>
      </div>

      {s.radarSubPhase === 'evaluando' && (
        <EvalPicker selected={s.radarEvalGuess} onSelect={(v) => s.radarEval(v)} />
      )}
      {s.radarSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.radar.consignaJugada}</p>}
      {s.radarSubPhase === 'candidata' && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-secondary">{t.radar.candidataPregunta}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => s.radarCandidataDecidir(true)} className="btn-secondary">
              {t.radar.candidataSi}
            </button>
            <button onClick={() => s.radarCandidataDecidir(false)} className="btn-secondary">
              {t.radar.candidataNo}
            </button>
          </div>
        </div>
      )}
      {s.radarSubPhase === 'confianza' && <ConfidenceSlider onConfirm={(v) => void s.radarConfirmarConfianza(v)} />}
      {s.radarSubPhase === 'feedback' && (
        <FeedbackPanel
          acierto={s.radarUltimoAcierto ?? false}
          texto={s.radarFeedbackTexto}
          jugadaCorrecta={s.radarJugadaCorrecta ?? ''}
          onContinuar={() => void s.radarContinuar()}
        />
      )}
    </div>
  );
}
