// Modo a ciegas progresivo (RF-6.5): interruptor para la "dificultad deseable"
// del currículo. Por defecto activo; el usuario puede apagarlo si prefiere ver
// siempre el tablero completo. Preferencia device-local (localStorage), igual
// que el tema.
import { useBlindTraining } from '../hooks/useBlindTraining';
import { SegmentedControl } from './SegmentedControl';
import { SectionHeading } from './SectionHeading';
import { t } from '../i18n/es';

export function BlindTrainingCard() {
  const { enabled, setEnabled } = useBlindTraining();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.ajustes.aCiegasTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.ajustes.aCiegasTexto}</p>
      </div>
      <SegmentedControl<'on' | 'off'>
        label={t.ajustes.aCiegasLabel}
        value={enabled ? 'on' : 'off'}
        options={[
          { value: 'on', label: t.ajustes.aCiegasActivado },
          { value: 'off', label: t.ajustes.aCiegasDesactivado },
        ]}
        onChange={(value) => setEnabled(value === 'on')}
        className="w-full"
      />
    </section>
  );
}
