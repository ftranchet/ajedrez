import { describe, expect, it } from 'vitest';
import { isDue, newFsrsState, reviewFsrsState } from './scheduler';

describe('newFsrsState', () => {
  it('crea una tarjeta nueva, vencida de inmediato', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const s = newFsrsState(now);
    expect(s.state).toBe('new');
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);
    expect(isDue(s, now)).toBe(true);
  });
});

describe('reviewFsrsState', () => {
  it('un acierto espacia la reaparición (due queda en el futuro)', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const s0 = newFsrsState(now);
    const s1 = reviewFsrsState(s0, true, now);
    expect(new Date(s1.due).getTime()).toBeGreaterThan(now.getTime());
    expect(s1.reps).toBe(1);
    expect(s1.lapses).toBe(0);
  });

  it('un fallo reinicia el intervalo y suma un lapso tras haber sido revisada', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    let s = newFsrsState(now);
    // Llevarla a estado "review" con varios aciertos consecutivos primero.
    for (let i = 0; i < 3; i++) {
      s = reviewFsrsState(s, true, new Date(now.getTime() + i * 86_400_000));
    }
    expect(s.state).toBe('review');
    const beforeFail = s;

    const s2 = reviewFsrsState(s, false, new Date(now.getTime() + 10 * 86_400_000));
    expect(s2.lapses).toBe(beforeFail.lapses + 1);
    expect(s2.state).toBe('relearning');
  });

  it('aciertos consecutivos hacen crecer el intervalo (dificultad deseable, PRD §5.5)', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    let s = newFsrsState(now);
    const intervals: number[] = [];
    let reviewTime = now;
    for (let i = 0; i < 4; i++) {
      s = reviewFsrsState(s, true, reviewTime);
      intervals.push(new Date(s.due).getTime() - reviewTime.getTime());
      reviewTime = new Date(s.due);
    }
    // Cada intervalo entre repasos exitosos consecutivos es mayor o igual al anterior.
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });
});

describe('isDue', () => {
  it('una tarjeta con due en el pasado está vencida', () => {
    const s = newFsrsState(new Date('2026-01-01T00:00:00.000Z'));
    expect(isDue(s, new Date('2026-07-17T00:00:00.000Z'))).toBe(true);
  });

  it('una tarjeta con due en el futuro no está vencida', () => {
    const now = new Date('2026-07-17T00:00:00.000Z');
    let s = newFsrsState(now);
    s = reviewFsrsState(s, true, now);
    expect(isDue(s, now)).toBe(false);
  });
});
