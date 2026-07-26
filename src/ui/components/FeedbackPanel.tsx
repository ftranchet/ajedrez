// FeedbackPanel (design system §5): acierto / fallo / "no había táctica, y
// por qué". Fondo -subtle + borde al 35%, nunca celebración (§8 voz y tono).
import { t } from '../i18n/es';

export function FeedbackPanel({
  acierto,
  texto,
  jugadaCorrecta,
  linea,
  onContinuar,
}: {
  acierto: boolean;
  texto: string;
  jugadaCorrecta: string;
  /**
   * La solución completa en SAN. Mostrar solo la primera jugada dejaba al
   * usuario sin ver el punto de la combinación: 75 de las 116 posiciones del
   * catálogo tienen tres plies o más, y en un mate en 3 la primera jugada sola
   * no explica nada.
   */
  linea?: string;
  onContinuar: () => void;
}) {
  // La línea completa ya empieza por la jugada correcta, así que cuando hay
  // línea de varias jugadas mostrar además "Jugada correcta: X" repite el mismo
  // dato en dos renglones. Se muestra una cosa o la otra, nunca las dos.
  const hayLinea = Boolean(linea) && linea !== jugadaCorrecta;

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
      {hayLinea ? (
        <p className="m-0 font-mono text-xs text-secondary">
          {t.radar.lineaCompleta}: {linea}
        </p>
      ) : (
        !acierto && (
          <p className="m-0 font-mono text-xs text-secondary">
            {t.radar.jugadaCorrecta}: {jugadaCorrecta}
          </p>
        )
      )}
      <button onClick={onContinuar} className="btn-primary mt-1">
        {t.radar.continuar}
      </button>
    </div>
  );
}
