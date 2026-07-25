// Rating de partidas lentas declarado por el usuario (PRD §3.1, RF-12.1). La
// métrica estrella del producto es ΔElo por hora contra línea base, y hasta
// ahora no había ninguna forma de alimentarla salvo importar un PGN con rating:
// las partidas jugadas dentro de la app se guardan sin reloj y sin rating. Acá
// el usuario mantiene esa serie a mano; actualizarla cada cuatro o seis semanas
// es lo que convierte un número suelto en una medición de progreso.
import { useState } from 'react';
import type { Profile, RatingExterno } from '../../core/types';
import { Chip } from './Chip';
import { SectionHeading } from './SectionHeading';
import { t } from '../i18n/es';

const FUENTES: RatingExterno['fuente'][] = ['lichess', 'chesscom', 'otro'];

export function RatingExternoCard({
  ratings,
  onSave,
}: {
  ratings: Profile['ratingsExternos'];
  onSave: (registro: RatingExterno) => void | Promise<void>;
}) {
  const serie = [...(ratings ?? [])].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const ultimo = serie.at(-1);
  const [valor, setValor] = useState('');
  const [fuente, setFuente] = useState<RatingExterno['fuente']>(ultimo?.fuente ?? 'lichess');
  const [error, setError] = useState(false);

  function guardar() {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 100 || numero > 4000) {
      setError(true);
      return;
    }
    setError(false);
    setValor('');
    void onSave({ valor: numero, fuente, fecha: new Date().toISOString() });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.ajustes.ratingTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.ajustes.ratingTexto}</p>
      </div>

      {ultimo ? (
        <p className="m-0 text-sm text-primary tabular-nums">
          {t.ajustes.ratingActual
            .replace('{valor}', String(ultimo.valor))
            .replace('{fuente}', t.diagnostico.fuentesRating[ultimo.fuente])
            .replace('{fecha}', new Date(ultimo.fecha).toLocaleDateString('es-AR'))}
          {serie.length > 1 && (
            <>
              {' '}
              <span className="text-secondary">
                {t.ajustes.ratingDelta
                  .replace('{signo}', ultimo.valor - serie[0].valor > 0 ? '+' : '')
                  .replace('{puntos}', String(ultimo.valor - serie[0].valor))
                  .replace('{tomas}', String(serie.length))}
              </span>
            </>
          )}
        </p>
      ) : (
        <p className="m-0 text-sm text-tertiary">{t.ajustes.ratingSinDatos}</p>
      )}

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.diagnostico.informeRatingFuente}</legend>
        <div className="flex flex-wrap gap-2">
          {FUENTES.map((f) => (
            <Chip key={f} selected={fuente === f} onClick={() => setFuente(f)}>
              {t.diagnostico.fuentesRating[f]}
            </Chip>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm text-secondary">
        {t.ajustes.ratingNuevo}
        <input
          type="number"
          min="100"
          max="4000"
          value={valor}
          onChange={(event) => setValor(event.target.value)}
          className="min-h-11 rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-primary"
        />
      </label>
      {error && <p role="alert" className="m-0 text-xs text-error-text">{t.diagnostico.informeRatingInvalido}</p>}
      <button onClick={guardar} disabled={valor.trim() === ''} className="btn-secondary">
        {t.ajustes.ratingGuardar}
      </button>
      <p className="m-0 text-xs text-tertiary">{t.ajustes.ratingAyuda}</p>
    </section>
  );
}
