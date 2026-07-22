// Pantalla principal: "Tu sesión de hoy" (RF-11.1, layout héroe validado en
// docs/prototipos/sesion-de-hoy.dc.html). Cola vencida → currículo vencido →
// Radar (E4 + E6 + E5 + E10), compuestos por el Prescriptor (E11) según la
// banda de Elo del perfil y el ajuste por fugas (RF-11.2, RF-11.3).
import { useEffect, useRef } from 'react';
import type { Square } from 'chess.js';
import { Board, type BoardFeedback } from '../components/Board';
import { EvalPicker } from '../components/EvalPicker';
import { ConfidenceSlider } from '../components/ConfidenceSlider';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { WeeklyPlanCard } from '../components/WeeklyPlanCard';
import { ReminderCard } from '../components/ReminderCard';
import { SensoryPreferencesCard } from '../components/SensoryPreferencesCard';
import { SectionHeading } from '../components/SectionHeading';
import { Transition } from '../components/Transition';
import { TRIAGE_SESSION_SIZE, useSessionStore } from '../state/sessionStore';
import { useDiagnosticoStore } from '../state/diagnosticoStore';
import { useGameStore } from '../state/gameStore';
import { DiagnosticoScreen } from './DiagnosticoScreen';
import { nivelCiegas } from '../../core/curriculum';
import type { PlanSemanal, ReminderConfig, SensoryPreferences } from '../../core/types';
import { normalizeSensoryPreferences } from '../../core/sensory';
import { profileRepo } from '../../services/storage/profileRepo';
import { playMoveCue, playResolutionCue, unlockSoundFeedback } from '../../services/sensory/feedback';
import { useSlowLoading } from '../hooks/useSlowLoading';
import { t } from '../i18n/es';

export function HoyScreen() {
  const sessionPhase = useSessionStore((s) => s.phase);
  const summaryStatus = useSessionStore((s) => s.summaryStatus);
  const diagnosticoPhase = useDiagnosticoStore((d) => d.phase);

  useEffect(() => {
    if (sessionPhase === 'sinEmpezar' && summaryStatus === 'idle') {
      void useSessionStore.getState().loadSummary();
    }
  }, [sessionPhase, summaryStatus]);

  if (diagnosticoPhase !== 'inactivo') return <DiagnosticoScreen />;
  if (sessionPhase === 'sinEmpezar' || sessionPhase === 'cargando') return <Portada />;
  if (sessionPhase === 'fin') return <Fin />;
  return <SesionActiva />;
}

// Minutos estimados por elemento de cada bloque: heurística simple v1 (RF-11.1
// pide una duración visible, no un cronómetro exacto) para mostrar "~N min"
// antes de empezar.
const MIN_POR_COLA = 0.75;
const MIN_POR_CURRICULO = 0.75;
const MIN_POR_TRIAGE = 0.5;
const MIN_POR_RADAR = 1.25;
const DURACION_MINIMA_MIN = 15;

interface Bloque {
  texto: string;
  porque: string;
  minutos: number;
}

function bloquesDeLaSesion(s: ReturnType<typeof useSessionStore.getState>): Bloque[] {
  const bloques: Bloque[] = [];
  const vencidas = s.dueCount ?? 0;
  if (vencidas > 0) {
    bloques.push({
      texto: vencidas === 1 ? t.sesion.bloqueColaUno : t.sesion.bloqueColaOtro.replace('{n}', String(vencidas)),
      porque: vencidas === 1 ? t.sesion.cardsVencidas_uno : t.sesion.cardsVencidas_otro.replace('{n}', String(vencidas)),
      minutos: Math.max(1, Math.round(vencidas * MIN_POR_COLA)),
    });
  }
  const curriculo = Math.min(s.curriculumDueCount ?? 0, s.dieta.curriculumMax);
  if (curriculo > 0) {
    bloques.push({
      texto: t.sesion.bloqueCurriculo.replace('{n}', String(curriculo)),
      porque: t.sesion.bloqueCurriculoPorque,
      minutos: Math.max(1, Math.round(curriculo * MIN_POR_CURRICULO)),
    });
  }
  if (s.dieta.triageActivo) {
    bloques.push({
      texto: t.sesion.bloqueTriage.replace('{n}', String(TRIAGE_SESSION_SIZE)),
      porque: t.sesion.bloqueTriagePorque,
      minutos: Math.max(1, Math.round(TRIAGE_SESSION_SIZE * MIN_POR_TRIAGE)),
    });
  }
  bloques.push({
    texto: t.sesion.bloqueRadar.replace('{n}', String(s.dieta.radarCount)),
    porque: s.dieta.ajusteFugas.categoria === 'tactico' ? t.sesion.bloqueRadarPorqueFuga : t.sesion.bloqueRadarPorque,
    minutos: Math.max(1, Math.round(s.dieta.radarCount * MIN_POR_RADAR)),
  });
  return bloques;
}

// Nombres en español para el encabezado de fecha (font-mono, ver prototipo
// docs/prototipos/sesion-de-hoy.dc.html). Se arman a mano en vez de usar
// Intl.DateTimeFormat porque el formato con coma que da 'es-AR' no coincide
// con el patrón validado ("JUEVES 16 DE JULIO").
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fechaDeHoy(): string {
  const d = new Date();
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function Portada() {
  const s = useSessionStore();
  const loadingSlow = useSlowLoading(s.summaryStatus === 'idle' || s.summaryStatus === 'loading');

  async function saveWeeklyPlan(planSemanal: PlanSemanal) {
    const profile = await profileRepo.update({ planSemanal });
    useSessionStore.setState({ profile });
  }

  async function saveReminder(recordatorio: ReminderConfig) {
    const profile = await profileRepo.update({ recordatorio });
    useSessionStore.setState({ profile });
  }

  async function saveSensoryPreferences(preferenciasSensoriales: SensoryPreferences) {
    const profile = await profileRepo.update({ preferenciasSensoriales });
    useSessionStore.setState({ profile });
  }

  if (s.summaryStatus === 'error') return <PortadaError />;
  if (s.summaryStatus !== 'ready' || s.dueCount === null) return <PortadaLoading slow={loadingSlow} />;

  if (!s.profile.diagnosticoCompletadoEn) return <DiagnosticoPrompt />;

  const bloques = bloquesDeLaSesion(s);
  const [siguiente, ...resto] = bloques;
  const duracionMin = Math.max(DURACION_MINIMA_MIN, bloques.reduce((total, b) => total + b.minutos, 0));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs tracking-wider text-tertiary uppercase">{fechaDeHoy()}</span>
        <div className="flex items-baseline justify-between">
          <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
          <span className="font-mono text-sm text-secondary">{t.sesion.minutos.replace('{n}', String(duracionMin))}</span>
        </div>
      </div>

      {/* Bloque héroe (design system §4.1): el siguiente bloque, destacado con
          borde accent y el único botón primario de la pantalla. */}
      <div className="flex min-h-56 flex-col gap-3 rounded-lg border border-accent bg-surface p-5">
        <span className="font-mono text-xs tracking-wider text-accent uppercase">
          {t.sesion.siguiente} · {t.sesion.minutos.replace('{n}', String(siguiente.minutos))}
        </span>
        <p className="m-0 font-display text-2xl font-medium">{siguiente.texto}</p>
        <p className="m-0 text-sm text-secondary">{siguiente.porque}</p>
        {s.startError && <p role="alert" className="m-0 text-sm text-error-text">{t.hoy.inicioError}</p>}
        <button
          onClick={() => {
            unlockSoundFeedback(normalizeSensoryPreferences(s.profile.preferenciasSensoriales).sonido);
            void useSessionStore.getState().start();
          }}
          disabled={s.phase === 'cargando'}
          className="btn-primary"
        >
          {s.phase === 'cargando' ? t.sesion.cargando : t.sesion.empezar}
        </button>
      </div>

      {/* Bloques restantes: tarjetas secundarias debajo del héroe. */}
      {resto.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {resto.map((b) => (
            <li key={b.texto} className="flex items-center gap-3 rounded-md border border-subtle bg-surface p-3">
              <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-base leading-none">
                <span className="font-mono text-base font-semibold text-primary">{b.minutos}</span>
                <span className="mt-0.5 font-mono text-[0.5625rem] tracking-wider text-tertiary uppercase">{t.sesion.unidadMin}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-primary">{b.texto}</span>
                <span className="text-xs text-secondary">{b.porque}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-col gap-1 border-t border-subtle pt-4">
        <SectionHeading>{t.hoy.constanciaTitulo}</SectionHeading>
        <p className="m-0 text-sm text-secondary">{t.hoy.constanciaTexto}</p>
      </div>

      <WeeklyPlanCard
        records={s.sessions ?? []}
        profile={s.profile}
        editable
        onSave={saveWeeklyPlan}
      />

      <ReminderCard config={s.profile.recordatorio} onSave={saveReminder} />

      <SensoryPreferencesCard
        preferences={s.profile.preferenciasSensoriales}
        onSave={saveSensoryPreferences}
      />
    </div>
  );
}

function PortadaLoading({ slow }: { slow: boolean }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <span role="status" className="sr-only">
        {slow ? t.hoy.cargaLenta : t.sesion.cargando}
      </span>
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs tracking-wider text-tertiary uppercase">{fechaDeHoy()}</span>
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
            <span aria-hidden="true" className="h-4 w-12 rounded-sm bg-elevated" />
          </div>
        </div>
        <section className="flex min-h-56 flex-col justify-between gap-4 rounded-lg border border-accent/45 bg-surface p-5">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs tracking-wider text-accent uppercase">{t.sesion.cargando}</span>
            <div aria-hidden="true" className="flex flex-col gap-2">
              <span className="h-7 w-4/5 rounded-sm bg-elevated" />
              <span className="h-4 w-full rounded-sm bg-elevated" />
              <span className="h-4 w-2/3 rounded-sm bg-elevated" />
            </div>
            <p className="m-0 text-sm text-secondary">{t.hoy.cargaDetalle}</p>
          </div>
          {slow && (
            <div className="flex flex-col gap-3 border-t border-subtle pt-3">
              <p className="m-0 text-sm text-secondary">{t.hoy.cargaLenta}</p>
              <button type="button" onClick={() => void useSessionStore.getState().loadSummary(true)} className="btn-secondary">
                {t.hoy.reintentar}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PortadaError() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
      <section role="alert" className="flex flex-col gap-3 rounded-lg border border-error/35 bg-error-subtle p-5">
        <p className="m-0 font-display text-xl font-medium">{t.hoy.cargaErrorTitulo}</p>
        <p className="m-0 text-sm text-secondary">{t.hoy.cargaErrorTexto}</p>
        <button type="button" onClick={() => void useSessionStore.getState().loadSummary(true)} className="btn-secondary">
          {t.hoy.reintentar}
        </button>
      </section>
    </div>
  );
}

function DiagnosticoPrompt() {
  // useGameStore es compartido con la pantalla Jugar: si hay una partida en
  // curso ahí (el store zustand persiste aunque esa pestaña esté
  // desmontada), empezar el diagnóstico la resetearía sin aviso al llamar
  // useGameStore().reset() (RF-1.3). Se deshabilita el botón y se explica
  // por qué, en vez de perder la partida en silencio.
  const partidaEnCurso = useGameStore((g) => g.phase === 'playing' || g.phase === 'loading');
  const sessionPhase = useSessionStore((s) => s.phase);
  const startError = useSessionStore((s) => s.startError);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
      <section className="flex flex-col gap-4 rounded-lg border border-accent bg-surface p-5">
        <span className="font-mono text-xs tracking-wider text-accent uppercase">{t.diagnostico.titulo}</span>
        <div>
          <h2 className="m-0 font-display text-2xl font-medium">{t.diagnostico.bienvenidaTitulo}</h2>
          <p className="m-0 mt-2 text-sm text-secondary">{t.diagnostico.introTexto}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.diagnostico.resumenLabel}>
          {[t.diagnostico.duracion, t.diagnostico.etapas, t.diagnostico.pausable].map((texto) => (
            <span key={texto} className="rounded-full border border-subtle bg-elevated px-3 py-1.5 text-xs text-secondary">{texto}</span>
          ))}
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {[
            [t.diagnostico.etapa1Titulo, t.diagnostico.etapa1Texto],
            [t.diagnostico.etapa2Titulo, t.diagnostico.etapa2Texto],
            [t.diagnostico.etapa3Titulo, t.diagnostico.etapa3Texto],
          ].map(([titulo, texto], index) => (
            <li key={titulo} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/50 font-mono text-xs text-accent">{index + 1}</span>
              <span className="flex flex-col gap-0.5">
                <strong className="text-sm font-semibold text-primary">{titulo}</strong>
                <span className="text-xs text-secondary">{texto}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="rounded-md border border-info/35 bg-info-subtle p-3">
          <p className="m-0 text-sm font-semibold text-primary">{t.diagnostico.privacidadTitulo}</p>
          <p className="m-0 mt-1 text-xs text-secondary">{t.diagnostico.privacidadTexto}</p>
        </div>
        {partidaEnCurso && <p className="m-0 text-xs text-error-text">{t.diagnostico.partidaEnCurso}</p>}
        {startError && <p role="alert" className="m-0 text-xs text-error-text">{t.hoy.inicioError}</p>}
        <button
          onClick={() => void useDiagnosticoStore.getState().empezarJuego1()}
          disabled={partidaEnCurso}
          className="btn-primary"
        >
          {t.diagnostico.empezar}
        </button>
        <button
          onClick={() => {
            unlockSoundFeedback(normalizeSensoryPreferences(useSessionStore.getState().profile.preferenciasSensoriales).sonido);
            void useSessionStore.getState().start();
          }}
          disabled={sessionPhase === 'cargando'}
          className="btn-secondary"
        >
          {sessionPhase === 'cargando' ? t.sesion.cargando : t.diagnostico.saltear}
        </button>
      </section>
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
  const sensoryPreferences = normalizeSensoryPreferences(s.profile.preferenciasSensoriales);
  const soundEnabled = sensoryPreferences.sonido;
  const vibrationEnabled = sensoryPreferences.vibracion;
  const boardFeedback = feedbackForSession(s);
  const feedbackKey = feedbackKeyForSession(s, boardFeedback);
  const previousFeedbackKey = useRef(feedbackKey);

  useEffect(() => {
    if (feedbackKey && previousFeedbackKey.current !== feedbackKey) {
      playResolutionCue({ sonido: soundEnabled, vibracion: vibrationEnabled });
    }
    previousFeedbackKey.current = feedbackKey;
  }, [feedbackKey, soundEnabled, vibrationEnabled]);

  function onMove(from: string, to: string) {
    playMoveCue(soundEnabled);
    if (enCola) void s.colaUserMove(from as Square, to as Square);
    else if (enCurriculo) void s.curriculumUserMove(from as Square, to as Square);
    else if (!enTriage) void s.radarUserMove(from as Square, to as Square);
  }

  // Modificador a ciegas (RF-6.5): solo mientras se está jugando un patrón
  // del currículo con acierto sostenido por encima del 80%; en feedback se
  // ve la posición entera, para poder revisarla.
  const curriculumItemActual = enCurriculo ? s.curriculumQueue[s.curriculumIndex] : null;
  const blindMode =
    enCurriculo && s.curriculumSubPhase === 'jugando' && curriculumItemActual
      ? nivelCiegas(s.curriculumProgressById.get(curriculumItemActual.id))
      : 'normal';

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
      <SessionHeader />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
          <Board
            fen={s.fen}
            orientation={s.boardOrientation}
            turn={s.turn}
            lastMove={s.lastMove}
            check={s.check}
            dests={s.dests}
            movableColor={jugando ? s.turn : null}
            onMove={onMove}
            blindMode={blindMode}
            feedback={boardFeedback}
          />
        </div>

        <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
          <Transition phaseKey={panelPhaseKey(s)} label={t.sesion.panelActual} className="min-h-64">
            {enCola ? <ColaPanel /> : enCurriculo ? <CurriculumPanel /> : enTriage ? <TriagePanel /> : <RadarPanel />}
          </Transition>
        </aside>
      </div>
    </div>
  );
}

function feedbackForSession(s: ReturnType<typeof useSessionStore.getState>): BoardFeedback {
  if (s.phase === 'cola' && s.colaSubPhase === 'feedback') {
    return s.colaUltimoAcierto
      ? { kind: 'success', move: s.lastMove }
      : { kind: 'error', move: null };
  }
  if (s.phase === 'curriculo' && s.curriculumSubPhase === 'feedback') {
    return s.curriculumUltimaLimpia
      ? { kind: 'success', move: s.lastMove }
      : { kind: 'error', move: null };
  }
  if (s.phase === 'triage' && s.triageSubPhase === 'feedback') {
    return s.triageUltimaCorrecta
      ? { kind: 'success', move: null }
      : { kind: 'error', move: null };
  }
  // El resultado del Radar ya existe durante `confianza`; gatear por la
  // subfase evita filtrarlo antes de que el usuario se calibre.
  if (s.phase === 'radar' && s.radarSubPhase === 'feedback') {
    return s.radarUltimoAcierto
      ? { kind: 'success', move: s.lastMove }
      : { kind: 'error', move: null };
  }
  return null;
}

function feedbackKeyForSession(
  s: ReturnType<typeof useSessionStore.getState>,
  feedback: BoardFeedback,
): string | null {
  if (!feedback) return null;
  if (s.phase === 'cola') return `cola:${s.colaIndex}`;
  if (s.phase === 'curriculo') return `curriculo:${s.curriculumIndex}`;
  if (s.phase === 'triage') return `triage:${s.triageIndex}`;
  if (s.phase === 'radar') return `radar:${s.radarItem?.id ?? 'sin-item'}`;
  return null;
}

function panelPhaseKey(s: ReturnType<typeof useSessionStore.getState>): string {
  if (s.phase === 'cola') return `cola:${s.colaIndex}:${s.colaSubPhase}`;
  if (s.phase === 'curriculo') return `curriculo:${s.curriculumIndex}:${s.curriculumSubPhase}`;
  if (s.phase === 'triage') return `triage:${s.triageIndex}:${s.triageSubPhase}`;
  if (s.phase === 'radar') return `radar:${s.radarItem?.id ?? 'sin-item'}:${s.radarSubPhase}`;
  return s.phase;
}

// Encabezado siempre visible durante la sesión: la salida a Hoy que antes no
// existía. A la izquierda y sin repreguntar —lo ya respondido queda guardado
// ítem por ítem; volver() solo marca la sesión como abandonada, no borra nada
// resuelto—.
function SessionHeader() {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => useSessionStore.getState().volver()}
        className="flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-secondary hover:text-primary"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {t.sesion.salir}
      </button>
      <span className="font-mono text-xs tracking-wider text-tertiary uppercase">{t.sesion.enSesion}</span>
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
          texto=""
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
  const nivel = s.curriculumSubPhase === 'jugando' && item ? nivelCiegas(s.curriculumProgressById.get(item.id)) : 'normal';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="m-0 font-mono text-xs text-tertiary">
          {t.curriculo.progreso.replace('{actual}', String(actual)).replace('{total}', String(total))}
        </p>
        <p className="m-0 mt-1 font-display text-xl">{item?.nombre ?? t.curriculo.titulo}</p>
      </div>
      {s.curriculumSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.curriculo.consigna}</p>}
      {nivel === 'fantasma' && <p className="m-0 text-xs text-tertiary">{t.curriculo.ciegasFantasma}</p>}
      {nivel === 'coordenadas' && <p className="m-0 text-xs text-tertiary">{t.curriculo.ciegasCoordenadas}</p>}
      {s.curriculumSubPhase === 'feedback' && (
        <FeedbackPanel
          acierto={s.curriculumUltimaLimpia ?? false}
          texto=""
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
  // radarServidos ya cuenta la posición actual cuando se está en feedback
  // (se incrementa al resolver); antes de eso, la posición en curso es la
  // siguiente al contador.
  const actual = Math.min(s.radarSubPhase === 'feedback' ? s.radarServidos : s.radarServidos + 1, s.dieta.radarCount);

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
