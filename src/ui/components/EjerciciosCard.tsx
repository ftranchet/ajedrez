// Catálogo de ejercicios y sus disparadores (principio 8 del PRD:
// "transparencia epistémica").
//
// La app decide sola qué mostrarte, y eso está bien —es su primer principio—,
// pero buena parte de lo que hace era literalmente invisible: la confianza
// declarada y la regla de candidatas aparecen al azar 1 de cada 4,5 veces; la
// doble solución solo si te toca uno de esos ítems; el reciclaje de errores
// propios ocupa como mucho un cuarto de los lugares del Radar sin decirlo; el
// modo a ciegas se enciende al dominar un patrón; el bloque de criterio
// depende de fugas que hay que tener; y la batería de transferencia y el
// experimento n=1 solo existen si vas a buscarlos al Panel.
// Un usuario razonable no puede distinguir "esto no me apareció porque no me
// corresponde" de "esto no existe" — y esa duda erosiona la confianza en la
// prescripción, que es justamente lo que sostiene el producto.
//
// Esta pantalla no permite activar nada: enumera y explica. Sigue prescribiendo
// el Prescriptor.
import { SectionHeading } from './SectionHeading';
import { t } from '../i18n/es';

const EJERCICIOS = [
  'cola',
  'patrones',
  'radar',
  'dobleSolucion',
  'candidatas',
  'confianza',
  'erroresPropios',
  'ciegas',
  'criterio',
  'finales',
  'calculo',
  'partidaLenta',
  'transferencia',
  'experimento',
] as const;

export function EjerciciosCard() {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.ajustes.ejerciciosTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.ajustes.ejerciciosTexto}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {EJERCICIOS.map((clave) => {
          const ejercicio = t.ajustes.ejercicios[clave];
          return (
            <li key={clave} className="flex flex-col gap-1 rounded-md bg-elevated p-3">
              <strong className="text-sm font-semibold text-primary">{ejercicio.titulo}</strong>
              <p className="m-0 text-sm text-secondary">{ejercicio.que}</p>
              <p className="m-0 text-xs text-tertiary">
                <span className="font-semibold">{t.ajustes.ejerciciosCuando}</span> {ejercicio.cuando}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
