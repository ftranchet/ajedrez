// Ajustes (design system §4): destino propio, alcanzable desde el engranaje del
// header, donde vive TODA la configuración —plan semanal, recordatorio, sonido y
// movimiento, respaldo de datos— para que "Tu sesión de hoy" y el Panel queden
// enfocados en su intención. Carga y persiste el perfil por su cuenta (puede
// abrirse sin pasar por Hoy) y mantiene sincronizado el store de sesión.
import { useEffect, useState } from 'react';
import type { PlanSemanal, Profile, ReminderConfig, SensoryPreferences, SessionRecord } from '../../core/types';
import { profileRepo } from '../../services/storage/profileRepo';
import { sessionRepo } from '../../services/storage/sessionRepo';
import { useSessionStore } from '../state/sessionStore';
import { WeeklyPlanCard } from '../components/WeeklyPlanCard';
import { ReminderCard } from '../components/ReminderCard';
import { SensoryPreferencesCard } from '../components/SensoryPreferencesCard';
import { DataBackupCard } from '../components/DataBackupCard';
import { AppearanceCard } from '../components/AppearanceCard';
import { SectionHeading } from '../components/SectionHeading';
import { t } from '../i18n/es';

const REPO_URL = 'https://github.com/ftranchet/ajedrez';

export function AjustesScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([profileRepo.get(), sessionRepo.list()]).then(([loadedProfile, loadedSessions]) => {
      if (!alive) return;
      setProfile(loadedProfile);
      setSessions(loadedSessions);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Cada guardado persiste con merge transaccional y sincroniza el store de
  // sesión, así el resumen de constancia de Hoy y el Panel quedan al día.
  async function persist(patch: Partial<Omit<Profile, 'id'>>) {
    const next = await profileRepo.update(patch);
    setProfile(next);
    useSessionStore.setState({ profile: next });
  }

  const saveWeeklyPlan = (planSemanal: PlanSemanal) => persist({ planSemanal });
  const saveReminder = (recordatorio: ReminderConfig) => persist({ recordatorio });
  const saveSensoryPreferences = (preferenciasSensoriales: SensoryPreferences) => persist({ preferenciasSensoriales });

  // Restaurar reemplaza toda la base: recargo perfil y sesiones acá y fuerzo el
  // resumen de la sesión para que Hoy no quede mostrando datos previos.
  async function handleImported() {
    const [loadedProfile, loadedSessions] = await Promise.all([profileRepo.get(), sessionRepo.list()]);
    setProfile(loadedProfile);
    setSessions(loadedSessions);
    void useSessionStore.getState().loadSummary(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header>
        <h1 className="m-0 font-display text-3xl font-medium">{t.ajustes.titulo}</h1>
        <p className="m-0 mt-1 text-secondary">{t.ajustes.subtitulo}</p>
      </header>

      {profile === null ? (
        <div aria-hidden className="flex flex-col gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 rounded-lg border border-subtle bg-surface" />
          ))}
        </div>
      ) : (
        <>
          <WeeklyPlanCard records={sessions} profile={profile} editable onSave={saveWeeklyPlan} />
          <ReminderCard config={profile.recordatorio} onSave={saveReminder} />
          <AppearanceCard />
          <SensoryPreferencesCard preferences={profile.preferenciasSensoriales} onSave={saveSensoryPreferences} />
          <DataBackupCard onImported={() => void handleImported()} />

          <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
            <SectionHeading>{t.ajustes.acercaTitulo}</SectionHeading>
            <p className="m-0 text-sm text-secondary">{t.ajustes.acercaLocal}</p>
            <p className="m-0 text-sm text-tertiary">{t.ajustes.acercaLicencia}</p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              {t.ajustes.acercaRepo}
            </a>
          </section>
        </>
      )}
    </div>
  );
}
