// Versión del esquema de datos del usuario, expuesta en el manifiesto de
// exportación (RF-14.1/14.2).
//
// **Por qué vive en `core` y no junto a Dexie.** Es el contrato de
// compatibilidad del paquete de exportación —lo que decide si un archivo se
// puede restaurar en esta app—, no un detalle del motor de almacenamiento. Con
// la constante en `services/storage/db.ts`, `core/exportData.ts` la importaba
// desde ahí y era la única violación de la regla de dependencias del PRD
// (`ui → core → (interfaces de) services`). Invertida, `db.ts` la importa desde
// acá, que sí está permitido.
//
// Tiene que coincidir con la última `this.version(N)` declarada en Dexie; un
// test lo verifica contra la base real, porque si se declara una migración
// nueva y esto no sube, el manifiesto miente sobre el esquema y la guarda de
// "archivo más nuevo que la app" deja pasar paquetes que no puede leer.
export const SCHEMA_VERSION = 20;
