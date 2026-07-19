import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ElomaxDB } from './db';
import { DexieN1ExperimentRepo } from './n1ExperimentRepo';
import { startN1Experiment } from '../../core/n1Experiment';

describe('N1ExperimentRepo', () => {
  it('guarda y lista experimentos del más reciente al más antiguo', async () => {
    const database = new ElomaxDB(`n1-test-${crypto.randomUUID()}`);
    const repo = new DexieN1ExperimentRepo(database);
    const data = { games: [], sessions: [], compromisoAttempts: [], stoykoAttempts: [] };
    const old = startN1Experiment({ modalidadA: 'radar', modalidadB: 'calculo', dosisSemanalA: 10, dosisSemanalB: 2 }, data, new Date('2026-01-01'), 'old');
    const recent = startN1Experiment({ modalidadA: 'calculo', modalidadB: 'partidas-analisis', dosisSemanalA: 2, dosisSemanalB: 2 }, data, new Date('2026-02-01'), 'recent');
    await repo.save(old);
    await repo.save(recent);
    expect((await repo.list()).map((experiment) => experiment.id)).toEqual(['recent', 'old']);
    database.close();
  });
});
