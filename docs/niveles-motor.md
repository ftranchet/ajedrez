# Niveles del oponente local — cómo se piden y cómo se midieron

Documenta RF-1.3a/b/c. El código vive en `src/core/engineLevels.ts`,
`src/config/engine-levels.json` y `src/services/engine/stockfishEngine.ts`; la
medición, en `scripts/measure-engine-levels.mjs` (`npm run measure:niveles`).

## El problema, en dos capas

**Capa 1 — la escalera estaba plana.** Los niveles usaban el `Skill Level` de
Stockfish (0–20), que no es una curva de dificultad: juega casi a fuerza plena y
le inyecta errores aleatorios, con un piso de ~1350 Elo. El nivel 1 se sentía
como el 5 y a veces peor, porque a veces el 5 tenía la suerte de errar y el 1 no.
Nadie lo había medido nunca.

**Capa 2 — ordenarla no alcanzó.** El primer arreglo pasó a `UCI_LimitStrength` +
`UCI_Elo` con una "imprecisión" que elegía entre las cuatro mejores líneas del
motor, y midió que los niveles altos le ganaban a los bajos. Pero el usuario
volvió a reportar desbalance, y tenía razón: **una escalera puede estar
perfectamente ordenada y ser toda demasiado fuerte.** Las cuatro mejores líneas
de Stockfish son todas buenas, así que elegir la segunda o la tercera producía
un rival un poco menos preciso, nunca uno débil. Medido:

| Nivel | cp perdidos por jugada (v2) | Lectura |
|---|---:|---|
| 1 | 82 | club bajo |
| 2 | 54 | club medio |
| 3 | **11** | prácticamente perfecto |
| 4 | 4 | perfecto |
| 5 | 1 | perfecto |

Los niveles 3, 4 y 5 se sentían iguales porque **los tres eran perfectos** para
cualquier escala humana.

Encima, el Elo que la interfaz mostraba (`≈825 Elo`) salía de una fórmula
inventada, no de una medición. Es exactamente lo que este proyecto dice no hacer.

## Cómo funcionan ahora

Una sola perilla con unidades: **temperatura en centipeones**. Se le piden varias
líneas al motor (MultiPV) y se muestrea entre ellas con peso
`exp(−pérdida / temperatura)`. Con temperatura 0 juega siempre la mejor; con 300,
una jugada que pierde 300 cp —una pieza— aparece de vez en cuando. Es la misma
escala que el análisis usa para clasificar errores (100 = error, 200 = error
grave), así que el parámetro se lee en la unidad en la que el producto ya piensa.

`UCI_LimitStrength` + `UCI_Elo` se conservan como base: limitan la *búsqueda*, de
modo que los niveles bajos además **no ven** algunas tácticas, en vez de verlas y
elegir no jugarlas.

| Nivel | `UCI_Elo` | Tiempo | Candidatas | Temperatura | **cp/jugada medidos** |
|---|---:|---:|---:|---:|---:|
| 1 | 1320 | 300 ms | 24 | 900 | **201** |
| 2 | 1320 | 350 ms | 18 | 520 | **142** |
| 3 | 1500 | 500 ms | 14 | 300 | **58** |
| 4 | 1900 | 700 ms | 10 | 150 | **42** |
| 5 | 2400 | 1000 ms | 6 | 60 | **22** |

El valor medido vive **en la propia configuración** (`acplMedido`) y es el que la
interfaz muestra. El script vuelve a medirlo y avisa si se despegó más de un 35%:
así el número que ve el usuario no puede quedar viejo en silencio.

## Cómo se mide

`npm run measure:niveles` hace dos cosas distintas y complementarias:

1. **Centipeones perdidos por jugada**, contra la mejor jugada a fuerza plena.
   Es una medida *absoluta*: responde "¿el nivel 1 juega como un principiante?".
2. **Partidas entre niveles**, con adjudicación por evaluación cuando se cortan.
   Es *ordinal*: responde "¿la escalera está ordenada?".

Hicieron falta las dos. La primera versión del script solo hacía (2) y por eso
dio por buena una escalera ordenada pero toda demasiado fuerte.

## Limitaciones honestas

- **La muestra es chica.** 30 jugadas por nivel, desde la posición inicial. Sirve
  para distinguir 201 de 58; no para afirmar que 42 y 45 son distintos.
- **El ACPL medido acá no es comparable con el de Lichess.** Se mide contra
  profundidad 12 y sobre aperturas, donde las pérdidas son menores. Las bandas
  humanas que imprime el script son referencias gruesas para poder leer el
  número, no una equivalencia de Elo.
- **No hay medición contra humanos.** La escalera está calibrada contra el motor.
  Si al usarla un nivel se siente mal, el reporte del usuario gana: la perilla es
  `temperaturaCp` y el script vuelve a medir.

## La trampa del worker compartido

Jugar y analizar comparten **un solo worker** de Stockfish. Si jugar dejara
`UCI_LimitStrength` encendido, la fase 2 del análisis (E3) correría en silencio a
1320 Elo y clasificaría los errores del usuario contra un motor capado, sin que
nada lo delatara. Por eso `searchNow` fija **siempre** las opciones, en los dos
sentidos: al jugar las enciende, al analizar las apaga.

## Cuándo volver a medir

Cada vez que se toque `engine-levels.json`, ante cualquier actualización del
paquete `stockfish`, y cada vez que alguien reporte que un nivel se siente mal.
El script devuelve código de salida distinto de cero si la escalera se
desordena o si un `acplMedido` declarado dejó de ser cierto.
