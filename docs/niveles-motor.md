# Niveles del oponente local — cómo se piden y cómo se midieron

Documenta RF-1.3a/b/c. El código vive en `src/core/engineLevels.ts`,
`src/config/engine-levels.json` y `src/services/engine/stockfishEngine.ts`; la
medición, en `scripts/measure-engine-levels.mjs` (`npm run measure:niveles`).

## El problema que esto corrige

Los niveles se implementaban con el `Skill Level` de Stockfish (0–20) y **nadie
había comprobado nunca que el nivel 1 fuera más fácil que el 5**. No lo era, y el
usuario lo notó antes que cualquier test:

> "los niveles de dificultad son mentira, el nivel 1 me resulta tan difícil como
> el 5, de hecho a veces más"

La causa es que `Skill Level` no es una curva de dificultad: juega casi a fuerza
plena y le inyecta errores aleatorios, con un piso de ~1350 Elo. Sumado a
presupuestos de 250–1000 ms —que ya limitan la profundidad por sí solos—, la
diferencia entre extremos quedaba dentro del ruido. Y la asimetría que describe
la cita es exactamente lo que produce ese mecanismo: a veces el nivel alto tiene
la suerte de errar y el bajo no.

Los nombres de la interfaz ("Nivel 1 — da sus primeros pasos") prometían una
progresión que el archivo de configuración no entregaba.

## Cómo se piden ahora

`UCI_LimitStrength` + `UCI_Elo`, que es el mecanismo que Stockfish expone para
esto y que el motor calibra contra su propia escala. Su rango es **1320–3190**
(comprobado contra el binario del proyecto, no de memoria).

Por debajo del piso de 1320 la persona objetivo del PRD (900–1900) todavía
necesita rival, así que los dos niveles más bajos agregan **imprecisión
declarada**: se piden cuatro líneas al motor y, con probabilidad `imprecision`,
se juega una alternativa en vez de la mejor. Se elige entre las líneas del
propio motor y nunca entre jugadas legales al azar: un rival que de golpe cuelga
una dama no enseña nada y no se parece a nadie.

| Nivel | `UCI_Elo` | Tiempo | Imprecisión | Elo aproximado |
|---|---:|---:|---:|---:|
| 1 | 1320 | 400 ms | 0,55 | ~825 |
| 2 | 1320 | 400 ms | 0,25 | ~1095 |
| 3 | 1450 | 500 ms | — | ~1450 |
| 4 | 1950 | 900 ms | — | ~1950 |
| 5 | 2600 | 1400 ms | — | ~2600 |

El "Elo aproximado" es una estimación para poder nombrar el nivel con un número
en vez de un adjetivo. La interfaz dice que es aproximado.

## Qué se midió

`npm run measure:niveles` juega los niveles entre sí, alternando colores, y
adjudica por evaluación a fuerza plena las partidas que se cortan por límite de
jugadas — sin eso, cortar temprano llamaba "tablas" a partidas donde un lado
tenía torre de más, y diluía la señal.

Resultados sobre la configuración actual:

| Par | Resultado del nivel alto | Partidas | Corte |
|---|---:|---:|---:|
| 5 vs 1 | 100% | 4 | 120 plies |
| 3 vs 1 | 100% | 4 | 120 plies |
| 3 vs 2 | 75% | 4 | 60 plies |
| 5 vs 3 | 75% | 4 | 130 plies |

**Limitaciones honestas de esta medición.** Cuatro partidas por par es una
muestra chica: distingue "la escalera funciona" de "la escalera está plana"
—que era el bug—, pero no alcanza para afirmar la distancia en Elo entre dos
niveles contiguos. Los Elo de la tabla son los que se le **piden** al motor, no
los que se midieron contra una federación.

La primera versión de esta configuración usaba 1500/1800/2100 en los niveles
3/4/5 y **el par 5 vs 3 daba 50%**: a esos presupuestos de tiempo, en WASM de un
solo hilo, pedir 2100 en vez de 1500 no cambiaba lo suficiente. Se separó el
tramo superior (1450/1950/2600) y se le dio más tiempo a los niveles altos, que
es una palanca de fuerza real e independiente de `UCI_Elo`.

## La trampa del worker compartido

Jugar y analizar comparten **un solo worker** de Stockfish. Si jugar dejara
`UCI_LimitStrength` encendido, la fase 2 del análisis (E3) correría en silencio
a 1320 Elo y clasificaría los errores del usuario contra un motor capado, sin
que nada lo delatara en la interfaz ni en los tests.

Por eso `searchNow` fija **siempre** las dos opciones, en los dos sentidos: al
jugar las enciende, al analizar las apaga. Nunca se asume el estado previo.

## Cuándo volver a medir

Cada vez que se toque `engine-levels.json`, y ante cualquier actualización del
paquete `stockfish` — `UCI_Elo` es una calibración interna del motor y puede
cambiar entre versiones. El script devuelve código de salida distinto de cero si
algún nivel alto no supera al bajo, así que sirve como verificación y no solo
como reporte.
