// Idioma de la notación algebraica (RNF-9): las dos formas son correctas según
// el Apéndice C de la FIDE —"la inicial del nombre de la pieza en el idioma del
// jugador"— y cuál se usa depende de con qué aprendió a anotar cada uno. Mucha
// gente que juega en español anota en inglés porque así lo vio siempre en
// Lichess o en chess.com, así que imponer una sería pelearse con la costumbre
// de media base de usuarios.
//
// La tarjeta incluye una explicación de cómo se lee la notación. No es relleno:
// la app pasó a **pedir** jugadas escritas en el ejercicio de cálculo, y quien
// nunca anotó una partida se queda afuera del ejercicio si no se lo explicamos
// en el mismo lugar donde elige el idioma.
import { useState } from 'react';
import { PIEZAS_POR_IDIOMA, type IdiomaNotacion } from '../../core/notacion';
import { readIdiomaNotacion, writeIdiomaNotacion } from '../notacionPrefs';
import { SegmentedControl } from './SegmentedControl';
import { SectionHeading } from './SectionHeading';
import { t } from '../i18n/es';

const NOMBRES_PIEZA = ['rey', 'dama', 'torre', 'alfil', 'caballo'] as const;
const ORDEN_INGLES = ['K', 'Q', 'R', 'B', 'N'] as const;

export function NotacionCard() {
  const [idioma, setIdioma] = useState<IdiomaNotacion>(readIdiomaNotacion);

  function cambiar(value: IdiomaNotacion) {
    writeIdiomaNotacion(value);
    setIdioma(value);
  }

  const tabla = PIEZAS_POR_IDIOMA[idioma];
  const ejemplo = idioma === 'es' ? t.ajustes.notacionEjemploEs : t.ajustes.notacionEjemploEn;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
      <div>
        <SectionHeading>{t.ajustes.notacionTitulo}</SectionHeading>
        <p className="m-0 mt-1 text-sm text-secondary">{t.ajustes.notacionTexto}</p>
      </div>

      <SegmentedControl<IdiomaNotacion>
        label={t.ajustes.notacionLabel}
        value={idioma}
        options={[
          { value: 'es', label: t.ajustes.notacionEspanol },
          { value: 'en', label: t.ajustes.notacionIngles },
        ]}
        onChange={cambiar}
        className="w-full"
      />

      {/* Las iniciales del idioma elegido, que es lo que hay que memorizar. */}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {ORDEN_INGLES.map((clave, i) => (
          <li key={clave} className="rounded-md bg-elevated px-2.5 py-1.5 text-sm text-secondary">
            <span className="font-mono font-semibold text-primary">{tabla[clave]}</span> {NOMBRES_PIEZA[i]}
          </li>
        ))}
      </ul>

      {/* Cómo se lee, para quien nunca anotó una partida. */}
      <details className="rounded-lg border border-info/40 bg-info-subtle px-3 py-2">
        <summary className="cursor-pointer list-none text-sm font-medium text-secondary marker:content-none">
          {t.ajustes.notacionComoSeLee}
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-sm text-secondary">
          <p className="m-0">{t.ajustes.notacionCasillas}</p>
          <p className="m-0">{ejemplo}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {[t.ajustes.notacionReglaPeon, t.ajustes.notacionReglaCaptura, t.ajustes.notacionReglaEnroque,
              t.ajustes.notacionReglaJaque, t.ajustes.notacionReglaCoronacion, t.ajustes.notacionReglaAmbiguedad]
              .map((regla) => (
                <li key={regla} className="flex gap-2">
                  <span aria-hidden="true" className="text-tertiary">·</span>
                  <span>{regla}</span>
                </li>
              ))}
          </ul>
          <p className="m-0 text-xs text-tertiary">{t.ajustes.notacionUci}</p>
        </div>
      </details>
    </section>
  );
}
