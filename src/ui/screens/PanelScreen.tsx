// Panel. En Fase 0: lista de partidas guardadas (demuestra persistencia,
// RF-1.5) + estado vacío honesto para las métricas (Fase 5). Fase 1 agrega
// exportación/restauración completa (E14): "Exportar mis datos" alcanzable
// en 2 toques desde Hoy (Hoy → Panel → Exportar), dentro del límite de
// RF-14.1 (≤3 toques).
import { useEffect, useRef, useState } from 'react';
import type { CalibrationRecord, Color, DobleSolucionAttempt, GameRecord, N1Experiment, Profile, RadarAttempt, Ritmo, SessionRecord, TransferMeasurement } from '../../core/types';
import { buildGameRecord, plyCountFromPgn } from '../../core/game';
import { parsePastedPgn, type PgnParseError } from '../../core/pgnImport';
import { erroresGravesPorPartidaMediaMovil, mejoraErroresGraves } from '../../core/panel';
import { brierScore, calibrationCurve, calibrationInsight } from '../../core/calibration';
import { activitySummary } from '../../core/session';
import { tasaConformismo } from '../../core/dobleSolucion';
import { transferAvailability, transferDelta, transferResults } from '../../core/transfer';
import { detectOverfitting } from '../../core/overfitting';
import { currentN1Phase } from '../../core/n1Experiment';
import { gameRepo } from '../../services/storage/gameRepo';
import { exportAllData, importAllData } from '../../services/export/exportImport';
import { radarAttemptRepo } from '../../services/storage/radarAttemptRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { dobleSolucionAttemptRepo } from '../../services/storage/dobleSolucionAttemptRepo';
import { sessionRepo } from '../../services/storage/sessionRepo';
import { transferMeasurementRepo } from '../../services/storage/transferMeasurementRepo';
import { n1ExperimentRepo } from '../../services/storage/n1ExperimentRepo';
import { TRANSFER_DATASET_VERSION } from '../../services/puzzles/transferSeedData';
import { useAnalysisStore } from '../state/analysisStore';
import { Chip } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { SectionHeading } from '../components/SectionHeading';
import { AnalizarScreen } from './AnalizarScreen';
import { TransferScreen } from './TransferScreen';
import { N1ExperimentScreen } from './N1ExperimentScreen';
import { t } from '../i18n/es';

function formatJugadas(n: number): string {
  return `${n} ${n === 1 ? t.panel.jugadaCorta : t.panel.jugadasCortas}`;
}

type PanelView = 'resumen' | 'medicion' | 'partidas-datos';

export function PanelScreen() {
  const analysisPhase = useAnalysisStore((s) => s.phase);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [radarAttempts, setRadarAttempts] = useState<RadarAttempt[] | null>(null);
  const [calibraciones, setCalibraciones] = useState<CalibrationRecord[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dobleSolucionAttempts, setDobleSolucionAttempts] = useState<DobleSolucionAttempt[] | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [transferMeasurements, setTransferMeasurements] = useState<TransferMeasurement[] | null>(null);
  const [n1Experiments, setN1Experiments] = useState<N1Experiment[] | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [n1Open, setN1Open] = useState(false);
  const [view, setView] = useState<PanelView>('resumen');
  const [importVersion, setImportVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      gameRepo.list(),
      radarAttemptRepo.list(),
      calibrationRepo.list(),
      profileRepo.get(),
      dobleSolucionAttemptRepo.list(),
      sessionRepo.list(),
      transferMeasurementRepo.list(),
      n1ExperimentRepo.list(),
    ]).then(([g, radar, calibration, loadedProfile, doble, loadedSessions, transfer, experiments]) => {
      if (!alive) return;
      setGames(g);
      setRadarAttempts(radar);
      setCalibraciones(calibration);
      setProfile(loadedProfile);
      setDobleSolucionAttempts(doble);
      setSessions(loadedSessions);
      setTransferMeasurements(transfer);
      setN1Experiments(experiments);
    });
    return () => {
      alive = false;
    };
  }, [analysisPhase, importVersion]); // recarga la lista al volver de un análisis (E3) o importar un PGN (RF-2.2)

  if (analysisPhase !== 'inactivo') return <AnalizarScreen />;
  if (transferOpen) {
    return <TransferScreen onClose={() => { setTransferOpen(false); setImportVersion((version) => version + 1); }} />;
  }
  if (n1Open) {
    return <N1ExperimentScreen onClose={() => { setN1Open(false); setImportVersion((version) => version + 1); }} />;
  }

  const loading = games === null || radarAttempts === null || calibraciones === null || profile === null ||
    dobleSolucionAttempts === null || sessions === null || transferMeasurements === null || n1Experiments === null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header>
        <h1 className="m-0 font-display text-3xl font-medium">{t.panel.titulo}</h1>
        <p className="m-0 mt-1 text-secondary">{t.panel.subtitulo}</p>
      </header>

      <SegmentedControl
        label={t.panel.vistasLabel}
        value={view}
        options={[
          { value: 'resumen', label: t.panel.vistaResumen },
          { value: 'medicion', label: t.panel.vistaMedicion },
          { value: 'partidas-datos', label: t.panel.vistaPartidasDatos },
        ]}
        onChange={setView}
        className="w-full lg:max-w-2xl"
      />

      {loading ? <PanelSkeleton /> : view === 'resumen' ? (
        <ResumenView
          games={games}
          calibraciones={calibraciones}
          profile={profile}
          sessions={sessions}
          radarAttempts={radarAttempts}
          dobleSolucionAttempts={dobleSolucionAttempts}
          onView={setView}
        />
      ) : view === 'medicion' ? (
        <MedicionView
          games={games}
          radarAttempts={radarAttempts}
          transferMeasurements={transferMeasurements}
          n1Experiments={n1Experiments}
          onTransfer={() => setTransferOpen(true)}
          onN1={() => setN1Open(true)}
        />
      ) : (
        <PartidasDatosView
          games={games}
          onImported={() => setImportVersion((version) => version + 1)}
        />
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div aria-label={t.panel.cargando} className="grid gap-4 lg:grid-cols-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-36 rounded-lg border border-subtle bg-surface" />
      ))}
    </div>
  );
}

function ResumenView({
  games,
  calibraciones,
  profile,
  sessions,
  radarAttempts,
  dobleSolucionAttempts,
  onView,
}: {
  games: GameRecord[];
  calibraciones: CalibrationRecord[];
  profile: Profile;
  sessions: SessionRecord[];
  radarAttempts: RadarAttempt[];
  dobleSolucionAttempts: DobleSolucionAttempt[];
  onView: (view: PanelView) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <PanelDeVerdad games={games} calibraciones={calibraciones} profile={profile} />
        <div className="lg:hidden">
          <NextStepPanel games={games} profile={profile} onView={onView} />
        </div>
        <TruthCelebrationPanel games={games} />
        <CalibrationPanel records={calibraciones} />
      </div>
      <aside className="flex flex-col gap-4">
        <div className="hidden lg:block">
          <NextStepPanel games={games} profile={profile} onView={onView} />
        </div>
        <ActivityPanel records={sessions} />
        <RadarSummary attempts={radarAttempts} />
        <DobleSolucionSummary attempts={dobleSolucionAttempts} />
      </aside>
    </div>
  );
}

function MedicionView({
  games,
  radarAttempts,
  transferMeasurements,
  n1Experiments,
  onTransfer,
  onN1,
}: {
  games: GameRecord[];
  radarAttempts: RadarAttempt[];
  transferMeasurements: TransferMeasurement[];
  n1Experiments: N1Experiment[];
  onTransfer: () => void;
  onN1: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <TransferPanel measurements={transferMeasurements} onOpen={onTransfer} />
        <N1ExperimentPanel experiments={n1Experiments} onOpen={onN1} />
      </div>
      <div className="flex flex-col gap-4">
        <OverfittingPanel games={games} attempts={radarAttempts} />
        <section className="rounded-lg border border-subtle bg-surface p-4">
          <SectionHeading>{t.panel.medicionComoLeerTitulo}</SectionHeading>
          <p className="m-0 mt-2 text-secondary">{t.panel.medicionComoLeer}</p>
        </section>
      </div>
    </div>
  );
}

function PartidasDatosView({ games, onImported }: { games: GameRecord[]; onImported: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:items-start">
      <GamesSection games={games} />
      <aside className="flex flex-col gap-4">
        <ImportarPartidaSection onImported={onImported} />
        <DatosSection onImported={onImported} />
      </aside>
    </div>
  );
}

function GamesSection({ games }: { games: GameRecord[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{t.panel.partidas}</SectionHeading>
      {games.length === 0 ? (
        <p className="m-0 rounded-lg border border-subtle bg-surface p-4 text-secondary">{t.panel.sinPartidas}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {games.map((game) => {
            const jugadas = plyCountFromPgn(game.pgn);
            return (
              <li key={game.id} className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-secondary">{new Date(game.fecha).toLocaleDateString('es-AR')}</span>
                  <span className="text-sm text-tertiary">{formatJugadas(Math.ceil(jugadas / 2))}</span>
                  <span className="font-mono text-sm text-primary">{game.resultado}</span>
                </div>
                {game.ratingUsuario === undefined ? null : (
                  <span className="font-mono text-xs text-tertiary">{t.panel.partidaRating.replace('{rating}', String(game.ratingUsuario))}</span>
                )}
                {game.analizada ? (
                  <span className="text-xs text-tertiary">{t.analisis.yaAnalizada}</span>
                ) : jugadas === 0 ? (
                  <span className="text-xs text-tertiary">{t.analisis.muyCortaParaAnalizar}</span>
                ) : (
                  <button onClick={() => void useAnalysisStore.getState().iniciar(game.id)} className="btn-secondary">
                    {t.analisis.analizar}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NextStepPanel({ games, profile, onView }: { games: GameRecord[]; profile: Profile; onView: (view: PanelView) => void }) {
  if (!profile.diagnosticoCompletadoEn) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
        <SectionHeading>{t.panel.proximoPasoTitulo}</SectionHeading>
        <p className="m-0 text-primary">{t.panel.proximoPasoDiagnostico}</p>
        <a href="#/hoy" className="btn-primary text-center no-underline">{t.panel.irAHoy}</a>
      </section>
    );
  }
  if (games.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
        <SectionHeading>{t.panel.proximoPasoTitulo}</SectionHeading>
        <p className="m-0 text-primary">{t.panel.proximoPasoPartida}</p>
        <a href="#/jugar" className="btn-primary text-center no-underline">{t.panel.irAJugar}</a>
      </section>
    );
  }
  if (!games.some((game) => game.analizada)) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
        <SectionHeading>{t.panel.proximoPasoTitulo}</SectionHeading>
        <p className="m-0 text-primary">{t.panel.proximoPasoAnalisis}</p>
        <button onClick={() => onView('partidas-datos')} className="btn-primary">{t.panel.verPartidas}</button>
      </section>
    );
  }
  return null;
}

function N1ExperimentPanel({
  experiments,
  onOpen,
}: {
  experiments: N1Experiment[] | null;
  onOpen: () => void;
}) {
  if (experiments === null) return null;
  const latest = experiments[0];
  const phase = latest ? currentN1Phase(latest) : null;
  let status: string = t.n1.panelSinExperimento;
  if (latest?.estado === 'completado') status = t.n1.panelCompletado;
  else if (phase) {
    status = t.n1.panelActivo
      .replace('{fase}', phase.id)
      .replace('{modalidad}', t.n1.modalidades[phase.modalidad]);
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-info/40 bg-surface p-4">
      <div>
        <SectionHeading>{t.n1.panelTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{status}</p>
      </div>
      <button onClick={onOpen} className="btn-secondary">
        {latest ? t.n1.abrir : t.n1.configurar}
      </button>
    </section>
  );
}

function OverfittingPanel({ games, attempts }: { games: GameRecord[] | null; attempts: RadarAttempt[] | null }) {
  if (games === null || attempts === null) return null;
  const result = detectOverfitting(attempts, games);
  const alert = result.status === 'overfitting';
  return (
    <section className={`flex flex-col gap-2 rounded-lg border p-4 ${alert ? 'border-error/35 bg-error-subtle' : 'border-subtle bg-surface'}`}>
      <SectionHeading>{t.panel.sobreajusteTitulo}</SectionHeading>
      {result.status === 'insufficient' ? (
        <p className="m-0 text-sm text-secondary">{t.panel.sobreajusteInsuficiente}</p>
      ) : result.status === 'overfitting' ? (
        <>
          <p className="m-0 text-primary">
            {t.panel.sobreajusteAlerta
              .replace('{interno}', String(Math.round(result.internalDelta)))
              .replace('{rating}', String(Math.round(result.gameRatingDelta)))}
          </p>
          <p className="m-0 text-sm text-secondary">{t.panel.sobreajusteSugerencia}</p>
        </>
      ) : (
        <p className="m-0 text-sm text-secondary">
          {t.panel.sobreajusteSinSenal
            .replace('{interno}', String(Math.round(result.internalDelta)))
            .replace('{rating}', String(Math.round(result.gameRatingDelta)))}
        </p>
      )}
    </section>
  );
}

function TransferPanel({
  measurements,
  onOpen,
}: {
  measurements: TransferMeasurement[] | null;
  onOpen: () => void;
}) {
  if (measurements === null) return null;
  const availability = transferAvailability(measurements, new Date(), TRANSFER_DATASET_VERSION);
  const results = transferResults(measurements, TRANSFER_DATASET_VERSION);
  const latest = results.at(-1);
  const delta = transferDelta(measurements, TRANSFER_DATASET_VERSION);
  const canOpen = availability.status !== 'scheduled';
  const status =
    availability.status === 'available'
      ? t.transfer.disponible
      : availability.status === 'in-progress'
        ? t.transfer.reanudar.replace('{hechas}', String(availability.measurement.responses.length))
        : t.transfer.programada.replace('{fecha}', new Date(availability.nextAt).toLocaleDateString('es-AR'));

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
      <div>
        <SectionHeading>{t.transfer.titulo}</SectionHeading>
        <p className="m-0 mt-1 text-primary">{t.transfer.descripcion}</p>
      </div>
      <p className="m-0 text-sm text-secondary">{t.transfer.metodologia}</p>
      <p className="m-0 font-mono text-sm text-primary">{status}</p>
      {latest && (
        <div className="text-sm">
          <p className="m-0 text-secondary">
            {t.transfer.ultimoResultado
              .replace('{porcentaje}', String(latest.percentage))
              .replace('{aciertos}', String(latest.correct))
              .replace('{total}', String(latest.total))}
          </p>
          {delta !== null && (
            <p className="m-0 mt-1 text-secondary">
              {t.transfer.cambio
                .replace('{signo}', delta > 0 ? '+' : '')
                .replace('{puntos}', String(delta))}
            </p>
          )}
        </div>
      )}
      {canOpen && (
        <button onClick={onOpen} className="btn-primary">
          {availability.status === 'in-progress' ? t.transfer.continuar : t.transfer.iniciar}
        </button>
      )}
    </section>
  );
}

function CalibrationPanel({ records }: { records: CalibrationRecord[] | null }) {
  if (records === null) return null;
  const curve = calibrationCurve(records);
  const insight = calibrationInsight(records);
  const points = curve
    .sort((a, b) => a.confianzaMedia - b.confianzaMedia)
    .map((point) => `${5 + point.confianzaMedia * 0.9},${95 - point.aciertoReal * 90}`)
    .join(' ');

  let lectura: string = t.panel.calibracionSinLectura;
  if (insight) {
    const contexto = t.panel.calibracionContextos[insight.contexto];
    const plantilla =
      insight.direccion === 'sobreconfianza'
        ? t.panel.calibracionSobreconfianza
        : insight.direccion === 'subconfianza'
          ? t.panel.calibracionSubconfianza
          : t.panel.calibracionAlineada;
    lectura = plantilla
      .replace('{confianza}', String(insight.confianza))
      .replace('{acierto}', String(insight.acierto))
      .replace('{contexto}', contexto);
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.panel.calibracionTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.panel.calibracionAyuda}</p>
      </div>
      {curve.length === 0 ? (
        <p className="m-0 text-secondary">{t.panel.verdadSinCalibracion}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <svg
            viewBox="0 0 100 100"
            className="h-48 w-full overflow-visible"
            role="img"
            aria-label={t.panel.calibracionGraficoLabel}
          >
            <g className="text-tertiary" stroke="currentColor" fill="none">
              <line x1="5" y1="95" x2="95" y2="5" strokeDasharray="3 3" />
              <line x1="5" y1="95" x2="95" y2="95" />
              <line x1="5" y1="95" x2="5" y2="5" />
            </g>
            {curve.length > 1 && (
              <polyline points={points} className="text-info" stroke="currentColor" strokeWidth="2" fill="none" />
            )}
            {curve.map((point) => (
              <circle
                key={point.desde}
                cx={5 + point.confianzaMedia * 0.9}
                cy={95 - point.aciertoReal * 90}
                r="2.5"
                className="text-info"
                fill="currentColor"
              >
                <title>
                  {t.panel.calibracionPunto
                    .replace('{confianza}', String(Math.round(point.confianzaMedia)))
                    .replace('{acierto}', String(Math.round(point.aciertoReal * 100)))
                    .replace('{n}', String(point.cantidad))}
                </title>
              </circle>
            ))}
          </svg>
          <div className="flex justify-between font-mono text-xs text-tertiary">
            <span>{t.panel.calibracionEjeBajo}</span>
            <span>{t.panel.calibracionEjeConfianza}</span>
            <span>{t.panel.calibracionEjeAlto}</span>
          </div>
        </div>
      )}
      <p className="m-0 text-primary">{lectura}</p>
    </section>
  );
}

function ActivityPanel({ records }: { records: SessionRecord[] | null }) {
  if (records === null) return null;
  const summary = activitySummary(records);
  return (
    <section className="flex flex-col gap-2 rounded-md border border-subtle bg-surface p-3">
      <div>
        <SectionHeading>{t.panel.actividadTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-xs text-secondary">{t.panel.actividadPeriodo}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ActivityMetric value={summary.racha} label={t.panel.actividadRacha} />
        <ActivityMetric value={summary.sesiones} label={t.panel.actividadSesiones} />
        <ActivityMetric value={summary.minutos} label={t.panel.actividadMinutos} />
        <ActivityMetric value={summary.items} label={t.panel.actividadItems} />
      </div>
      <p className="m-0 text-xs text-tertiary">{t.panel.actividadRachaAyuda}</p>
    </section>
  );
}

function TruthCelebrationPanel({ games }: { games: GameRecord[] | null }) {
  if (games === null) return null;
  const improvement = mejoraErroresGraves(games);
  if (!improvement) return null;
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-success/35 bg-success-subtle p-4">
      <SectionHeading>{t.panel.mejoraRealTitulo}</SectionHeading>
      <p className="m-0 text-primary">
        {t.panel.mejoraRealErrores.replace('{porcentaje}', String(Math.round(improvement.porcentaje)))}
      </p>
      <p className="m-0 text-sm text-secondary">
        {t.panel.mejoraRealComparacion
          .replace('{anterior}', improvement.mediaAnterior.toFixed(1))
          .replace('{actual}', improvement.mediaActual.toFixed(1))
          .replace('{partidas}', String(improvement.partidasActuales))}
      </p>
    </section>
  );
}

function ActivityMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-lg text-primary">{value}</span>
      <span className="text-xs text-secondary">{label}</span>
    </div>
  );
}

// Panel de verdad v1 (RF-12.1): grande, al frente, sin confeti. Banda de Elo
// (categórica: sin historial real todavía no hay con qué calibrar un número
// de Elo con sentido — ver core/panel.ts), errores graves por partida
// (media móvil) y calibración (Brier, cuanto más cerca de 0 mejor).
function PanelDeVerdad({
  games,
  calibraciones,
  profile,
}: {
  games: GameRecord[] | null;
  calibraciones: CalibrationRecord[] | null;
  profile: Profile | null;
}) {
  if (games === null || calibraciones === null || profile === null) return null;

  const mediaErroresGraves = erroresGravesPorPartidaMediaMovil(games);
  const brier = brierScore(calibraciones);
  const latestRatedGame = games
    .filter((game) => (game.ritmo === 'rapida' || game.ritmo === 'clasica') && game.ratingUsuario !== undefined)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading>{t.panel.verdadTitulo}</SectionHeading>
      <div className="grid gap-2 sm:grid-cols-3">
        <TruthMetric
          label={latestRatedGame ? t.panel.verdadRating : t.panel.verdadBanda}
          value={String(latestRatedGame?.ratingUsuario ?? (profile.diagnosticoCompletadoEn ? t.diagnostico.bandas[profile.bandaElo] : t.panel.verdadSinDiagnostico))}
        />
        <TruthMetric
          label={t.panel.verdadErroresGraves}
          value={mediaErroresGraves === null ? t.panel.verdadSinPartidas : mediaErroresGraves.toFixed(1)}
        />
        <TruthMetric
          label={t.panel.verdadCalibracion}
          value={brier === null ? t.panel.verdadSinCalibracion : brier.toFixed(2)}
        />
      </div>
    </section>
  );
}

function TruthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-24 flex-col justify-between gap-2 rounded-md bg-elevated p-3 sm:min-h-28">
      <span className="text-sm text-secondary">{label}</span>
      <strong className="font-display text-2xl font-medium leading-tight text-primary">{value}</strong>
    </div>
  );
}

function RadarSummary({ attempts }: { attempts: RadarAttempt[] | null }) {
  if (attempts === null) return null;
  if (attempts.length === 0) {
    return (
      <section className="rounded-lg border border-subtle bg-surface p-4">
        <SectionHeading className="mb-2">{t.panel.radar}</SectionHeading>
        <p className="m-0 text-secondary">{t.panel.radarSinRespuestas}</p>
      </section>
    );
  }
  // Los intentos históricos sin origen son catálogo. Los errores propios no
  // entran en la meta 60–80% porque no tienen dificultad calibrada (RF-5.9).
  const recent = attempts.filter((attempt) => attempt.origenContenido !== 'error-propio').slice(0, 50);
  const ownErrors = attempts.filter((attempt) => attempt.origenContenido === 'error-propio').slice(0, 50);
  const porcentaje = recent.length > 0
    ? Math.round((recent.filter((attempt) => attempt.acierto).length / recent.length) * 100)
    : null;
  const ownErrorPercentage = ownErrors.length > 0
    ? Math.round((ownErrors.filter((attempt) => attempt.acierto).length / ownErrors.length) * 100)
    : null;
  return (
    <section className="rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading className="mb-2">{t.panel.radar}</SectionHeading>
      {porcentaje === null ? (
        <p className="m-0 text-secondary">{t.panel.radarSinCatalogo}</p>
      ) : (
        <>
          <p className="m-0 text-primary">
            {t.panel.radarTasa.replace('{n}', String(recent.length)).replace('{porcentaje}', String(porcentaje))}
          </p>
          <p className="m-0 mt-1 text-sm text-secondary">{t.panel.radarMeta}</p>
        </>
      )}
      {ownErrorPercentage === null ? null : (
        <p className="m-0 mt-2 text-sm text-secondary">
          {t.panel.radarErroresPropios
            .replace('{n}', String(ownErrors.length))
            .replace('{porcentaje}', String(ownErrorPercentage))}
        </p>
      )}
    </section>
  );
}

// Doble solución (E5, RF-5.7): tasa de conformismo — cuántas veces, entre
// las jugadas superior/familiar, el usuario se conformó con la familiar en
// vez de encontrar la superior. Los intentos "otra" (fallo genuino) no
// cuentan para esta tasa: no fue ni superior ni un conformismo, fue un error.
function DobleSolucionSummary({ attempts }: { attempts: DobleSolucionAttempt[] | null }) {
  if (attempts === null) return null;
  const tasa = tasaConformismo(attempts.map((a) => a.resultado));
  return (
    <section className="rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading className="mb-2">{t.panel.dobleSolucion}</SectionHeading>
      {tasa === null ? (
        <p className="m-0 text-secondary">{t.panel.dobleSolucionSinDatos}</p>
      ) : (
        <p className="m-0 text-primary">{t.panel.dobleSolucionTasa.replace('{porcentaje}', String(Math.round(tasa * 100)))}</p>
      )}
    </section>
  );
}

const RITMOS: Ritmo[] = ['rapida', 'clasica', 'blitz', 'bullet', 'sin-reloj'];

function errorMensaje(error: PgnParseError): string {
  if (error === 'vacio') return t.panel.importarPgnErrorVacio;
  if (error === 'sin-jugadas') return t.panel.importarPgnErrorSinJugadas;
  return t.panel.importarPgnErrorInvalido;
}

function ImportarPartidaSection({ onImported }: { onImported: () => void }) {
  const [pgn, setPgn] = useState('');
  const [ritmo, setRitmo] = useState<Ritmo>('rapida');
  const [jugadorColor, setJugadorColor] = useState<Color | null>(null);
  const [rating, setRating] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const parsedManualRating = Number(rating);
  const manualRatingValid = rating.trim() === '' || (
    Number.isInteger(parsedManualRating) && parsedManualRating >= 100 && parsedManualRating <= 4000
  );

  async function handleImportar() {
    const resultado = parsePastedPgn(pgn);
    if (!resultado.ok) {
      setMensaje(errorMensaje(resultado.error));
      return;
    }
    if (jugadorColor === null) {
      setMensaje(t.panel.importarPgnColorRequerido);
      return;
    }
    setGuardando(true);
    try {
      const ratingUsuario = rating.trim() !== ''
        ? parsedManualRating
        : jugadorColor === 'w'
          ? resultado.whiteElo
          : resultado.blackElo;
      const game = buildGameRecord({
        pgn: resultado.pgn,
        resultado: resultado.resultado,
        tiemposPorJugadaMs: [],
        fuente: 'manual',
        ritmo,
        jugadorColor,
        ...(ratingUsuario !== undefined ? { ratingUsuario } : {}),
        ...(resultado.playedAt ? { fecha: resultado.playedAt } : {}),
      });
      await gameRepo.save(game);
      setPgn('');
      setJugadorColor(null);
      setRating('');
      setMensaje(t.panel.importarPgnOk);
      onImported();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading className="mb-1">{t.panel.importarPgnTitulo}</SectionHeading>
      <p className="m-0 text-sm text-secondary">{t.panel.importarPgnConsigna}</p>
      <textarea
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        placeholder={t.panel.importarPgnPlaceholder}
        rows={4}
        className="w-full resize-none rounded-lg border border-subtle bg-surface p-3 font-mono text-sm text-primary placeholder:text-tertiary focus-visible:border-accent"
      />
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.panel.importarPgnRitmo}</legend>
        <div className="flex flex-wrap gap-2">
          {RITMOS.map((r) => (
            <Chip key={r} selected={ritmo === r} onClick={() => setRitmo(r)}>
              {t.panel.ritmos[r]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.panel.importarPgnColor}</legend>
        <div className="flex gap-2">
          <Chip selected={jugadorColor === 'w'} onClick={() => setJugadorColor('w')}>{t.panel.blancas}</Chip>
          <Chip selected={jugadorColor === 'b'} onClick={() => setJugadorColor('b')}>{t.panel.negras}</Chip>
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm text-secondary">
        {t.panel.importarPgnRating}
        <input
          type="number"
          min="100"
          max="4000"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          placeholder={t.panel.importarPgnRatingPlaceholder}
          className="rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-primary placeholder:text-tertiary focus-visible:border-accent"
        />
      </label>
      <p className="m-0 text-xs text-tertiary">{t.panel.importarPgnRatingAyuda}</p>
      <button
        onClick={() => void handleImportar()}
        disabled={
          guardando ||
          pgn.trim() === '' ||
          !manualRatingValid
        }
        className="btn-secondary"
      >
        {t.panel.importarPgnBoton}
      </button>
      {mensaje && <p className="m-0 text-sm text-secondary">{mensaje}</p>}
    </section>
  );
}

function DatosSection({ onImported }: { onImported: () => void }) {
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExportando(true);
    setMensaje(null);
    try {
      const zip = await exportAllData();
      const buffer = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
      const blob = new Blob([buffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `elomax-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setMensaje(t.panel.exportado);
    } finally {
      setExportando(false);
    }
  }

  async function handleImportFile(file: File) {
    setImportando(true);
    setMensaje(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const outcome = await importAllData(bytes);
      if (outcome.ok) {
        setMensaje(
          t.panel.importadoOk
            .replace('{partidas}', String(outcome.resumen.partidas))
            .replace('{tarjetas}', String(outcome.resumen.tarjetas))
            .replace('{calibraciones}', String(outcome.resumen.calibraciones))
            .replace('{radar}', String(outcome.resumen.respuestasRadar)),
        );
        // Sin esto, la lista de partidas y las métricas del Panel seguían
        // mostrando el estado previo a la restauración hasta cambiar de pestaña.
        onImported();
      } else {
        setMensaje(`${t.panel.importadoError}: ${outcome.error}`);
      }
    } finally {
      setImportando(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading className="mb-1">{t.panel.datos}</SectionHeading>
      <button onClick={() => void handleExport()} disabled={exportando} className="btn-secondary">
        {exportando ? t.panel.exportando : t.panel.exportar}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />
      <button onClick={() => fileInput.current?.click()} disabled={importando} className="btn-secondary">
        {importando ? t.panel.importando : t.panel.importar}
      </button>
      {mensaje && <p className="m-0 text-sm text-secondary">{mensaje}</p>}
    </section>
  );
}
