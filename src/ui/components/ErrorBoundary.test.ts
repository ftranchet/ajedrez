// Sin DOM en los unitarios: se prueba la decisión del límite y lo que dibuja.
// Que de verdad atrape un error de render lo cubre e2e/limite-error.spec.ts.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { t } from '../i18n/es';
import { ErrorBoundary, PantallaDeFallo } from './ErrorBoundary';

const hijo = createElement('p', null, 'contenido de la pantalla');

describe('ErrorBoundary (R1)', () => {
  it('sin error dibuja la pantalla tal cual', () => {
    expect(renderToStaticMarkup(createElement(ErrorBoundary, null, hijo))).toBe('<p>contenido de la pantalla</p>');
  });

  it('un error al dibujar reemplaza la pantalla por la de fallo', () => {
    const limite = new ErrorBoundary({ children: hijo });
    limite.state = ErrorBoundary.getDerivedStateFromError();
    const html = renderToStaticMarkup(limite.render());
    expect(html).not.toContain('contenido de la pantalla');
    expect(html).toContain(t.fallo.titulo);
  });

  it('la pantalla de fallo ofrece volver a Hoy y exportar los datos', () => {
    const html = renderToStaticMarkup(createElement(PantallaDeFallo));
    expect(html).toContain(t.fallo.texto);
    expect(html).toContain(t.fallo.nota);
    expect(html).toContain(`>${t.fallo.volverAHoy}</button>`);
    expect(html).toContain(`>${t.panel.exportar}</button>`);
    expect(html).toContain('role="alert"');
  });
});
