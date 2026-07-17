// Planificador de repetición espaciada (ADR-0003): envoltorio de ts-fsrs
// detrás de un puerto propio para poder reemplazar la librería sin tocar el
// resto del dominio. Producción libre en el tablero, nunca opción múltiple
// (RF-4.3): acá solo entra si la jugada del usuario fue correcta o no.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from 'ts-fsrs';

/** Estado FSRS tal como se persiste por tarjeta (PRD §9, entidad ErrorCard). */
export interface FsrsState {
  due: string; // ISO 8601
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  /** Escalones de aprendizaje acumulados; determina cuándo gradúa a "review". */
  learningSteps: number;
  state: 'new' | 'learning' | 'review' | 'relearning';
  lastReview: string | null; // ISO 8601
}

const STATE_NAMES = ['new', 'learning', 'review', 'relearning'] as const;

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

function toFsrsState(card: Card): FsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningSteps: card.learning_steps,
    state: STATE_NAMES[card.state],
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

function fromFsrsState(s: FsrsState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learningSteps,
    state: STATE_NAMES.indexOf(s.state) as State,
    last_review: s.lastReview ? new Date(s.lastReview) : undefined,
  };
}

/** Tarjeta recién creada, nunca repasada (RF-4.1). */
export function newFsrsState(now: Date = new Date()): FsrsState {
  return toFsrsState(createEmptyCard(now));
}

/**
 * Aplica el resultado de un repaso: acierto espacia la reaparición, fallo la
 * reinicia (RF-4.2). `acierto` colapsa las 4 calificaciones de FSRS
 * (Again/Hard/Good/Easy) a 2 porque el Radar solo puede saber si la jugada
 * producida en el tablero fue correcta o no, no un grado de dificultad.
 */
export function reviewFsrsState(state: FsrsState, acierto: boolean, now: Date = new Date()): FsrsState {
  const card = fromFsrsState(state);
  const rating = acierto ? Rating.Good : Rating.Again;
  const result = scheduler.next(card, now, rating);
  return toFsrsState(result.card);
}

export function isDue(state: FsrsState, now: Date = new Date()): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}
