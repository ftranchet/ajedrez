# Probar la partida contra Maia en el navegador

Esta guía existe porque **hay una parte del producto que no se puede verificar
automáticamente**: `lichess.org` no es alcanzable desde el entorno de desarrollo
donde corren los tests. Sí lo es desde tu navegador —la app es client-side y la
llamada sale de tu máquina—, así que la función existe; lo que falta es una
prueba de punta a punta hecha por una máquina.

Lo que sí está cubierto por tests: el dominio (`src/core/maia.test.ts`) y el
flujo entero contra un doble del puerto de Lichess
(`src/ui/state/maiaStore.test.ts`, incluidos los casos de bot ocupado, token sin
permisos y PGN que no llega). Lo que falta probar a mano es **el transporte**.

## Antes de empezar

1. Necesitás una cuenta de Lichess.
2. Generá un token personal desde Ajustes → "Tu cuenta de Lichess" → "Generar un
   token en Lichess". El enlace ya viene con los permisos mínimos marcados:
   **Play games with the board API** (`board:play`) y **Create challenges**
   (`challenge:write`). Si generás el token a mano, marcá esos dos.
3. Pegalo en Ajustes y tocá "Conectar". Debería mostrar tu usuario.

> El token queda **solo en este dispositivo** y no entra en la exportación de
> tus datos (ADR-0014). Si restaurás un respaldo en otro equipo, vas a tener que
> reconectar Lichess ahí.

## Qué probar

Marcá cada uno. Si algo falla, lo útil es anotar **qué mostró la pantalla**: los
estados de error están enumerados a propósito para que digan cuál pasó.

### Camino feliz

- [ ] Jugar → Maia. Aparece la lista de bots con el sugerido para tu banda.
- [ ] Desafiar. Mientras busca, dice "Buscando partida con maiaN…" y se puede cancelar.
- [ ] La partida arranca: el tablero se orienta desde tu color y dice de quién es el turno.
- [ ] Hacés una jugada. **El tablero no la muestra hasta que Lichess la confirma**
      (es a propósito: si el servidor la rechazara, mostrarla antes sería mentir).
      Debería tardar un instante, no varios segundos.
- [ ] Maia responde y la jugada aparece sola.
- [ ] Terminás la partida (por mate, abandono o lo que salga).
- [ ] Al terminar dice "Quedó guardada en tus partidas".
- [ ] Panel → Partidas y datos: la partida está ahí, con el resultado correcto.
- [ ] Analizala en dos fases. Los errores confirmados aparecen como repasos en Hoy
      al día siguiente. **Este es el ciclo completo y es el punto de todo.**

### Lo que puede salir mal

- [ ] **Bot ocupado o caído.** Desafiá a los tres bots. Si alguno no responde,
      debería decir "El bot no aceptó el desafío… probá con otro o en un rato" y
      ofrecer el motor local. No debería quedar colgado ni decir solo "error".
- [ ] **Token inválido.** En Ajustes, desconectá y pegá un token cualquiera
      inventado. Debería decir que Lichess no lo aceptó, sin romperse.
- [ ] **Token sin permisos.** Generá uno con permisos vacíos y probá desafiar:
      debería decir qué permisos faltan, no "error desconocido".
- [ ] **Sin conexión.** Poné el navegador en modo avión y desafiá. Debería decir
      que no pudo hablar con Lichess y ofrecer el motor local.
- [ ] **Abandonar.** Desde una partida en curso, "Abandonar la partida" debería
      cerrarla también en Lichess (revisalo en tu perfil de allá).

### Detalles que importan

- [ ] El reloj: la partida es a 30+20. La app avisa que el reloj lo impone
      Lichess. ¿Te resultó un ritmo razonable para después analizar, o preferís
      otro? Es un número que se cambia en `src/core/maia.ts` (`CONTROL_LENTO`).
- [ ] ¿El bot sugerido para tu banda te resultó parejo? Si te gana siempre o le
      ganás siempre, el mapeo está en `botParaBanda` y conviene ajustarlo.
- [ ] ¿Los errores de Maia se sienten humanos? Esa es la razón entera de usarla
      en vez de Stockfish capado. Si se siente igual que el motor local, hay que
      revisar la decisión de ADR-0004, no el código.

## Si algo no anda

El adaptador HTTP está aislado en `src/services/lichess/lichessClient.ts` y es
deliberadamente delgado: solo transporte. Todo lo interpretable vive en
`src/core/maia.ts`, con tests. Si un endpoint cambió de forma, el arreglo casi
seguro es de una línea en el cliente.

Los endpoints usados están listados en el encabezado de ese archivo.
