# Adherencia, rachas y gamificación honesta

## Objetivo

Sostener una práctica útil sin optimizar aperturas, volumen fácil ni ansiedad por no entrar a la app. La unidad de adherencia es el **plan semanal personalizado**; la unidad de progreso sigue siendo el juego real, la transferencia y la calibración.

## Principios

1. **La semana, no el día.** Entrenar ajedrez todos los días no es necesario para progresar. El plan se mide de lunes a domingo en horario local.
2. **Proceso antes que resultado.** Cuenta completar una sesión prescrita; el acierto, el rating interno y la cantidad de ejercicios no inflan la adherencia.
3. **Una sesión por día para la meta.** Una segunda sesión el mismo día suma minutos reales, pero no permite completar la semana por acumulación de volumen en una sola jornada.
4. **Minutos como contexto.** El objetivo de minutos ayuda a dimensionar la carga, pero una semana se cumple por sesiones. Evita penalizar sesiones prescritas que resultaron más cortas.
5. **Reconocimiento con significado.** Los hitos explican una capacidad o evidencia nueva. No hay XP, monedas, cofres, ranking, confeti ni recompensas por abrir la app.
6. **Recuperación sin culpa.** Perder una semana no borra la historia. La consistencia móvil conserva contexto y la interfaz propone el próximo paso.

## Modelo de producto

### Plan semanal

Planes sugeridos:

| Plan | Sesiones | Minutos orientativos |
|---|---:|---:|
| Ligero | 2 | 60 |
| Constante (predeterminado) | 3 | 90 |
| Intenso | 5 | 150 |
| Personalizado | 1–7 | 15–600 |

El perfil persiste `planSemanal`. Los perfiles y respaldos anteriores que no lo traen reciben el plan Constante al leerse, sin una migración destructiva.

### Progreso semanal

La tarjeta responde tres preguntas:

- **Cómo vengo:** `2 de 3 sesiones` y `52 de 90 min`.
- **Qué falta:** `Con una sesión más completás tu semana`.
- **Qué hago ahora:** la sesión recomendada conserva el único CTA primario de Hoy.

El Panel muestra el mismo dato como actividad secundaria. Los totales de 30 días permanecen visibles, pero se rotulan como actividad, no mejora.

### Rachas y consistencia

La siguiente iteración reemplazará la racha diaria como indicador principal por:

- racha actual de semanas cumpliendo el plan;
- mejor racha semanal;
- consistencia de las últimas ocho semanas (`6 de 8`);
- calendario compacto de doce semanas.

La consistencia de ocho semanas tendrá más jerarquía que la racha: una semana fallida no convierte meses de práctica en cero. Las pausas planificadas por vacaciones o salud no se implementan como “congeladores” consumibles; serán un estado explícito del plan.

### Hitos

Los hitos futuros se disparan por capacidades o evidencia acumulada:

- primera semana completa;
- cinco partidas analizadas;
- primer ciclo de Cola completado;
- primera medición de transferencia;
- cuatro semanas sosteniendo el plan;
- mejora suficiente en errores graves de partidas reales;
- experimento n=1 completado.

Cada hito debe explicar su significado. Ejemplo: “Analizaste cinco partidas. Ya hay material propio para detectar patrones recurrentes”. No hay recompensa por volumen aislado.

## Ubicación en la interfaz

- **Hoy:** progreso semanal entre el encabezado y la sesión recomendada, con edición secundaria del plan.
- **Cierre de sesión:** contribución de la sesión a la semana y un único siguiente paso.
- **Panel → Resumen:** plan semanal, consistencia y calendario antes de los totales de actividad.
- **Recordatorios:** configurables y apagados por defecto; se implementan después de validar el uso real.

## Entregas

| Incremento | Alcance | Estado |
|---|---|---|
| A | Plan configurable, progreso semanal en Hoy y Panel, persistencia y exportación | ✅ Implementado |
| B | Racha semanal, mejor racha, consistencia 8/8 y calendario de 12 semanas | ⬜ Pendiente |
| C | Cierre de sesión y primeros hitos significativos | ⬜ Pendiente |
| D | Pausas planificadas y recordatorios locales opcionales | ⬜ Pendiente |

## Métricas de evaluación

- porcentaje de semanas en que se cumple el plan elegido;
- cambio de plan hacia una carga sostenible, sin tratar una reducción como fracaso;
- retorno a una sesión después de una semana incompleta;
- abandono durante la configuración o ante mensajes de adherencia.

No se usa tiempo dentro de la app ni aperturas diarias como métrica de éxito del producto.
