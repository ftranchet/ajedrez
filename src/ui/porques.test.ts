import { describe, expect, it } from 'vitest';
import { porqueCriterio, porqueRadar } from './porques';
import { t } from './i18n/es';

const sinFugaTactica = { categoria: null, proporcion: 0.2 } as const;
const fugaTactica = (proporcion: number) => ({ categoria: 'tactico', proporcion }) as const;
const fugaCalculo = { activa: true, fallos: 6, total: 10 };
const sinFugaCalculo = { activa: false, fallos: 0, total: 0 };

// B9 (principio 8, RF-11.3): el porqué del bloque "¿Calcular o ya alcanza?"
// era un solo texto sobre errores tácticos de partida, falso cuando el bloque
// lo sumaba la fuga de cálculo.
describe('porqueCriterio', () => {
  it('con la fuga táctica sola, dice qué porcentaje de errores de partida fueron tácticos', () => {
    expect(
      porqueCriterio({ motivoCriterio: 'tactica', ajusteCalculo: sinFugaCalculo, ajusteFugas: fugaTactica(0.6) }),
    ).toBe('El 60% de tus errores recientes de partida son tácticos: conviene afinar cuándo hay que detenerse a calcular.');
  });

  // Revisión de B9: la fuga se activa con más del 35%, y "sobre todo
  // tácticos" afirmaba una mayoría que no existía.
  it('con 4 tácticos de 11 (36%) no afirma que sean la mayoría', () => {
    const texto = porqueCriterio({ motivoCriterio: 'tactica', ajusteCalculo: sinFugaCalculo, ajusteFugas: fugaTactica(4 / 11) });
    expect(texto).toContain('El 36%');
    expect(texto).not.toMatch(/sobre todo|mayoría/);
  });

  // Revisión final de la etapa 1: 6 de 17 activa la fuga (35,3%), y "El 35%"
  // contradecía la regla de "más del 35%" que muestran Ajustes y el Panel.
  it('con 6 tácticos de 17 (35,3%) no redondea al umbral', () => {
    const texto = porqueCriterio({ motivoCriterio: 'tactica', ajusteCalculo: sinFugaCalculo, ajusteFugas: fugaTactica(6 / 17) });
    expect(texto).toContain('El 35,3%');
    expect(porqueRadar({ ajusteFugas: fugaTactica(6 / 17) }, [])).toBe('Reforzado: el 35,3% de tus errores recientes de partida son tácticos.');
    // Apenas por encima del umbral, tampoco "35,0".
    expect(porqueRadar({ ajusteFugas: fugaTactica(0.35001) }, [])).toContain('el 35,1%');
  });

  it('con la fuga de cálculo sola, no afirma errores tácticos: dice cuántas veces fallaste líneas forzadas', () => {
    const texto = porqueCriterio({ motivoCriterio: 'calculo', ajusteCalculo: fugaCalculo, ajusteFugas: sinFugaTactica });
    expect(texto).not.toContain('tácticos');
    expect(texto).toContain('6 de 10');
    expect(texto).toContain('línea forzada');
  });

  it('con las dos fugas, nombra las dos con sus datos', () => {
    const texto = porqueCriterio({ motivoCriterio: 'ambas', ajusteCalculo: fugaCalculo, ajusteFugas: fugaTactica(0.5) });
    expect(texto).toContain('El 50%');
    // Son intentos, no posiciones distintas: el Radar repite posiciones.
    expect(texto).toContain('6 de 10 veces');
    expect(texto).toContain('línea forzada');
  });

  // El plan del día se congela a la mañana y la dieta se recalcula en cada
  // visita: el bloque puede seguir en el plan cuando ya no hay fuga activa.
  // Ahí no se puede afirmar ninguna de las dos en presente.
  it('sin fuga activa (plan armado antes en el día), declara el criterio sin afirmar ninguna en presente', () => {
    const texto = porqueCriterio({ motivoCriterio: null, ajusteCalculo: sinFugaCalculo, ajusteFugas: sinFugaTactica });
    expect(texto).toBe(t.sesion.bloqueTriagePorquePlan);
    expect(texto).toContain('más del 35%');
    expect(texto).toContain('línea forzada');
  });

  it('no deja marcadores sin reemplazar', () => {
    for (const motivo of ['tactica', 'calculo', 'ambas', null] as const) {
      expect(porqueCriterio({ motivoCriterio: motivo, ajusteCalculo: fugaCalculo, ajusteFugas: fugaTactica(0.4) })).not.toMatch(/[{}]/);
    }
  });
});

describe('porqueRadar', () => {
  it('una fuga por tipo manda sobre el refuerzo táctico', () => {
    expect(porqueRadar({ ajusteFugas: fugaTactica(0.5) }, ['defensa'])).toBe(
      t.sesion.bloqueRadarPorqueTipo.replace('{tipo}', t.diagnostico.tiposRadar.defensa.toLowerCase()),
    );
  });

  it('el refuerzo táctico dice el porcentaje medido, no "la mayoría"', () => {
    const texto = porqueRadar({ ajusteFugas: fugaTactica(4 / 11) }, []);
    expect(texto).toBe('Reforzado: el 36% de tus errores recientes de partida son tácticos.');
  });

  it('sin fugas, el porqué de siempre', () => {
    expect(porqueRadar({ ajusteFugas: sinFugaTactica }, [])).toBe(t.sesion.bloqueRadarPorque);
  });
});
