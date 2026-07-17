// Pantalla principal. En Fase 0 es un estado vacío honesto: el Prescriptor
// llega en Fase 3 (roadmap). Los estados vacíos explican qué hacer (§6 voz).
import { t } from '../i18n/es';

export function HoyScreen({ onGoPlay }: { onGoPlay: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.hoy.titulo}</h1>
      <p className="m-0 text-secondary">{t.hoy.vacio}</p>
      <button onClick={onGoPlay} className="btn-primary">
        {t.hoy.accion}
      </button>
    </div>
  );
}
