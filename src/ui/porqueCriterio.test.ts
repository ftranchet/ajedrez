import { describe, expect, it } from 'vitest';
import { porqueCriterio } from './porqueCriterio';
import { t } from './i18n/es';

// B9 (principio 8, RF-11.3): el porqué del bloque "¿Calcular o ya alcanza?"
// era un solo texto sobre errores tácticos de partida, falso cuando el bloque
// lo sumaba la fuga de cálculo.
describe('porqueCriterio', () => {
  const fugaCalculo = { activa: true, fallos: 6, total: 10 };
  const sinFugaCalculo = { activa: false, fallos: 0, total: 0 };

  it('con la fuga táctica sola, habla de los errores tácticos de partida (el texto de siempre)', () => {
    expect(porqueCriterio({ motivoCriterio: 'tactica', ajusteCalculo: sinFugaCalculo })).toBe(
      t.sesion.bloqueTriagePorque,
    );
  });

  it('con la fuga de cálculo sola, no afirma errores tácticos: dice cuántas veces fallaste líneas forzadas', () => {
    const texto = porqueCriterio({ motivoCriterio: 'calculo', ajusteCalculo: fugaCalculo });
    expect(texto).not.toContain('tácticos');
    expect(texto).toContain('6 de 10');
    expect(texto).toContain('línea forzada');
  });

  it('con las dos fugas, nombra las dos', () => {
    const texto = porqueCriterio({ motivoCriterio: 'ambas', ajusteCalculo: fugaCalculo });
    expect(texto).toContain('tácticos');
    expect(texto).toContain('6 de 10');
    expect(texto).toContain('línea forzada');
  });

  // El plan del día se congela a la mañana y la dieta se recalcula en cada
  // visita: el bloque puede seguir en el plan cuando ya no hay fuga activa.
  // Ahí no se puede afirmar ninguna de las dos en presente.
  it('sin fuga activa (plan armado antes en el día), declara el criterio sin afirmar ninguna en presente', () => {
    const texto = porqueCriterio({ motivoCriterio: null, ajusteCalculo: sinFugaCalculo });
    expect(texto).not.toBe(t.sesion.bloqueTriagePorque);
    expect(texto).toContain('tácticos');
    expect(texto).toContain('línea forzada');
    expect(texto).not.toContain('{');
  });

  it('no deja marcadores sin reemplazar', () => {
    for (const motivo of ['tactica', 'calculo', 'ambas', null] as const) {
      expect(porqueCriterio({ motivoCriterio: motivo, ajusteCalculo: fugaCalculo })).not.toMatch(/[{}]/);
    }
  });
});
