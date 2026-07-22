// Apariencia (design system §2.1): elegir tema claro/oscuro o seguir al
// sistema. La preferencia se aplica al instante y persiste en localStorage
// (device-local, sin parpadeo al recargar). No crea segunda barrera ni celebra.
import type { ThemePreference } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { SegmentedControl } from './SegmentedControl';
import { SectionHeading } from './SectionHeading';
import { t } from '../i18n/es';

export function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.ajustes.aparienciaTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.ajustes.aparienciaTexto}</p>
      </div>
      <SegmentedControl<ThemePreference>
        label={t.ajustes.aparienciaLabel}
        value={preference}
        options={[
          { value: 'system', label: t.ajustes.temaSistema },
          { value: 'light', label: t.ajustes.temaClaro },
          { value: 'dark', label: t.ajustes.temaOscuro },
        ]}
        onChange={setPreference}
        className="w-full"
      />
    </section>
  );
}
