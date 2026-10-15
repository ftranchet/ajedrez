// El porqué del bloque "¿Calcular o ya alcanza?" en Hoy (principio 8,
// RF-11.3). Desde ADR-0016 el bloque tiene dos disparadores, pero Hoy mostraba
// siempre el de errores tácticos de partida: con la fuga de cálculo sola, la
// app justificaba su prescripción con un dato que no había pasado. Vive fuera
// de HoyScreen para poder probarlo; el motivo lo decide core (dietaPorBanda) y
// acá solo se elige el texto, porque core no conoce i18n.
import type { DietaSesion } from '../core/prescriptor';
import { t } from './i18n/es';

export function porqueCriterio(dieta: Pick<DietaSesion, 'motivoCriterio' | 'ajusteCalculo'>): string {
  const conFallos = (texto: string) =>
    texto
      .replace('{fallos}', String(dieta.ajusteCalculo.fallos))
      .replace('{total}', String(dieta.ajusteCalculo.total));
  switch (dieta.motivoCriterio) {
    case 'tactica':
      return t.sesion.bloqueTriagePorque;
    case 'calculo':
      return conFallos(t.sesion.bloqueTriagePorqueCalculo);
    case 'ambas':
      return conFallos(t.sesion.bloqueTriagePorqueAmbas);
    case null:
      // El plan del día se congela al abrirlo y la dieta se recalcula en cada
      // visita: si la fuga se apagó después, el bloque sigue en el plan sin
      // motivo vigente. Se dice por qué entró, sin afirmar nada en presente.
      return t.sesion.bloqueTriagePorquePlan;
  }
}
