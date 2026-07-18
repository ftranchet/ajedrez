// Repuebla un catálogo reseedable (RadarItem/CurriculumItem/StoykoItem) desde
// su dataset semilla cuando la versión cambia. Los tres catálogos comparten
// exactamente esta lógica (radarItemRepo, curriculumItemRepo, stoykoItemRepo):
// no son dato del usuario, así que una actualización de contenido reemplaza
// el catálogo entero sin tocar el progreso ya hecho (que vive en tablas
// separadas). Factorizado acá para no triplicar el mismo cuerpo de método.
import type { Dexie, Table } from 'dexie';

export interface DatasetMeta {
  id: 'catalogo';
  version: string;
  seededAt: string; // ISO 8601
}

export interface EnsureSeededCatalogArgs<Item> {
  db: Dexie;
  itemsTable: Table<Item, string>;
  metaTable: Table<DatasetMeta, string>;
  version: string;
  seedItems: Item[];
}

export async function ensureSeededCatalog<Item>({ db, itemsTable, metaTable, version, seedItems }: EnsureSeededCatalogArgs<Item>): Promise<void> {
  const count = await itemsTable.count();
  const meta = await metaTable.get('catalogo');
  if (count > 0 && meta?.version === version) return;

  const nextMeta: DatasetMeta = { id: 'catalogo', version, seededAt: new Date().toISOString() };
  await db.transaction('rw', itemsTable, metaTable, async () => {
    await itemsTable.clear();
    await itemsTable.bulkPut(seedItems);
    await metaTable.put(nextMeta);
  });
}
