// Límite de error de la app (R1). Sin él, una excepción al dibujar cualquier
// pantalla desmontaba el árbol entero y dejaba la app en blanco: ni
// navegación ni forma de sacar los datos. Lo que se ofrece acá no depende de
// ningún store, porque el estado en memoria puede ser justamente lo que se
// rompió: "Volver a Hoy" recarga la app desde la base, y exportar lee
// IndexedDB directo.
//
// En React un límite de error solo puede ser un componente de clase. Atrapa lo
// que falla al dibujar (render y efectos); los errores de manejadores de
// eventos y de código asíncrono no llegan acá, pero tampoco desmontan la
// pantalla.
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { descargarRespaldo } from '../descargarRespaldo';
import { t } from '../i18n/es';

interface ErrorBoundaryState {
  fallo: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { fallo: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { fallo: true };
  }

  render() {
    return this.state.fallo ? <PantallaDeFallo /> : this.props.children;
  }
}

/** Recarga en limpio sobre Hoy: todos los stores re-inician desde la base. */
function volverAHoy() {
  window.location.hash = '#/hoy';
  window.location.reload();
}

export function PantallaDeFallo() {
  const [exportando, setExportando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // La pantalla que tenía el foco ya no existe: sin esto, quedaba en <body> y
  // el lector de pantalla no anunciaba dónde había quedado parado.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, []);

  async function exportar() {
    setExportando(true);
    setMensaje(null);
    try {
      await descargarRespaldo();
      setMensaje(t.panel.exportado);
    } catch {
      setMensaje(t.panel.exportadoError);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 ref={titulo} tabIndex={-1} data-route-heading="" className="m-0 font-display text-3xl font-medium">
        {t.fallo.titulo}
      </h1>
      <section role="alert" className="flex flex-col gap-3 rounded-lg border border-error/35 bg-error-subtle p-5">
        <p className="m-0 text-sm text-primary">{t.fallo.texto}</p>
        <p className="m-0 text-sm text-secondary">{t.fallo.nota}</p>
        <button type="button" onClick={volverAHoy} className="btn-primary">
          {t.fallo.volverAHoy}
        </button>
        <button type="button" onClick={() => void exportar()} disabled={exportando} className="btn-secondary">
          {exportando ? t.panel.exportando : t.panel.exportar}
        </button>
        {mensaje && <p className="m-0 text-sm text-secondary">{mensaje}</p>}
      </section>
    </div>
  );
}
