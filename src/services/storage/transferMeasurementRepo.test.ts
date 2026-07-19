import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { ElomaxDB } from './db';
import { DexieTransferMeasurementRepo } from './transferMeasurementRepo';

const databases: ElomaxDB[] = [];
afterEach(async () => {
  for (const database of databases) {
    database.close();
    await database.delete();
  }
  databases.length = 0;
});

describe('DexieTransferMeasurementRepo', () => {
  it('guarda una toma incompleta y la lista de más nueva a más vieja', async () => {
    const database = new ElomaxDB(`transfer-test-${crypto.randomUUID()}`);
    databases.push(database);
    const repo = new DexieTransferMeasurementRepo(database);
    await repo.save({ id: 'old', datasetVersion: 'v1', startedAt: '2026-01-01T00:00:00.000Z', completedAt: null, responses: [] });
    await repo.save({ id: 'new', datasetVersion: 'v1', startedAt: '2026-02-01T00:00:00.000Z', completedAt: null, responses: [] });
    expect((await repo.list()).map((measurement) => measurement.id)).toEqual(['new', 'old']);
  });
});
