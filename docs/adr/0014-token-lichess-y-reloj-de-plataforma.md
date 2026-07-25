# ADR-0014 — Token de Lichess device-local y reloj impuesto por la plataforma

- **Estado:** Aceptado
- **Fecha:** 2026-07-25
- **Requisitos relacionados:** RF-1.4, RF-14.1, E9
- **Relacionado con:** ADR-0004 (elige Maia vía Lichess), que este ADR implementa sin reemplazar

## Contexto

ADR-0004 decidió jugar contra los bots Maia de Lichess. Al implementarlo
aparecieron dos decisiones que ese ADR no cubría y que tienen costo de reversa
alto: **dónde vive el token** del usuario y **qué pasa con el reloj**.

También quedó claro que el roadmap venía describiendo mal el bloqueo. Decía que
Maia estaba "bloqueado por red", pero el bloqueo es del **entorno de
desarrollo**: `lichess.org` no es alcanzable desde ahí. La app es client-side y
la llamada sale del navegador del usuario, donde sí lo es. Lo que falta no es la
posibilidad de construirlo, sino la posibilidad de **verificarlo automáticamente**.

## Decisión

**1. El token vive en `localStorage`, no en el perfil.** El perfil entra completo
en la exportación (RF-14.1), que está pensada para moverse entre equipos y para
que el usuario la abra, la lea y la comparta si quiere. Una credencial con
permiso de jugar en su cuenta no puede viajar ahí: convertiría un archivo de
respaldo en una llave suelta. Se guarda como preferencia de dispositivo, igual
que el tema y el modo a ciegas, y la interfaz lo declara en vez de dejarlo a la
confianza. Un test de `core/exportData.test.ts` fija la frontera.

Se piden los permisos mínimos: `challenge:write` y `board:play`.

**2. Se acepta el reloj de la plataforma y se declara.** ELOmax se juega sin
reloj (E9), pero la interfaz de Lichess exige un control de tiempo o
correspondencia. Se elige **30 minutos + 20 segundos**: lo más largo que sigue
entrando en una sentada, para que la partida se pueda analizar enseguida —que es
el punto del ciclo— sin convertirla en una carrera. La incoherencia es de la
plataforma, no del producto, y se dice en pantalla.

**3. El tablero local es un espejo, nunca la fuente de verdad.** Cada
actualización del stream trae la lista completa de jugadas y el tablero se
reconstruye desde ahí. Una jugada propia **no se pinta hasta que Lichess la
devuelve**: mostrarla antes sería afirmar algo que el servidor podría rechazar.

**4. Los fallos se enumeran.** Token inválido, permisos faltantes, bot no
disponible, límite de tasa y sin conexión son estados distintos con salidas
distintas. Que un bot esté ocupado es un desenlace **normal**, no un error de la
app, y la salida siempre ofrece el motor local.

## Alternativas consideradas

- **Token en el perfil, excluyéndolo al exportar.** Más simple de leer, pero la
  exclusión sería una regla que hay que recordar en cada cambio del exportador;
  la separación física no se olvida.
- **Correspondencia (días por jugada) en vez de reloj.** Más fiel al juego sin
  reloj, pero la partida deja de terminar en una sentada y rompe el ciclo
  jugar → analizar, que es de donde sale todo el valor.
- **Aplicar la jugada localmente y corregir si Lichess la rechaza.** Más
  reactivo, pero introduce estados donde el tablero muestra una posición que no
  existe en el servidor.
- **Esperar a poder verificar de punta a punta.** Habría dejado sin construir
  indefinidamente el rival que el PRD considera central, por una limitación del
  entorno de desarrollo que no afecta al usuario.

## Consecuencias

El ejercicio tier-S del proyecto —jugar y analizar contra un rival con errores
humano-plausibles— queda disponible. A cambio:

- **La verificación de punta a punta es manual.** Los tests cubren el dominio
  (`core/maia.ts`) y el flujo contra un doble del puerto (`maiaStore.test.ts`);
  el transporte real se prueba en el navegador siguiendo `docs/maia-prueba.md`.
  Por eso el adaptador HTTP es deliberadamente delgado: cuanto menos lógica
  tenga, menos hay que verificar a mano.
- **Depende de que los bots estén en línea.** Son cuentas reales operadas por
  terceros. El motor local, cuyos niveles ahora están medidos (RF-1.3b), es el
  plan B y se ofrece explícitamente cuando el desafío no prospera.
- **Cambiar de guardado del token exige migrar a mano.** No está en la
  exportación, así que restaurar un respaldo en otro equipo pide reconectar
  Lichess. Es el precio correcto para una credencial.
