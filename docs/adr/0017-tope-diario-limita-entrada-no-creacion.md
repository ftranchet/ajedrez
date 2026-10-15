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

El tope limita cuántas tarjetas nuevas **entran a repaso** por día local, no cuántas se **crean**. Toda tarjeta se crea siempre; si ese día local ya se crearon `tope` o más, la nueva nace con su primer vencimiento diferido al inicio de un día local siguiente, repartiendo el excedente de a `tope` por día (la n-ésima de más va al día `1 + ⌊(n − tope) / tope⌋` después de hoy). `creadaEn` conserva el instante real de creación. La deduplicación por identidad (RF-4.1) no cambia: un error que ya tiene tarjeta la refuerza.

## Alternativas consideradas

- **Seguir omitiendo, pero avisar.** Hace visible la pérdida, pero la pérdida sigue: el error confirmado no se puede recuperar después.
- **Cola de "nuevas en espera" separada.** Es el modelo de Anki con un estado propio para la tarjeta no introducida. Exige un estado nuevo en el modelo de datos y su migración para resolver lo mismo que un vencimiento diferido, que FSRS ya entiende.
- **Contar el cupo por día de vencimiento en vez de por día de creación.** Es más exacto cuando se acumulan diferidas de varios días, pero obliga a recordar el día de introducción de cada tarjeta ya repasada (dato que hoy no existe). El reparto por día de creación acota la carga sin campos nuevos.

## Consecuencias

Ningún error confirmado se pierde. Un día con muchos errores (un lote exprés) los distribuye en los días siguientes. La cota es aproximada: un día puede recibir sus propias nuevas (hasta `tope`) más las diferidas de días anteriores, así que la carga de nuevas de un día queda acotada por un múltiplo chico de `tope`, no exactamente por `tope`. Si eso resultara insuficiente en el uso real, la señal es una Cola con más de `2 × tope` nuevas vencidas el mismo día, y la respuesta sería la alternativa de contar por día de vencimiento. El tope sigue sin ser configurable desde la interfaz (RF-4.5 lo pide): queda pendiente.
