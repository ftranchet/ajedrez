# ADR-0016 — El cálculo queda como un solo ejercicio, sin presets

- **Estado:** Aceptado
- **Fecha:** 2026-08-02
- **Requisitos relacionados:** RF-7.1, RF-7.2, RF-7.3, RF-11.2, RF-11.3a
- **Reemplaza:** el punto 2 del ADR-0015 (dos presets) y la parte del punto 3 que
  define la vara del preset forzado.

## Contexto

El ADR-0015 unificó el modelo de datos del cálculo pero dejó **dos presets**
—forzado y abierto— y la pantalla los expone como dos pestañas: "Línea
comprometida" y "Stoyko semanal". Con los dos presets ya implementados y
funcionando, tres cosas que en el 0015 eran previsiones ahora se pueden mirar en
el código:

1. **El preset forzado no tiene contenido propio.** `itemsParaForzado`
   (`core/calculo.ts`) filtra el catálogo del Radar por longitud de solución: sus
   posiciones son, literalmente, las que el usuario ya ve en el bloque de Radar
   de la sesión diaria. No es un segundo ejercicio; es un segundo método de
   entrada para el mismo contenido, y lo que agrega sobre el Radar —declarar la
   línea antes de mover— es un grado, no una diferencia de tipo.

2. **Su mecánica ya vive dentro del otro ejercicio.** Cuando el preset abierto
   pasó a declarar ramas con línea completa (ADR-0015, punto 1), cada rama se
   carga ply a ply con el mismo control que el forzado. El forzado quedó siendo
   el caso particular "una rama, sin evaluación" del ejercicio que ya existe.
   Mantenerlo aparte es mantener dos pantallas para un caso que el código de la
   otra ya cubre.

3. **La pestaña es exactamente el buffet que el principio 1 del PRD rechaza.**
   Un selector con dos nombres propios —uno de ellos el apellido de un
   entrenador— le pide al usuario que elija método antes de entrenar, que es la
   decisión que la app se comprometió a tomar por él. El ADR-0015 aceptó ese
   costo para poder prescribir dosis distintas; el punto siguiente lo vuelve
   innecesario.

La restricción que en el 0015 justificaba los dos presets era de **dosis**: la
fuga de cálculo (RF-11.2) se detecta a diario y el ejercicio largo no se puede
prescribir todos los días. Pero la fuga de cálculo ya tiene una respuesta diaria
en la app que no es este ejercicio: el bloque "¿Calcular o ya alcanza?"
(`criterioActivo`), que hoy se activa solo por fuga táctica y que entrena
justamente lo que la fuga de cálculo señala —reconocer cuándo una posición pide
detenerse a calcular—, dentro de la sesión y sin costo de presupuesto aparte.

## Decisión

1. **Un solo ejercicio de cálculo, sin presets y sin selector de modo.** Es el
   ejercicio abierto: posición sin respuesta única, 2 a 5 ramas, profundidad
   libre, evaluación obligatoria al final de cada rama, sin reloj, con las tres
   varas del ADR-0015 punto 3 (cobertura, profundidad vista, brecha de
   evaluación) que se siguen leyendo por separado.

2. **La fuga de cálculo deja de prescribir un ejercicio corto propio y pasa a
   activar el bloque de criterio** de la sesión diaria, junto a la fuga táctica.
   La señal (`detectarFugaCalculo`) no se toca: se le cambia la respuesta.

3. **`PresetCalculo` sobrevive como campo de datos, no como modo de la app.**
   Los intentos con `preset: 'forzado'` ya guardados —los que la migración a
   esquema 18 convirtió desde `compromisoAttempts`— se siguen leyendo,
   exportando y mostrando en el Panel como historial. Ningún código nuevo
   escribe ese valor. No hay migración de datos en este cambio: nada que ya esté
   guardado cambia de forma.

4. **El ejercicio se nombra por lo que es, no por quién lo popularizó.** En la
   interfaz es "Cálculo"; la atribución a Stoyko queda en la explicación
   desplegable, donde sirve como referencia y no como marca de un modo elegible.

## Alternativas consideradas

- **Dejar las dos pestañas y solo mejorar los nombres** — es lo más barato y no
  toca datos. Se descarta porque el problema no es cómo se llaman: son dos
  entradas para el mismo acto, una de ellas sin contenido propio, y el costo se
  paga de nuevo en cada métrica, cada resumen del Panel y cada prescripción que
  haya que escribir dos veces.
- **Quedarse con el forzado y descartar el abierto** — el corto entra en el
  presupuesto diario, que es una ventaja real. Se descarta porque es el que no
  tiene contenido propio: sin posiciones propias del usuario, sin evaluación
  declarada y sin brecha contra el motor, se pierde justamente la parte que
  `docs/evidence/` valora del ejercicio, y lo que queda es el Radar con otra
  interfaz.
- **Borrar `detectarFugaCalculo` junto con el preset que prescribía** — deja el
  cambio más chico. Se descarta porque es una señal medida sobre los datos del
  usuario que ya funciona; quitarle la respuesta es un motivo para redirigirla,
  no para tirarla.

## Consecuencias

- Se gana: una pantalla, un modelo mental y una prescripción menos; el bloque de
  criterio queda con los dos disparadores que le corresponden.
- Se paga: la fuga de cálculo ya no tiene una respuesta de 6 minutos con el
  tablero declarando líneas; su respuesta diaria ahora es el bloque de criterio,
  que es más barato y menos específico. El ejercicio de cálculo propiamente
  dicho queda como carga semanal (RF-11.3a) más las corridas de práctica que el
  enfriamiento ya ofrece.
- Deuda registrada: `resumenForzado` (`core/calculoSummary.ts`) queda sirviendo
  solo historial. Cuando ningún usuario activo tenga intentos con
  `preset: 'forzado'`, se puede borrar junto con su tarjeta del Panel.
- Señal que obligaría a revisar esto: que la brecha de evaluación no mejore y el
  ejercicio semanal se saltee sistemáticamente. Ahí el problema sería la dosis
  del ejercicio que queda, no la falta del que se va.
