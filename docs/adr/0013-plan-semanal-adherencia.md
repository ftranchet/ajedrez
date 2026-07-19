# ADR-0013 — Plan semanal como unidad de adherencia

**Estado:** Aceptado

**Fecha:** 2026-07-19

**Reemplaza:** la racha diaria como indicador principal de ADR-0011; conserva su definición de proceso y celebración con métricas de verdad.

## Contexto

Una racha diaria es frágil y presupone que entrenar todos los días es deseable. Puede convertir una ausencia razonable en pérdida y empujar volumen para proteger un número. ELOmax necesita sostener una carga realista sin confundir frecuencia de apertura con aprendizaje.

## Decisión

- Persistir en el perfil un plan semanal de sesiones y minutos orientativos; predeterminado 3/90 y configurable entre 1–7 sesiones y 15–600 minutos.
- Medir semanas calendario locales de lunes a domingo.
- Para la meta, contar solo sesiones prescritas completadas y como máximo una por día. Una segunda sesión suma minutos observados, no otra unidad de adherencia.
- Considerar cumplida la semana por sesiones; los minutos dimensionan carga y no son una segunda barrera.
- Mostrar el plan antes de la actividad acumulada, pero después del título y sin competir con la sesión recomendada como CTA principal.
- Derivar después racha semanal y consistencia 8/8 de los mismos registros; no persistir puntajes, XP ni estado de recompensa.

## Consecuencias

Los perfiles antiguos necesitan un valor por defecto al leerse, pero no una tabla o índice nuevo. Exportación e importación conservan el plan dentro del perfil y aceptan respaldos anteriores sin ese campo. Varias sesiones en un día no pueden completar artificialmente la meta. La racha diaria puede mantenerse en dominio por compatibilidad, pero deja de ser la lectura principal de la interfaz.
