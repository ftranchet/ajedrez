# Niveles del oponente local — cómo se piden y cómo se midieron

Documenta RF-1.3a/b/c. El código vive en `src/core/engineLevels.ts`,
`src/config/engine-levels.json` y `src/services/engine/stockfishEngine.ts`; las
mediciones, en `scripts/measure-engine-levels.mjs` (`npm run measure:niveles`)
y `scripts/measure-elo-anclas.mjs` (`npm run measure:elo`).

## Ocho niveles, y por qué el rótulo volvió a ser un Elo

Cinco escalones eran pocos para notar progreso: subir de nivel era un salto,
no un paso. Ahora son ocho, y van de ≈825 a ≈1775.

El rótulo pasó por cuatro versiones, y las tres primeras fallaron por motivos
distintos que conviene no repetir:

1. **Adjetivos** ("da sus primeros pasos"): prometían una curva que el motor no
   entregaba, y el usuario no tenía cómo notar la diferencia.
2. **Un Elo calculado con una fórmula inventada** (`uciElo − imprecisión × 900`).
   Exactamente lo que este proyecto dice no hacer.
3. **Centipeones perdidos por jugada.** Honestos y medidos, pero —dicho por el
   usuario— "una métrica que la mayoría de los jugadores no entiende". Un
   número correcto que no le sirve a nadie no es una buena respuesta.
4. **Elo medido por resultado de partidas**, que es lo que hay hoy.

## Cómo se mide el Elo

Elo es, por definición, una escala de **diferencias derivadas del resultado
esperado**: `Δ = 400·log10(S/(1−S))`. El script juega partidas y aplica eso.

La referencia es Stockfish limitado con `UCI_Elo` a 1320 —su fuerza declarada
más baja—, que es el único rival con una escala calibrada disponible sin
jugadores humanos.

### Dos caminos que no funcionaron, y están medidos

**Traducir cp/jugada a Elo.** La idea era medir el ACPL de Stockfish a varios
`UCI_Elo` y buscar el que empatara con cada nivel. La curva salió **no
monótona**:

| `UCI_Elo` | 1320 | 1500 | 1700 | 1900 | 2200 | 2500 | 2900 |
|---|---:|---:|---:|---:|---:|---:|---:|
| cp/jugada | 40 | 34 | 18 | 21 | 11 | 21 | 19 |

En 24 jugadas desde la apertura todos los motores fuertes juegan igual de bien.
Y hay algo peor: Stockfish en su piso ya pierde solo ~40 cp/jugada, o sea que
**media escalera de la app queda por debajo del piso de la referencia** y no
habría número que asignarle.

**Anclar cada nivel por separado contra la referencia.** Los niveles 1 a 6 de
la escalera anterior perdían 6-0 contra Stockfish@1320, y el nivel 8 le ganaba
6-0. Con los dos extremos saturados, el resultado son cotas, no estimaciones —
la primera cadena completa dio un nivel 1 en **−600 Elo**, que es una respuesta
sin sentido presentada con cara de precisión.

### Lo que sí funcionó

Anclar **un** nivel y encadenar por pares contiguos. Con eso se midieron tres
puntos de la curva temperatura → Elo:

| Temperatura | 210 | 130 | 60 |
|---|---:|---:|---:|
| Elo medido | ≈900 | ≈1320 | ≈1737 |

La escalera publicada se traza sobre esa curva. **Los tres puntos están
medidos; los escalones intermedios se interpolan sobre ella.**

| Nivel | `UCI_Elo` | Tiempo | Candidatas | Temperatura | Elo |
|---|---:|---:|---:|---:|---:|
| 1 | 1320 | 300 ms | 16 | 230 | ≈825 |
| 2 | 1320 | 350 ms | 14 | 200 | ≈950 |
| 3 | 1450 | 400 ms | 13 | 172 | ≈1075 |
| 4 | 1600 | 450 ms | 12 | 146 | ≈1225 |
| 5 | 1750 | 550 ms | 11 | 122 | ≈1350 |
| 6 | 1900 | 650 ms | 10 | 100 | ≈1450 |
| 7 | 2100 | 800 ms | 8 | 78 | ≈1600 |
| 8 | 2400 | 1000 ms | 6 | 55 | ≈1775 |

## Limitaciones honestas

- **La incertidumbre es de ±200, y no es una formalidad.** Con 6 partidas por
  par, dos niveles contiguos **no se distinguen del ruido**: en una corrida de
  prueba con esta misma escalera, el nivel 3 midió *más débil* que el nivel 2.
  Resolver escalones de ~125 Elo pediría del orden de 50 partidas por par, unas
  seis horas de cómputo. El número sirve para ubicarse y para subir de a poco;
  no para compararse.
- **No es Elo FIDE ni de Lichess.** Es la escala de Stockfish. No hay medición
  contra humanos.
- **La escalera está ordenada por construcción, no verificada escalón a
  escalón.** Lo verificado es la curva de tres puntos.
- **Es un motor, no una persona.** Se equivoca de otra manera: por eso existe
  el modo Maia, y por eso jugar y analizar sigue siendo el ejercicio central.

## Cómo funciona la debilidad

Una sola perilla con unidades: **temperatura en centipeones**. Se le piden
varias líneas al motor (MultiPV) y se muestrea entre ellas con peso
`exp(−pérdida / temperatura)`. Con temperatura 0 juega siempre la mejor; con
230, una jugada que pierde 230 cp aparece de vez en cuando.

`UCI_LimitStrength` + `UCI_Elo` se conservan como base: limitan la *búsqueda*,
de modo que los niveles bajos además **no ven** algunas tácticas, en vez de
verlas y elegir no jugarlas.

## Centipeones perdidos por jugada

Sigue midiéndose (`npm run measure:niveles`), pero como señal **interna** de
que la escalera no se desordena: ya no es lo que ve el usuario.

Esa medición también se corrigió. Antes cada nivel arrancaba desde la posición
inicial y jugaba su propia partida, así que cada uno medía sobre posiciones
distintas y una partida filosa le inflaba el promedio a ese nivel solo. Medido
con esa versión, un nivel dio 146 cp/jugada entre uno de 61 y otro de 35 — un
desorden que era del instrumento. Ahora todos los niveles enfrentan **las
mismas** posiciones, tomadas del catálogo del Radar (diverso y determinista),
así que la comparación queda pareada.

## La trampa del worker compartido

Jugar y analizar comparten **un solo worker** de Stockfish. Si jugar dejara
`UCI_LimitStrength` encendido, la fase 2 del análisis (E3) correría en silencio
a 1320 Elo y clasificaría los errores del usuario contra un motor capado, sin
que nada lo delatara. Por eso `searchNow` fija **siempre** las opciones, en los
dos sentidos: al jugar las enciende, al analizar las apaga.

## Cuándo volver a medir

Cada vez que se toque `engine-levels.json`, ante cualquier actualización del
paquete `stockfish`, y cada vez que alguien reporte que un nivel se siente mal.
