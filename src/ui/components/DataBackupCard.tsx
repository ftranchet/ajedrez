// Respaldo y restauración del conjunto completo de datos (E14, RF-14.1/14.2).
// Vive en Ajustes → "Tus datos". Exporta un único .zip y restaura desde él;
// tras restaurar avisa por `onImported` para que quien lo use recargue el
// estado dependiente (perfil, sesión) sin quedar mostrando datos viejos.
import { useRef, useState } from 'react';
import { deleteAllUserData, exportAllData, importAllData } from '../../services/export/exportImport';
import { t } from '../i18n/es';
import { SectionHeading } from './SectionHeading';

export function DataBackupCard({ onImported }: { onImported?: () => void }) {
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [eliminando, setEliminando] = useState(false);
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
        const base = t.panel.importadoOk
          .replace('{partidas}', String(outcome.resumen.partidas))
          .replace('{tarjetas}', String(outcome.resumen.tarjetas))
          .replace('{calibraciones}', String(outcome.resumen.calibraciones))
          .replace('{radar}', String(outcome.resumen.respuestasRadar));
        // Restaurar un respaldo viejo lo actualiza al formato actual. Se dice:
        // el usuario tiene que poder entender por qué sus datos cambiaron de
        // forma (p. ej. intentos de cálculo que ahora sí aparecen en el Panel).
        setMensaje(
          outcome.resumen.migraciones.length > 0
            ? `${base} ${t.panel.importadoMigrado.replace('{esquema}', String(outcome.resumen.esquemaOrigen))}`
            : base,
        );
        onImported?.();
      } else {
        setMensaje(`${t.panel.importadoError}: ${outcome.error}`);
      }
    } finally {
      setImportando(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleDelete() {
    setEliminando(true);
    setMensaje(null);
    try {
      await deleteAllUserData();
      // Recarga en limpio: todos los stores re-inician desde la base vacía y
      // Hoy vuelve al diagnóstico inicial, sin quedar mostrando datos borrados.
      window.location.hash = '#/hoy';
      window.location.reload();
    } catch {
      setEliminando(false);
      setConfirmandoBorrado(false);
      setMensaje(t.panel.eliminarError);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-4">
      <SectionHeading className="mb-1">{t.panel.datos}</SectionHeading>
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

      <div className="mt-1 border-t border-subtle pt-3">
        {confirmandoBorrado ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-secondary">{t.panel.eliminarAdvertencia}</p>
            <div className="flex gap-2">
              <button onClick={() => void handleDelete()} disabled={eliminando} className="btn-danger flex-1">
                {eliminando ? t.panel.eliminando : t.panel.eliminarConfirmar}
              </button>
              <button onClick={() => setConfirmandoBorrado(false)} disabled={eliminando} className="btn-secondary flex-1">
                {t.panel.eliminarCancelar}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setConfirmandoBorrado(true); setMensaje(null); }}
            className="btn-danger w-full"
          >
            {t.panel.eliminar}
          </button>
        )}
      </div>
    </section>
  );
}
