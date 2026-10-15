# ADR-0017 — El tope diario de tarjetas limita su entrada a repaso, no su creación

- **Estado:** Aceptado
- **Fecha:** 2026-10-15
- **Requisitos relacionados:** RF-4.1, RF-4.5, RF-3.3, RF-3.5

## Contexto

RF-4.5 pide un "tope diario de tarjetas nuevas (por defecto 10) para evitar avalanchas de repaso". La implementación lo resolvía en el alta: pasadas diez tarjetas creadas en el día, `altaErrorCard` devolvía `omitir` y el error no se guardaba en ningún lado. La auditoría del 2026-10-15 (hallazgo B2) mostró el costo:

- En el análisis de una partida, la confirmación igual se contaba como hecha: el usuario confirmaba y categorizaba un error que no quedaba en ninguna parte.
- En el análisis exprés de un lote (RF-3.5), pasar de diez errores es el caso normal, y como la partida queda `analizada` nunca se vuelven a ofrecer. Esas tarjetas de origen `partida` son las que alimentan la fuga táctica (RF-11.2), el reciclaje de errores propios (RF-5.9) y los errores graves (RF-12.1).
- El tope contaba tarjetas de cualquier origen: diez fallos del Radar a la mañana bloqueaban los errores de la partida analizada a la noche.
- El día se contaba en UTC (hallazgo B3): en UTC−3 se reiniciaba a las 21:00.

Lo que RF-4.5 protege es la carga de repaso de un día, no la cantidad de errores registrados.

## Decisión

El tope limita cuántas tarjetas nuevas **entran a repaso** por día local, no cuántas se **crean**. Toda tarjeta se crea siempre. Cada tarjeta ocupa el cupo de su **día de entrada**: el de su creación, o el que se le asignó al diferirla, que queda guardado en `entraEn` y no cambia aunque después se repase. Si el día de hoy ya tiene `tope` entradas, la nueva nace con su primer vencimiento en el inicio del **primer día local con cupo** y ese día se guarda en `entraEn`. Con un solo lote y sin nada diferido de antes, la k-ésima tarjeta del día (contando desde 1) entra ⌊(k − 1) / tope⌋ días después de hoy. `creadaEn` conserva el instante real de creación.

El cupo cuenta tarjetas de **todos los orígenes** (partida, Radar, final), igual que antes: la carga de repaso de un día es una sola. Lo que cambia es que un cupo lleno ya no impide crear la tarjeta, solo demora su entrada; los fallos del Radar de la mañana dejan de borrar los errores de la partida de la noche, aunque puedan demorarlos un día.

La deduplicación por identidad (RF-4.1) no cambia: un error que ya tiene tarjeta la refuerza. La excepción es una tarjeta que todavía espera su día de entrada: se deja como está, porque el error ya está registrado y adelantarla la sumaría hoy por encima del cupo.

## Alternativas consideradas

- **Seguir omitiendo, pero avisar.** Hace visible la pérdida, pero la pérdida sigue: el error confirmado no se puede recuperar después.
- **Cola de "nuevas en espera" separada.** Es el modelo de Anki con un estado propio para la tarjeta no introducida. Exige un estado nuevo en el modelo de datos y su migración para resolver lo mismo que un vencimiento diferido, que FSRS ya entiende.
- **Deducir el día de entrada del vencimiento, sin campo nuevo.** Funciona mientras la diferida no se repasa; después su `due` cambia y vuelve a contar en su día de creación. La consecuencia, detectada en la revisión de la implementación, era que el mismo error nuevo entraba hoy o tres días después según si el usuario había hecho la Cola antes o después de analizar. `entraEn` es un campo opcional, sin índice y sin datos viejos que transformar, así que no requiere una versión nueva de la base.

## Consecuencias

Ningún error confirmado se pierde. Un día con muchos errores (un lote exprés) los distribuye en los días siguientes, de a `tope` por día, y lo que llega después se ubica detrás de lo ya diferido. El resultado no depende del orden en que el usuario repasa y analiza. Las tarjetas diferidas antes de que existiera `entraEn` cuentan en el día de su vencimiento hasta que se repasan, y después en su día de creación: es el único caso en que un día puede recibir más de `tope` nuevas. El tope sigue sin ser configurable desde la interfaz (RF-4.5 lo pide): queda pendiente.
