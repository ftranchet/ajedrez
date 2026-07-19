import { useEffect, useState } from 'react';
import {
  closeDueN1Phases,
  compareN1Conditions,
  currentN1Phase,
  n1DoseForWindow,
  startN1Experiment,
  targetDoseForPhase,
  type N1ExperimentData,
} from '../../core/n1Experiment';
import type { N1Experiment, N1Modality, N1OutcomeSnapshot } from '../../core/types';
import { compromisoAttemptRepo } from '../../services/storage/compromisoAttemptRepo';
import { gameRepo } from '../../services/storage/gameRepo';
import { n1ExperimentRepo } from '../../services/storage/n1ExperimentRepo';
import { sessionRepo } from '../../services/storage/sessionRepo';
import { stoykoAttemptRepo } from '../../services/storage/stoykoAttemptRepo';
import { t } from '../i18n/es';

interface Props {
  onClose: () => void;
}

const MODALITIES: N1Modality[] = ['radar', 'calculo', 'partidas-analisis'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR');
}

function formatErrors(value: number | null): string {
  return value === null ? t.n1.sinDatos : value.toFixed(2);
}

function Outcome({ value }: { value: N1OutcomeSnapshot }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Metric value={formatErrors(value.erroresGravesPorPartida)} label={t.n1.erroresPorPartida} />
      <Metric value={String(value.partidasAnalizadas)} label={t.n1.partidasAnalizadas} />
      <Metric value={value.rating === null ? t.n1.sinDatos : String(value.rating)} label={t.n1.ratingReal} />
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-elevated p-2 text-center">
      <strong className="block font-mono text-base text-primary">{value}</strong>
      <span className="text-xs text-tertiary">{label}</span>
    </div>
  );
}

export function N1ExperimentScreen({ onClose }: Props) {
  const [data, setData] = useState<N1ExperimentData | null>(null);
  const [observedAt, setObservedAt] = useState<Date | null>(null);
  const [experiment, setExperiment] = useState<N1Experiment | null>(null);
  const [configure, setConfigure] = useState(false);
  const [modalidadA, setModalidadA] = useState<N1Modality>('radar');
  const [modalidadB, setModalidadB] = useState<N1Modality>('partidas-analisis');
  const [dosisA, setDosisA] = useState('24');
  const [dosisB, setDosisB] = useState('2');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      gameRepo.list(),
      sessionRepo.list(),
      compromisoAttemptRepo.list(),
      stoykoAttemptRepo.list(),
      n1ExperimentRepo.list(),
    ]).then(async ([games, sessions, compromisoAttempts, stoykoAttempts, experiments]) => {
      if (!alive) return;
      const loadedData = { games, sessions, compromisoAttempts, stoykoAttempts };
      const latest = experiments[0] ?? null;
      const loadedAt = new Date();
      const updated = latest ? closeDueN1Phases(latest, loadedData, loadedAt) : null;
      if (updated && updated !== latest) await n1ExperimentRepo.save(updated);
      if (!alive) return;
      setData(loadedData);
      setObservedAt(loadedAt);
      setExperiment(updated);
      setConfigure(updated === null);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleStart() {
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      const next = startN1Experiment({
        modalidadA,
        modalidadB,
        dosisSemanalA: Number(dosisA),
        dosisSemanalB: Number(dosisB),
      }, data);
      await n1ExperimentRepo.save(next);
      setExperiment(next);
      setConfigure(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.n1.errorInicio);
    } finally {
      setSaving(false);
    }
  }

  if (data === null || observedAt === null) return <p className="m-0 text-secondary">{t.n1.cargando}</p>;

  const phase = experiment ? currentN1Phase(experiment) : null;
  const liveDose = phase
    ? n1DoseForWindow(phase.modalidad, data, new Date(phase.inicio), new Date(Math.min(observedAt.getTime(), new Date(phase.fin).getTime())))
    : null;
  const comparison = experiment ? compareN1Conditions(experiment) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 font-display text-3xl font-medium">{t.n1.titulo}</h1>
        <button onClick={onClose} className="btn-secondary">{t.n1.volver}</button>
      </div>

      <section className="flex flex-col gap-2 rounded-lg border border-info/40 bg-surface p-4">
        <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.n1.metodologiaTitulo}</h2>
        <p className="m-0 text-sm text-secondary">{t.n1.metodologiaDiseno}</p>
        <p className="m-0 text-sm text-secondary">{t.n1.metodologiaLimite}</p>
        <p className="m-0 text-sm text-secondary">{t.n1.metodologiaConstancia}</p>
      </section>

      {configure ? (
        <ExperimentForm
          modalidadA={modalidadA}
          modalidadB={modalidadB}
          dosisA={dosisA}
          dosisB={dosisB}
          onModalidadA={setModalidadA}
          onModalidadB={setModalidadB}
          onDosisA={setDosisA}
          onDosisB={setDosisB}
          onStart={() => void handleStart()}
          onCancel={experiment ? () => setConfigure(false) : undefined}
          saving={saving}
          error={error}
        />
      ) : experiment ? (
        <>
          {phase && liveDose !== null && (
            <section className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
              <div>
                <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">
                  {t.n1.faseActual.replace('{fase}', phase.id)}
                </h2>
                <p className="m-0 mt-1 text-primary">
                  {t.n1.enfasis.replace('{modalidad}', t.n1.modalidades[phase.modalidad])}
                </p>
                <p className="m-0 mt-1 text-xs text-tertiary">
                  {t.n1.periodo.replace('{inicio}', formatDate(phase.inicio)).replace('{fin}', formatDate(phase.fin))}
                </p>
              </div>
              <Metric
                value={`${liveDose} / ${targetDoseForPhase(experiment, phase)}`}
                label={t.n1.dosisBloque.replace('{unidad}', t.n1.unidades[phase.modalidad])}
              />
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div>
              <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.n1.lineaBaseTitulo}</h2>
              <p className="m-0 mt-1 text-xs text-tertiary">{t.n1.lineaBasePeriodo}</p>
            </div>
            <Outcome value={experiment.lineaBase} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.n1.cronograma}</h2>
            {experiment.fases.map((item) => (
              <div key={item.id} className="rounded-lg border border-subtle bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="text-primary">{item.id} · {t.n1.modalidades[item.modalidad]}</strong>
                  <span className="font-mono text-xs text-tertiary">{formatDate(item.inicio)}–{formatDate(item.fin)}</span>
                </div>
                {item.snapshot ? (
                  <p className="m-0 mt-2 text-sm text-secondary">
                    {t.n1.faseCerrada
                      .replace('{dosis}', String(item.snapshot.dosisReal))
                      .replace('{objetivo}', String(targetDoseForPhase(experiment, item)))
                      .replace('{errores}', formatErrors(item.snapshot.erroresGravesPorPartida))
                      .replace('{partidas}', String(item.snapshot.partidasAnalizadas))
                      .replace('{rating}', item.snapshot.rating === null ? t.n1.sinDatos : String(item.snapshot.rating))}
                  </p>
                ) : (
                  <p className="m-0 mt-2 text-sm text-tertiary">{item === phase ? t.n1.enCurso : t.n1.pendiente}</p>
                )}
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
            <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.n1.comparacionTitulo}</h2>
            {comparison?.status === 'comparable' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Metric value={comparison.errorsA.toFixed(2)} label={t.n1.comparacionA.replace('{n}', String(comparison.gamesA))} />
                  <Metric value={comparison.errorsB.toFixed(2)} label={t.n1.comparacionB.replace('{n}', String(comparison.gamesB))} />
                </div>
                <p className="m-0 text-sm text-primary">
                  {comparison.lowerErrors === 'igual'
                    ? t.n1.comparacionIgual
                    : t.n1.comparacionMenor.replace('{condicion}', comparison.lowerErrors)}
                </p>
                <p className="m-0 text-xs text-tertiary">{t.n1.comparacionNoCausal}</p>
              </>
            ) : (
              <p className="m-0 text-sm text-secondary">
                {t.n1.comparacionInsuficiente
                  .replace('{a}', String(comparison?.gamesA ?? 0))
                  .replace('{b}', String(comparison?.gamesB ?? 0))}
              </p>
            )}
          </section>

          {experiment.estado === 'completado' && (
            <button onClick={() => setConfigure(true)} className="btn-primary">{t.n1.nuevo}</button>
          )}
        </>
      ) : null}
    </div>
  );
}

function ExperimentForm({
  modalidadA,
  modalidadB,
  dosisA,
  dosisB,
  onModalidadA,
  onModalidadB,
  onDosisA,
  onDosisB,
  onStart,
  onCancel,
  saving,
  error,
}: {
  modalidadA: N1Modality;
  modalidadB: N1Modality;
  dosisA: string;
  dosisB: string;
  onModalidadA: (value: N1Modality) => void;
  onModalidadB: (value: N1Modality) => void;
  onDosisA: (value: string) => void;
  onDosisB: (value: string) => void;
  onStart: () => void;
  onCancel?: () => void;
  saving: boolean;
  error: string | null;
}) {
  const numberA = Number(dosisA);
  const numberB = Number(dosisB);
  const valid = modalidadA !== modalidadB &&
    Number.isInteger(numberA) && numberA >= 1 && numberA <= 100 &&
    Number.isInteger(numberB) && numberB >= 1 && numberB <= 100;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.n1.configurarTitulo}</h2>
        <p className="m-0 mt-1 text-sm text-secondary">{t.n1.configurarAyuda}</p>
      </div>
      <ConditionField condition="A" modality={modalidadA} dose={dosisA} onModality={onModalidadA} onDose={onDosisA} />
      <ConditionField condition="B" modality={modalidadB} dose={dosisB} onModality={onModalidadB} onDose={onDosisB} />
      {modalidadA === modalidadB && <p className="m-0 text-sm text-error">{t.n1.modalidadesDistintas}</p>}
      {error && <p className="m-0 text-sm text-error">{error}</p>}
      <button onClick={onStart} disabled={!valid || saving} className="btn-primary">
        {saving ? t.n1.guardando : t.n1.iniciar}
      </button>
      {onCancel && <button onClick={onCancel} className="btn-secondary">{t.n1.cancelar}</button>}
    </section>
  );
}

function ConditionField({
  condition,
  modality,
  dose,
  onModality,
  onDose,
}: {
  condition: 'A' | 'B';
  modality: N1Modality;
  dose: string;
  onModality: (value: N1Modality) => void;
  onDose: (value: string) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-3">
      <legend className="px-1 text-sm font-medium text-primary">{t.n1.condicion.replace('{condicion}', condition)}</legend>
      <label className="flex flex-col gap-1 text-sm text-secondary">
        {t.n1.modalidad}
        <select
          value={modality}
          onChange={(event) => onModality(event.target.value as N1Modality)}
          className="rounded-lg border border-subtle bg-surface px-3 py-2 text-primary focus-visible:border-accent"
        >
          {MODALITIES.map((item) => <option key={item} value={item}>{t.n1.modalidades[item]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-secondary">
        {t.n1.dosisSemanal.replace('{unidad}', t.n1.unidades[modality])}
        <input
          type="number"
          min="1"
          max="100"
          step="1"
          value={dose}
          onChange={(event) => onDose(event.target.value)}
          className="rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-primary focus-visible:border-accent"
        />
      </label>
    </fieldset>
  );
}
