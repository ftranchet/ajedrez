// Panel. En Fase 0: lista de partidas guardadas (demuestra persistencia,
// RF-1.5) + estado vacío honesto para las métricas (Fase 5). Fase 1 agrega
// exportación/restauración completa (E14): "Exportar mis datos" alcanzable
// en 2 toques desde Hoy (Hoy → Panel → Exportar), dentro del límite de
// RF-14.1 (≤3 toques).
import { useEffect, useRef, useState } from 'react';
import type { CalibrationRecord, GameRecord, Profile, RadarAttempt, Ritmo } from '../../core/types';
import { buildGameRecord } from '../../core/game';
import { parsePastedPgn, type PgnParseError } from '../../core/pgnImport';
import { erroresGravesPorPartidaMediaMovil } from '../../core/panel';
import { brierScore } from '../../core/calibration';
import { gameRepo } from '../../services/storage/gameRepo';
import { exportAllData, importAllData } from '../../services/export/exportImport';
import { radarAttemptRepo } from '../../services/storage/radarAttemptRepo';
import { calibrationRepo } from '../../services/storage/calibrationRepo';
import { profileRepo } from '../../services/storage/profileRepo';
import { useAnalysisStore } from '../state/analysisStore';
import { Chip } from '../components/Chip';
import { AnalizarScreen } from './AnalizarScreen';
import { t } from '../i18n/es';

function formatJugadas(n: number): string {
  return `${n} ${n === 1 ? t.panel.jugadaCorta : t.panel.jugadasCortas}`;
}

export function PanelScreen() {
  const analysisPhase = useAnalysisStore((s) => s.phase);
  const [games, setGames] = useState<GameRecord[] | null>(null);
  const [radarAttempts, setRadarAttempts] = useState<RadarAttempt[] | null>(null);
  const [calibraciones, setCalibraciones] = useState<CalibrationRecord[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [importVersion, setImportVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void gameRepo.list().then((g) => {
      if (alive) setGames(g);
    });
    void radarAttemptRepo.list().then((attempts) => {
      if (alive) setRadarAttempts(attempts);
    });
    void calibrationRepo.list().then((c) => {
      if (alive) setCalibraciones(c);
    });
    void profileRepo.get().then((p) => {
      if (alive) setProfile(p);
    });
    return () => {
      alive = false;
    };
  }, [analysisPhase, importVersion]); // recarga la lista al volver de un análisis (E3) o importar un PGN (RF-2.2)

  if (analysisPhase !== 'inactivo') return <AnalizarScreen />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.panel.titulo}</h1>

      <PanelDeVerdad games={games} calibraciones={calibraciones} profile={profile} />

      <section>
        <h2 className="m-0 mb-2 text-sm tracking-wider text-tertiary uppercase">{t.panel.partidas}</h2>
        {games === null ? null : games.length === 0 ? (
          <p className="m-0 text-secondary">{t.panel.sinPartidas}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {games.map((g) => (
              <li key={g.id} className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-sm text-secondary">
                    {new Date(g.fecha).toLocaleDateString('es-AR')}
                  </span>
                  <span className="text-sm text-tertiary">
                    {formatJugadas(Math.ceil(g.tiemposPorJugadaMs.length / 2))}
                  </span>
                  <span className="font-mono text-sm text-primary">{g.resultado}</span>
                </div>
                {g.analizada ? (
                  <span className="text-xs text-tertiary">{t.analisis.yaAnalizada}</span>
                ) : (
                  <button onClick={() => void useAnalysisStore.getState().iniciar(g.id)} className="btn-secondary">
                    {t.analisis.analizar}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ImportarPartidaSection onImported={() => setImportVersion((v) => v + 1)} />

      <RadarSummary attempts={radarAttempts} />

      <DatosSection />
    </div>
  );
}

// Panel de verdad v1 (RF-12.1): grande, al frente, sin confeti. Banda de Elo
// (categórica: sin historial real todavía no hay con qué calibrar un número
// de Elo con sentido — ver core/panel.ts), errores graves por partida
// (media móvil) y calibración (Brier, cuanto más cerca de 0 mejor).
function PanelDeVerdad({
  games,
  calibraciones,
  profile,
}: {
  games: GameRecord[] | null;
  calibraciones: CalibrationRecord[] | null;
  profile: Profile | null;
}) {
  if (games === null || calibraciones === null || profile === null) return null;

  const mediaErroresGraves = erroresGravesPorPartidaMediaMovil(games);
  const brier = brierScore(calibraciones);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
      <h2 className="m-0 text-sm tracking-wider text-tertiary uppercase">{t.panel.verdadTitulo}</h2>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-secondary">{t.panel.verdadBanda}</span>
        <span className="font-mono text-lg text-primary">
          {profile.diagnosticoCompletadoEn ? t.diagnostico.bandas[profile.bandaElo] : t.panel.verdadSinDiagnostico}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-secondary">{t.panel.verdadErroresGraves}</span>
        <span className="font-mono text-lg text-primary">
          {mediaErroresGraves === null ? t.panel.verdadSinPartidas : mediaErroresGraves.toFixed(1)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-secondary">{t.panel.verdadCalibracion}</span>
        <span className="font-mono text-lg text-primary">{brier === null ? t.panel.verdadSinCalibracion : brier.toFixed(2)}</span>
      </div>
    </section>
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

const RITMOS: Ritmo[] = ['rapida', 'clasica', 'blitz', 'bullet', 'sin-reloj'];

function errorMensaje(error: PgnParseError): string {
  if (error === 'vacio') return t.panel.importarPgnErrorVacio;
  if (error === 'sin-jugadas') return t.panel.importarPgnErrorSinJugadas;
  return t.panel.importarPgnErrorInvalido;
}

function ImportarPartidaSection({ onImported }: { onImported: () => void }) {
  const [pgn, setPgn] = useState('');
  const [ritmo, setRitmo] = useState<Ritmo>('rapida');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleImportar() {
    const resultado = parsePastedPgn(pgn);
    if (!resultado.ok) {
      setMensaje(errorMensaje(resultado.error));
      return;
    }
    setGuardando(true);
    try {
      const game = buildGameRecord({
        pgn: resultado.pgn,
        resultado: resultado.resultado,
        tiemposPorJugadaMs: [],
        fuente: 'manual',
        ritmo,
      });
      await gameRepo.save(game);
      setPgn('');
      setMensaje(t.panel.importarPgnOk);
      onImported();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 mb-1 text-sm tracking-wider text-tertiary uppercase">{t.panel.importarPgnTitulo}</h2>
      <p className="m-0 text-sm text-secondary">{t.panel.importarPgnConsigna}</p>
      <textarea
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        placeholder={t.panel.importarPgnPlaceholder}
        rows={4}
        className="w-full resize-none rounded-lg border border-subtle bg-surface p-3 font-mono text-sm text-primary placeholder:text-tertiary focus-visible:border-accent"
      />
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 p-0 text-sm text-secondary">{t.panel.importarPgnRitmo}</legend>
        <div className="flex flex-wrap gap-2">
          {RITMOS.map((r) => (
            <Chip key={r} selected={ritmo === r} onClick={() => setRitmo(r)}>
              {t.panel.ritmos[r]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <button onClick={() => void handleImportar()} disabled={guardando || pgn.trim() === ''} className="btn-secondary">
        {t.panel.importarPgnBoton}
      </button>
      {mensaje && <p className="m-0 text-sm text-secondary">{mensaje}</p>}
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
