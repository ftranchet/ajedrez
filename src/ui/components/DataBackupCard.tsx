// Respaldo y restauración del conjunto completo de datos (E14, RF-14.1/14.2).
// Vive en Ajustes → "Tus datos". Exporta un único .zip y restaura desde él;
// tras restaurar avisa por `onImported` para que quien lo use recargue el
// estado dependiente (perfil, sesión) sin quedar mostrando datos viejos.
import { useRef, useState } from 'react';
import { exportAllData, importAllData } from '../../services/export/exportImport';
import { t } from '../i18n/es';
import { SectionHeading } from './SectionHeading';

export function DataBackupCard({ onImported }: { onImported?: () => void }) {
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
        onImported?.();
      } else {
        setMensaje(`${t.panel.importadoError}: ${outcome.error}`);
      }
    } finally {
      setImportando(false);
      if (fileInput.current) fileInput.current.value = '';
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
    </section>
  );
}
