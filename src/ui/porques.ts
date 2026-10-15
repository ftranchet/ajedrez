// Los porqués de los bloques de Hoy (principio 8, RF-11.3): cada prescripción
// se justifica con el dato que la disparó, y solo con ese.
//
// Viven fuera de HoyScreen para poder probarlos. El motivo lo decide core
// (dietaPorBanda) y acá solo se arma el texto, porque core no conoce i18n.
//
// Dos correcciones de la auditoría 2026-10-15 quedaron acá:
// - B9: el bloque "¿Calcular o ya alcanza?" tiene dos disparadores desde
//   ADR-0016, pero Hoy mostraba siempre el de errores tácticos de partida.
// - La fuga táctica se activa con más del 35% de errores tácticos, y el texto
//   decía "sobre todo tácticos" o "la mayoría": con 4 tácticos de 11 (36%)
//   afirmaba lo contrario de lo que pasaba. Ahora se dice el porcentaje.
import type { DietaSesion } from '../core/prescriptor';
import type { TipoRadar } from '../core/types';
import { formatDecimal } from './format';
import { t } from './i18n/es';

/**
 * Porcentaje de errores tácticos que midió la fuga, para decirlo tal cual. La
 * fuga se activa con más del 35%, y redondear 6 de 17 (35,3%) a "El 35%"
 * contradecía esa regla, que la app enuncia. Entre 35 y 35,5 va un decimal,
 * redondeado hacia arriba para no caer en "35,0".
 */
const porcentajeTactico = (dieta: Pick<DietaSesion, 'ajusteFugas'>): string => {
  const pct = dieta.ajusteFugas.proporcion * 100;
  if (pct > 35 && pct < 35.5) return formatDecimal(Math.ceil(pct * 10) / 10, 1);
  return String(Math.round(pct));
};

export function porqueCriterio(dieta: Pick<DietaSesion, 'motivoCriterio' | 'ajusteCalculo' | 'ajusteFugas'>): string {
  const conDatos = (texto: string) =>
    texto
      .replace('{pct}', porcentajeTactico(dieta))
      .replace('{fallos}', String(dieta.ajusteCalculo.fallos))
      .replace('{total}', String(dieta.ajusteCalculo.total));
  switch (dieta.motivoCriterio) {
    case 'tactica':
      return conDatos(t.sesion.bloqueTriagePorque);
    case 'calculo':
      return conDatos(t.sesion.bloqueTriagePorqueCalculo);
    case 'ambas':
      return conDatos(t.sesion.bloqueTriagePorqueAmbas);
    case null:
      // El plan del día se congela al abrirlo y la dieta se recalcula en cada
      // visita: si la fuga se apagó después, el bloque sigue en el plan sin
      // motivo vigente. Se dice por qué entró, sin afirmar nada en presente.
      return t.sesion.bloqueTriagePorquePlan;
  }
}

/**
 * Por qué el Radar viene como viene. La fuga por tipo (RF-11.2) es más
 * específica que el refuerzo por errores tácticos, así que manda cuando hay
 * las dos; sin ninguna, el porqué de siempre.
 */
export function porqueRadar(dieta: Pick<DietaSesion, 'ajusteFugas'>, fugas: TipoRadar[]): string {
  if (fugas.length > 0) {
    return t.sesion.bloqueRadarPorqueTipo.replace('{tipo}', t.diagnostico.tiposRadar[fugas[0]].toLowerCase());
  }
  return dieta.ajusteFugas.categoria === 'tactico'
    ? t.sesion.bloqueRadarPorqueFuga.replace('{pct}', porcentajeTactico(dieta))
    : t.sesion.bloqueRadarPorque;
}
