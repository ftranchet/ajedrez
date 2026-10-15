import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatearLinea } from '../../core/radarExplicacion';
import { t } from '../i18n/es';
import { FeedbackPanel } from './FeedbackPanel';

/** Los renglones de texto del panel, sin marcado ni los separadores de React. */
function renglones(props: { acierto: boolean; jugadaCorrecta: string; linea?: string }): string[] {
  const html = renderToStaticMarkup(createElement(FeedbackPanel, { texto: 'porqué', onContinuar: () => {}, ...props }));
  return [...html.matchAll(/<p[^>]*>(.*?)<\/p>/g)].map(([, contenido]) => contenido.replace(/<!-- -->/g, ''));
}

// La posición del mate del pastor, con las blancas en la jugada 4. Las líneas
// las arma `formatearLinea`, igual que en el Radar y el diagnóstico, para que
// el test no dependa de una copia a mano de su formato.
const FEN_JUGADA_4 = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
const lineaDeUnaJugada = formatearLinea(FEN_JUGADA_4, ['Qxf7#'], 'es');
const lineaDeTresJugadas = formatearLinea(FEN_JUGADA_4, ['Bxf7+', 'Ke7', 'Bb3'], 'es');

describe('FeedbackPanel: línea completa o jugada correcta', () => {
  // Regresión del hallazgo N1 de la auditoría 2026-10-15: la condición
  // comparaba la línea ("4.Dxf7#", con número) contra la jugada suelta
  // ("Dxf7#"), que nunca son iguales, y un fallo en una solución de una sola
  // jugada mostraba "Línea completa: 4.Dxf7#" en vez de "Jugada correcta".
  it('con una solución de una jugada, el fallo dice la jugada correcta y no una "línea"', () => {
    expect(lineaDeUnaJugada).toBe('4.Dxf7#');
    const texto = renglones({ acierto: false, jugadaCorrecta: 'Dxf7#', linea: lineaDeUnaJugada });
    expect(texto).toContain(`${t.radar.jugadaCorrecta}: Dxf7#`);
    expect(texto.join('\n')).not.toContain(t.radar.lineaCompleta);
  });

  it('con una solución de una jugada, el acierto no repite la jugada que se acaba de hacer', () => {
    const texto = renglones({ acierto: true, jugadaCorrecta: 'Dxf7#', linea: lineaDeUnaJugada }).join('\n');
    expect(texto).not.toContain(t.radar.lineaCompleta);
    expect(texto).not.toContain(t.radar.jugadaCorrecta);
  });

  it('con una línea de varias jugadas, se muestra la línea y no además la primera jugada suelta', () => {
    expect(lineaDeTresJugadas).toBe('4.Axf7+ Re7 5.Ab3');
    for (const acierto of [false, true]) {
      const texto = renglones({ acierto, jugadaCorrecta: 'Axf7+', linea: lineaDeTresJugadas });
      expect(texto).toContain(`${t.radar.lineaCompleta}: 4.Axf7+ Re7 5.Ab3`);
      expect(texto.join('\n')).not.toContain(t.radar.jugadaCorrecta);
    }
  });

  it('sin línea (Cola, currículo), el fallo dice la jugada correcta', () => {
    expect(renglones({ acierto: false, jugadaCorrecta: 'Ac5' })).toContain(`${t.radar.jugadaCorrecta}: Ac5`);
    expect(renglones({ acierto: false, jugadaCorrecta: 'Ac5', linea: '' })).toContain(`${t.radar.jugadaCorrecta}: Ac5`);
  });
});
