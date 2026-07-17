// Panel. En Fase 0: lista de partidas guardadas (demuestra persistencia,
// RF-1.5) + estado vacío honesto para las métricas (Fase 5). Fase 1 agrega
// exportación/restauración completa (E14): "Exportar mis datos" alcanzable
// en 2 toques desde Hoy (Hoy → Panel → Exportar), dentro del límite de
// RF-14.1 (≤3 toques).
import { useEffect, useRef, useState } from 'react';
import type { GameRecord, RadarAttempt } from '../../core/types';
import { gameRepo } from '../../services/storage/gameRepo';
import { exportAllData, importAllData } from '../../services/export/exportImport';
import { radarAttemptRepo } from '../../services/storage/radarAttemptRepo';
import { t } from '../i18n/es';

function formatJugadas(n: number): string {
  return `${n} ${n === 1 ? t.panel.jugadaCorta : t.panel.jugadasCortas}`;
}

export function PanelScreen() {
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [radarAttempts, setRadarAttempts] = useState<RadarAttempt[] | null>(null);

  useEffect(() => {
    let alive = true;
    void gameRepo.list().then((g) => {
      if (alive) setGames(g);
    });
    void radarAttemptRepo.list().then((attempts) => {
      if (alive) setRadarAttempts(attempts);
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

      <RadarSummary attempts={radarAttempts} />

      <DatosSection />
    </div>
  );
}

function RadarSummary({ attempts }: { attempts: RadarAttempt[] | null }) {
  if (attempts === null) return null;
  if (attempts.length === 0) {
    return (
      <section>
        <h2 className="m-0 mb-2 text-sm tracking-wider text-tertiary uppercase">{t.panel.radar}</h2>
        <p className="m-0 text-secondary">{t.panel.radarSinRespuestas}</p>
      </section>
    );
  }
  const recent = attempts.slice(0, 50);
  const porcentaje = Math.round((recent.filter((attempt) => attempt.acierto).length / recent.length) * 100);
  return (
    <section>
      <h2 className="m-0 mb-2 text-sm tracking-wider text-tertiary uppercase">{t.panel.radar}</h2>
      <p className="m-0 text-primary">
        {t.panel.radarTasa.replace('{n}', String(recent.length)).replace('{porcentaje}', String(porcentaje))}
      </p>
      <p className="m-0 mt-1 text-sm text-secondary">{t.panel.radarMeta}</p>
    </section>
  );
}

function DatosSection() {
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
      } else {
        setMensaje(`${t.panel.importadoError}: ${outcome.error}`);
      }
    } finally {
      setImportando(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 mb-1 text-sm tracking-wider text-tertiary uppercase">{t.panel.datos}</h2>
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
