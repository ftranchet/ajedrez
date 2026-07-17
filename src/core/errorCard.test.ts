import { describe, expect, it } from 'vitest';
import { buildErrorCard, dueErrorCards, leechCards, reviewErrorCard } from './errorCard';

const base = {
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 3 2',
  ladoAMover: 'b' as const,
  jugadaUsuario: 'g8f6',
  jugadaCorrecta: 'd7d6',
  categoria: 'tactico' as const,
  origen: 'radar' as const,
};

describe('buildErrorCard', () => {
  it('crea la tarjeta vencida desde el momento cero (RF-4.1)', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const card = buildErrorCard({ ...base, now });
    expect(card.fsrs.state).toBe('new');
    expect(dueErrorCards([card], now)).toHaveLength(1);
  });
});

describe('reviewErrorCard', () => {
  it('una tarjeta fallada reaparece antes que una acertada (criterio de salida E4)', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const acertada = reviewErrorCard(buildErrorCard({ ...base, now }), true, now);
    const fallada = reviewErrorCard(buildErrorCard({ ...base, now }), false, now);
    expect(new Date(fallada.fsrs.due).getTime()).toBeLessThan(new Date(acertada.fsrs.due).getTime());
  });

  it('no muta la tarjeta original', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const original = buildErrorCard({ ...base, now });
    const dueOriginal = original.fsrs.due;
    reviewErrorCard(original, true, now);
    expect(original.fsrs.due).toBe(dueOriginal);
  });
});

describe('dueErrorCards', () => {
  it('ordena las vencidas de más antigua a más nueva y excluye las no vencidas', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const vieja = buildErrorCard({ ...base, id: 'vieja', now: new Date('2026-07-01T00:00:00.000Z') });
    const nueva = buildErrorCard({ ...base, id: 'nueva', now: new Date('2026-07-16T00:00:00.000Z') });
    const futura = reviewErrorCard(buildErrorCard({ ...base, id: 'futura', now }), true, now);

    const due = dueErrorCards([futura, nueva, vieja], now);
    expect(due.map((c) => c.id)).toEqual(['vieja', 'nueva']);
  });
});

describe('leechCards', () => {
  it('detecta tarjetas con más lapsos que el umbral (RF-4.6)', () => {
    let card = buildErrorCard({ ...base, id: 'sanguijuela' });
    let now = new Date('2026-07-01T00:00:00.000Z');
    // Un lapso es "olvidar" una tarjeta ya graduada a "review": hacen falta
    // dos aciertos (Learning → Review) antes de que un fallo cuente como
    // lapso; después alternamos fallo/acierto siguiendo cada `due` real.
    const advance = (acierto: boolean) => {
      card = reviewErrorCard(card, acierto, now);
      now = new Date(card.fsrs.due);
    };
    advance(true);
    advance(true);
    for (let i = 0; i < 6; i++) {
      advance(false);
      advance(true);
    }
    expect(card.fsrs.lapses).toBeGreaterThan(5);
    expect(leechCards([card])).toEqual([card]);
  });

  it('no marca tarjetas sanas', () => {
    const card = reviewErrorCard(buildErrorCard({ ...base }), true);
    expect(leechCards([card])).toEqual([]);
  });
});
