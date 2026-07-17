// Panel. En Fase 0: lista de partidas guardadas (demuestra persistencia,
// RF-1.5) + estado vacío honesto para las métricas (Fase 5).
import { useEffect, useState } from 'react';
import type { GameRecord } from '../../core/types';
import { gameRepo } from '../../services/storage/gameRepo';
import { t } from '../i18n/es';

function formatJugadas(n: number): string {
  return `${n} ${n === 1 ? t.panel.jugadaCorta : t.panel.jugadasCortas}`;
}

export function PanelScreen() {
  const [games, setGames] = useState<GameRecord[] | null>(null);

  useEffect(() => {
    let alive = true;
    void gameRepo.list().then((g) => {
      if (alive) setGames(g);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.panel.titulo}</h1>
      <p className="m-0 text-secondary">{t.panel.vacioMetricas}</p>

      <section>
        <h2 className="m-0 mb-2 text-sm tracking-wider text-tertiary uppercase">{t.panel.partidas}</h2>
        {games === null ? null : games.length === 0 ? (
          <p className="m-0 text-secondary">{t.panel.sinPartidas}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {games.map((g) => (
              <li key={g.id} className="flex items-baseline justify-between rounded-lg border border-subtle bg-surface px-4 py-3">
                <span className="font-mono text-sm text-secondary">
                  {new Date(g.fecha).toLocaleDateString('es-AR')}
                </span>
                <span className="text-sm text-tertiary">
                  {formatJugadas(Math.ceil(g.tiemposPorJugadaMs.length / 2))}
                </span>
                <span className="font-mono text-sm text-primary">{g.resultado}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
