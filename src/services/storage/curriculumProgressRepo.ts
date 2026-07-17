// Progreso del usuario sobre el currículo base (RF-6.3): estado FSRS y
// demostraciones limpias por elemento. A diferencia del catálogo, es dato
// personal y se incluye en la exportación (RF-14.1).
import type { CurriculumProgress } from '../../core/types';
import { db, type ElomaxDB } from './db';

export interface CurriculumProgressRepo {
  list(): Promise<CurriculumProgress[]>;
  save(progress: CurriculumProgress): Promise<void>;
}

export class DexieCurriculumProgressRepo implements CurriculumProgressRepo {
  constructor(private readonly database: ElomaxDB = db) {}

  async list(): Promise<CurriculumProgress[]> {
    return this.database.curriculumProgress.toArray();
  }

  async save(progress: CurriculumProgress): Promise<void> {
    await this.database.curriculumProgress.put(progress);
  }
}

export const curriculumProgressRepo: CurriculumProgressRepo = new DexieCurriculumProgressRepo();
