// Pantalla principal: "Tu sesión de hoy" (RF-11.1, layout héroe validado en
// docs/prototipos/sesion-de-hoy.dc.html). Cola vencida → currículo vencido →
// Radar (E4 + E6 + E5 + E10), compuestos por el Prescriptor (E11) según la
// banda de Elo del perfil y el ajuste por fugas (RF-11.2, RF-11.3).
import { useEffect, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import type { DailyAssignment, SessionBlockType, TipoRadar } from '../../core/types';
import { bloquesHechosHoy } from '../../core/session';
import { planEmpezado } from '../../core/dailyAssignment';
import { minutosDeBloque } from '../../core/duracion';
import type { DietaSesion } from '../../core/prescriptor';
import { prescripcionesDe } from '../../core/prescripcionesExternas';
import type { PrescripcionExterna } from '../../core/prescripcionesExternas';
import { Board, type BoardFeedback } from '../components/Board';
import { EvalPicker } from '../components/EvalPicker';
import { ConfidenceSlider } from '../components/ConfidenceSlider';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { WeeklyPlanCard } from '../components/WeeklyPlanCard';
import { SectionHeading } from '../components/SectionHeading';
import { Transition } from '../components/Transition';
import { TRIAGE_SESSION_SIZE, useSessionStore } from '../state/sessionStore';
import { useDiagnosticoStore } from '../state/diagnosticoStore';
import { useGameStore } from '../state/gameStore';
import { DiagnosticoScreen } from './DiagnosticoScreen';
import { nivelCiegas } from '../../core/curriculum';
import { readBlindTrainingEnabled } from '../trainingPrefs';
import { normalizeSensoryPreferences } from '../../core/sensory';
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

  // Al montar (cada navegación a Hoy): revalidar el resumen aunque ya esté
  // listo. Un final jugado, un Stoyko o una partida analizada en otra pantalla
  // no tocan este store, y la portada conservaba contadores y prescripciones
  // de la visita anterior como si nada hubiera pasado. 'revalidar' no pasa
  // por 'loading': se ve el resumen viejo hasta que llega el fresco, sin
  // parpadeo.
  useEffect(() => {
    const s = useSessionStore.getState();
    if (s.phase === 'sinEmpezar' && s.summaryStatus === 'ready') {
      void s.loadSummary('revalidar');
    }
  }, []);

  if (diagnosticoPhase !== 'inactivo') return <DiagnosticoScreen />;
  if (sessionPhase === 'sinEmpezar' || sessionPhase === 'cargando') return <Portada />;
  if (sessionPhase === 'fin') return <Fin />;
  return <SesionActiva />;
}

// La estimación de duración vive en core/duracion.ts: dejó de ser
// presentación cuando el presupuesto del plan semanal empezó a compararla con
// los minutos que el usuario declaró tener.
const DURACION_MINIMA_MIN = 15;

interface Bloque {
  tipo: SessionBlockType;
  texto: string;
  porque: string;
  explicacion: string;
  minutos: number;
}

// Arranca la sesión completa (sin `tipo`) o un bloque suelto (RF-11.5).
// Desbloquea el audio dentro del gesto del usuario (autoplay).
function iniciarSesion(sonido: boolean, tipo?: SessionBlockType) {
  unlockSoundFeedback(sonido);
  void useSessionStore.getState().start(tipo);
}

function MinBadge({ minutos }: { minutos: number }) {
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-base leading-none">
      <span className="font-mono text-base font-semibold text-primary">{minutos}</span>
      <span className="mt-0.5 font-mono text-[0.5625rem] tracking-wider text-tertiary uppercase">{t.sesion.unidadMin}</span>
    </span>
  );
}

// Una fila del acordeón: cerrada (compacta, tocable) o abierta (recuadro accent
// con explicación + botón). Un bloque hecho hoy queda cerrado para el plan —
// la sesión guiada no lo vuelve a servir— y ofrece "Practicar de nuevo" como
// acción secundaria explícita que no cuenta para el plan.
function BloqueAccordion({
  bloque,
  esSiguiente,
  hecho,
  accionLabel,
  abierto,
  cargando,
  startError,
  onAbrir,
  onEmpezar,
}: {
  bloque: Bloque;
  esSiguiente: boolean;
  hecho: boolean;
  accionLabel: string;
  abierto: boolean;
  cargando: boolean;
  startError: boolean;
  onAbrir: () => void;
  onEmpezar: () => void;
}) {
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={false}
        className="flex w-full items-center gap-3 rounded-md border border-subtle bg-surface p-3 text-left transition-colors duration-[120ms] hover:border-strong hover:bg-elevated"
      >
        <MinBadge minutos={bloque.minutos} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-primary">{bloque.texto}</span>
          <span className="text-xs text-secondary">{bloque.porque}</span>
        </span>
        {hecho ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
            {t.sesion.hechoHoy}
          </span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-auto shrink-0 text-tertiary">
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs tracking-wider text-accent uppercase">
          {esSiguiente ? `${t.sesion.siguiente} · ` : ''}{t.sesion.minutos.replace('{n}', String(bloque.minutos))}
        </span>
        {hecho && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
            {t.sesion.hechoHoy}
          </span>
        )}
      </div>
      <p className="m-0 font-display text-2xl font-medium">{bloque.texto}</p>
      <p className="m-0 text-sm text-secondary">{bloque.porque}</p>
      <p className="m-0 text-sm text-secondary">{bloque.explicacion}</p>
      {hecho && <p className="m-0 text-xs text-tertiary">{t.sesion.hechoHoyRepetir}</p>}
      {startError && <p role="alert" className="m-0 text-sm text-error-text">{t.hoy.inicioError}</p>}
      <button onClick={onEmpezar} disabled={cargando} className={hecho ? 'btn-secondary' : 'btn-primary'}>
        {cargando ? t.sesion.cargando : accionLabel}
      </button>
    </div>
  );
}

/**
 * Bloques de la portada leídos del plan del día (RF-11.1): un bloque pendiente
 * muestra lo que FALTA (reanudar no repite), y uno completado muestra lo que
 * fue, marcado como hecho. `bloquesDeLaSesion` queda como respaldo para el
 * instante en que el resumen todavía no trajo el plan.
 */
/**
 * Por qué el Radar viene como viene. La fuga por tipo (RF-11.2) es más
 * específica que el refuerzo por errores tácticos, así que manda cuando hay
 * las dos; sin ninguna, el porqué de siempre.
 */
function porqueRadar(dieta: DietaSesion, fugas: TipoRadar[]): string {
  if (fugas.length > 0) {
    return t.sesion.bloqueRadarPorqueTipo.replace('{tipo}', t.diagnostico.tiposRadar[fugas[0]].toLowerCase());
  }
  return dieta.ajusteFugas.categoria === 'tactico' ? t.sesion.bloqueRadarPorqueFuga : t.sesion.bloqueRadarPorque;
}

function bloquesDelPlan(assignment: DailyAssignment, dieta: DietaSesion, fugas: TipoRadar[]): Bloque[] {
  return assignment.bloques.map((bloque) => {
    const n = bloque.estado === 'completado'
      ? bloque.planificados
      : Math.max(1, bloque.planificados - bloque.completados);
    switch (bloque.tipo) {
      case 'cola':
        return {
          tipo: 'cola' as const,
          texto: n === 1 ? t.sesion.bloqueColaUno : t.sesion.bloqueColaOtro.replace('{n}', String(n)),
          porque: t.sesion.bloqueColaPorque,
          explicacion: t.sesion.bloqueColaExplica,
          minutos: minutosDeBloque('cola', n),
        };
      case 'curriculo':
        return {
          tipo: 'curriculo' as const,
          texto: t.sesion.bloqueCurriculo.replace('{n}', String(n)),
          porque: t.sesion.bloqueCurriculoPorque,
          explicacion: t.sesion.bloqueCurriculoExplica,
          minutos: minutosDeBloque('curriculo', n),
        };
      case 'triage':
        return {
          tipo: 'triage' as const,
          texto: t.sesion.bloqueTriage.replace('{n}', String(n)),
          porque: t.sesion.bloqueTriagePorque,
          explicacion: t.sesion.bloqueTriageExplica,
          minutos: minutosDeBloque('triage', n),
        };
      case 'radar':
        return {
          tipo: 'radar' as const,
          texto: t.sesion.bloqueRadar.replace('{n}', String(n)),
          porque: porqueRadar(dieta, fugas),
          explicacion: t.sesion.bloqueRadarExplica,
          minutos: minutosDeBloque('radar', n),
        };
    }
  });
}

function bloquesDeLaSesion(s: ReturnType<typeof useSessionStore.getState>): Bloque[] {
  const bloques: Bloque[] = [];
  const vencidas = s.dueCount ?? 0;
  if (vencidas > 0) {
    bloques.push({
      tipo: 'cola',
      texto: vencidas === 1 ? t.sesion.bloqueColaUno : t.sesion.bloqueColaOtro.replace('{n}', String(vencidas)),
      porque: t.sesion.bloqueColaPorque,
      explicacion: t.sesion.bloqueColaExplica,
      minutos: minutosDeBloque('cola', vencidas),
    });
  }
  const curriculo = Math.min(s.curriculumDueCount ?? 0, s.dieta.curriculumMax);
  if (curriculo > 0) {
    bloques.push({
      tipo: 'curriculo',
      texto: t.sesion.bloqueCurriculo.replace('{n}', String(curriculo)),
      porque: t.sesion.bloqueCurriculoPorque,
      explicacion: t.sesion.bloqueCurriculoExplica,
      minutos: minutosDeBloque('curriculo', curriculo),
    });
  }
  if (s.dieta.criterioActivo) {
    bloques.push({
      tipo: 'triage',
      texto: t.sesion.bloqueTriage.replace('{n}', String(TRIAGE_SESSION_SIZE)),
      porque: t.sesion.bloqueTriagePorque,
      explicacion: t.sesion.bloqueTriageExplica,
      minutos: minutosDeBloque('triage', TRIAGE_SESSION_SIZE),
    });
  }
  bloques.push({
    tipo: 'radar',
    texto: t.sesion.bloqueRadar.replace('{n}', String(s.dieta.radarCount)),
    porque: porqueRadar(s.dieta, s.radarFugas),
    explicacion: t.sesion.bloqueRadarExplica,
    minutos: minutosDeBloque('radar', s.dieta.radarCount),
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
  // Bloque abierto del acordeón; null = usar el primero pendiente por defecto.
  const [abierto, setAbierto] = useState<SessionBlockType | null>(null);

  if (s.summaryStatus === 'error') return <PortadaError />;
  if (s.summaryStatus !== 'ready' || s.dueCount === null) return <PortadaLoading slow={loadingSlow} />;

  if (!s.profile.diagnosticoCompletadoEn) return <DiagnosticoPrompt />;

  // El plan del día manda (RF-11.1): bloques con lo que falta, hechos con lo
  // que fue. `bloquesDeLaSesion` es el respaldo si el plan no llegó todavía.
  const bloques = s.assignment ? bloquesDelPlan(s.assignment, s.dieta, s.radarFugas) : bloquesDeLaSesion(s);
  const hechos = s.assignment
    ? new Set<SessionBlockType>(s.assignment.bloques.filter((b) => b.estado === 'completado').map((b) => b.tipo))
    : bloquesHechosHoy(s.sessions ?? []);
  const pendientes = bloques.filter((b) => !hechos.has(b.tipo));
  // La duración estimada es lo que queda por hacer hoy, no el plan entero.
  const duracionMin = pendientes.length > 0
    ? Math.max(DURACION_MINIMA_MIN, pendientes.reduce((total, b) => total + b.minutos, 0))
    : 0;
  // Por defecto se abre el primer bloque pendiente (el siguiente a hacer);
  // si están todos hechos, el primero. El usuario puede abrir otro.
  const primerPendiente = pendientes[0]?.tipo ?? null;
  const abiertoEfectivo = abierto ?? primerPendiente ?? bloques[0]?.tipo ?? null;
  const empezado = s.assignment ? planEmpezado(s.assignment) : false;
  const sonido = normalizeSensoryPreferences(s.profile.preferenciasSensoriales).sonido;

  // Escritorio (design system §1.4, "tablero + panel contextual, nunca tres
  // paneles"): la acción de hoy a la izquierda y el contexto semanal a la
  // derecha, en vez de una sola columna angosta que dejaba el 65% del ancho
  // vacío y empujaba el plan semanal abajo del pliegue. En celular no cambia
  // nada: las dos columnas se apilan en el mismo orden de siempre.
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 items-start gap-4 lg:max-w-5xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs tracking-wider text-tertiary uppercase">{fechaDeHoy()}</span>
          <div className="flex items-baseline justify-between">
            <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
            {duracionMin > 0 && (
              <span className="font-mono text-sm text-secondary">{t.sesion.minutos.replace('{n}', String(duracionMin))}</span>
            )}
          </div>
        </div>

        {/* Acordeón de bloques (design system §4.1): el abierto toma el recuadro
            accent con su explicación y el botón; el resto queda compacto y
            tocable. El primer bloque pendiente empieza (o continúa) la sesión
            guiada, que sirve solo lo que falta del plan; otro pendiente, solo
            ese bloque. Un bloque hecho queda cerrado y ofrece "Practicar de
            nuevo", que no cuenta para el plan (RF-11.1/11.5). */}
        <div className="flex flex-col gap-2">
          {bloques.map((b) => {
            const hecho = hechos.has(b.tipo);
            const esSiguiente = !hecho && b.tipo === primerPendiente;
            const accionLabel = hecho
              ? t.sesion.practicarDeNuevo
              : esSiguiente
                ? (empezado ? t.sesion.continuar : t.sesion.empezar)
                : t.sesion.empezarBloque;
            return (
              <BloqueAccordion
                key={b.tipo}
                bloque={b}
                esSiguiente={esSiguiente}
                hecho={hecho}
                accionLabel={accionLabel}
                abierto={b.tipo === abiertoEfectivo}
                cargando={s.phase === 'cargando'}
                startError={s.startError}
                onAbrir={() => setAbierto(b.tipo)}
                onEmpezar={() => iniciarSesion(sonido, esSiguiente ? undefined : b.tipo)}
              />
            );
          })}
        </div>
      </div>

      {/* Contexto: lo que el Prescriptor recomienda además de la sesión, y cómo
          venís esta semana. Nunca compite con el botón primario —todo acá es
          secundario— y acompaña el scroll en pantallas altas. */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-0">
        {/* "Hoy" y "esta semana" son listas distintas: la partida lenta y el
            Stoyko son semanales por definición, y presentarlos como deuda
            diaria hacía que el primer día pareciera imposible (E11). */}
        <PrescripcionesExternasCard
          prescripciones={prescripcionesDe(s.prescripcionesExternas ?? [], 'hoy')}
          titulo={t.hoy.tambienHoyTitulo}
          ayuda={t.hoy.tambienHoyAyuda}
        />
        <PrescripcionesExternasCard
          prescripciones={prescripcionesDe(s.prescripcionesExternas ?? [], 'esta-semana')}
          titulo={t.hoy.estaSemanaTitulo}
          ayuda={t.hoy.estaSemanaAyuda}
        />

        <div className="flex flex-col gap-1 border-t border-subtle pt-4 lg:border-t-0 lg:pt-0">
          <SectionHeading>{t.hoy.constanciaTitulo}</SectionHeading>
          <p className="m-0 text-sm text-secondary">{t.hoy.constanciaTexto}</p>
        </div>

        <WeeklyPlanCard records={s.sessions ?? []} profile={s.profile} />
      </aside>
    </div>
  );
}

/**
 * Prescripciones que se hacen en otra pantalla (E11, principio 1).
 *
 * Los cuatro ejercicios más exigentes de la app —partida lenta con su análisis,
 * finales contra Stockfish, Stoyko y línea comprometida— no entran en el
 * formato de una jugada por posición de la sesión, así que vivían en pantallas
 * sueltas que el Prescriptor nunca nombraba. Cálculo llegó a ser una de las
 * cuatro pestañas de la navegación sin que ninguna prescripción la mencionara.
 * Acá aparecen con el mismo contrato que un bloque: qué es, por qué hoy y
 * cuánto dura, cada una con su enlace directo.
 */
function PrescripcionesExternasCard({
  prescripciones,
  titulo,
  ayuda,
}: {
  prescripciones: PrescripcionExterna[];
  titulo: string;
  ayuda: string;
}) {
  if (prescripciones.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div>
        <SectionHeading>{titulo}</SectionHeading>
        <p className="m-0 mt-1 text-xs text-secondary">{ayuda}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {prescripciones.map((prescripcion) => (
          <PrescripcionRow key={prescripcion.tipo} prescripcion={prescripcion} />
        ))}
      </ul>
    </section>
  );
}

function PrescripcionRow({ prescripcion }: { prescripcion: PrescripcionExterna }) {
  const textos = t.hoy.prescripciones[prescripcion.tipo];
  const cumplida = prescripcion.estado === 'cumplida';
  const enEspera = prescripcion.estado === 'en-espera';
  const motivo = (cumplida ? textos.cumplida : enEspera ? textos.enEspera : textos.pendiente)
    .replace('{n}', String(prescripcion.cantidad ?? 0))
    .replace('{fecha}', prescripcion.fecha ? new Date(prescripcion.fecha).toLocaleDateString('es-AR') : '');

  const contenido = (
    <>
      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-base leading-none">
        {cumplida ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-success">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <>
            <span className="font-mono text-base font-semibold text-primary">{prescripcion.minutos}</span>
            <span className="mt-0.5 font-mono text-[0.5625rem] tracking-wider text-tertiary uppercase">{t.sesion.unidadMin}</span>
          </>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-primary">{textos.titulo}</span>
        <span className="text-xs text-secondary">{motivo}</span>
        {/* Por qué no es de hoy: el presupuesto declarado, no un capricho. */}
        {prescripcion.fueraDePresupuesto && (
          <span className="text-xs text-tertiary">{t.hoy.fueraDePresupuesto}</span>
        )}
      </span>
    </>
  );

  // En espera (el enfriamiento semanal de Stoyko) no es una acción: se muestra
  // para que el usuario sepa que existe y cuándo vuelve, sin invitar a entrar.
  if (enEspera) {
    return (
      <li className="flex items-center gap-3 rounded-md border border-subtle bg-surface p-3 opacity-70">{contenido}</li>
    );
  }
  return (
    <li>
      <a
        href={prescripcion.ruta}
        className={`flex items-center gap-3 rounded-md border p-3 no-underline transition-colors duration-[120ms] hover:border-strong hover:bg-elevated ${
          cumplida ? 'border-success/35 bg-success-subtle' : 'border-info/40 bg-surface'
        }`}
      >
        {contenido}
      </a>
    </li>
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
    readBlindTrainingEnabled() && enCurriculo && s.curriculumSubPhase === 'jugando' && curriculumItemActual
      ? nivelCiegas(s.curriculumProgressById.get(curriculumItemActual.id))
      : 'normal';

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-3">
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
      : { kind: 'error', move: null, revision: s.revision };
  }
  if (s.phase === 'curriculo' && s.curriculumSubPhase === 'feedback') {
    return s.curriculumUltimaLimpia
      ? { kind: 'success', move: s.lastMove }
      : { kind: 'error', move: null, revision: s.revision };
  }
  // El criterio de cálculo se responde con un botón, no en el tablero: no hay
  // jugada correcta que señalar.
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
      : { kind: 'error', move: null, revision: s.revision };
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
  const nivel = readBlindTrainingEnabled() && s.curriculumSubPhase === 'jugando' && item ? nivelCiegas(s.curriculumProgressById.get(item.id)) : 'normal';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-subtle bg-surface p-4">
        <p className="m-0 font-mono text-xs text-tertiary">
          {t.curriculo.progreso.replace('{actual}', String(actual)).replace('{total}', String(total))}
        </p>
        <p className="m-0 mt-1 font-display text-xl">{item?.nombre ?? t.curriculo.titulo}</p>
      </div>
      {s.curriculumSubPhase === 'jugando' && <p className="m-0 text-sm text-secondary">{t.curriculo.consigna}</p>}
      {nivel !== 'normal' && (
        <p className="m-0 rounded-lg border border-info/40 bg-info-subtle px-3 py-2 text-sm text-secondary">
          {nivel === 'fantasma' ? t.curriculo.ciegasFantasma : t.curriculo.ciegasCoordenadas}{' '}
          <span className="text-tertiary">{t.curriculo.ciegasApagar}</span>
        </p>
      )}
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
          linea={s.radarLinea ?? undefined}
          jugadaCorrecta={s.radarJugadaCorrecta ?? ''}
          onContinuar={() => void s.radarContinuar()}
        />
      )}
    </div>
  );
}
