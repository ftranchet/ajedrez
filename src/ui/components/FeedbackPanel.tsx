// FeedbackPanel (design system §5): acierto / fallo / "no había táctica, y
// por qué". Fondo -subtle + borde al 35%, nunca celebración (§8 voz y tono).
import { t } from '../i18n/es';

export function FeedbackPanel({
  acierto,
  texto,
  jugadaCorrecta,
  onContinuar,
}: {
  acierto: boolean;
  texto: string;
  jugadaCorrecta: string;
  onContinuar: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-outcome={acierto ? 'success' : 'error'}
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        acierto ? 'border-success/35 bg-success-subtle' : 'border-error/35 bg-error-subtle'
      }`}
    >
      <p className="m-0 font-display text-xl font-medium">{acierto ? t.radar.acertaste : t.radar.fallaste}</p>
      <p className="m-0 text-sm text-primary">{texto}</p>
      {!acierto && (
        <p className="m-0 font-mono text-xs text-secondary">
          {t.radar.jugadaCorrecta}: {jugadaCorrecta}
        </p>
      )}
      <button onClick={onContinuar} className="btn-primary mt-1">
        {t.radar.continuar}
      </button>
    </div>
  );
}
