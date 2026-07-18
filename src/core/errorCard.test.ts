import { describe, expect, it } from 'vitest';
import { altaErrorCard, buildErrorCard, dueErrorCards, leechCards, reviewErrorCard, tarjetaEquivalente, tarjetasNuevasHoy } from './errorCard';

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

describe('altaErrorCard — dedup y tope diario (RF-4.1/4.5)', () => {
  const now = new Date('2026-07-17T12:00:00.000Z');

  it('crea una tarjeta nueva cuando no hay ninguna equivalente', () => {
    const alta = altaErrorCard([], { ...base, now });
    expect(alta.accion).toBe('crear');
  });

  it('refuerza (no duplica) cuando ya existe una tarjeta de la misma posición y respuesta', () => {
    const existente = buildErrorCard({ ...base, id: 'x', now: new Date('2026-07-10T00:00:00.000Z') });
    const alta = altaErrorCard([existente], { ...base, now });
    expect(alta.accion).toBe('reforzar');
    if (alta.accion !== 'reforzar') return;
    // Es la misma tarjeta (mismo id), con su FSRS adelantado por el fallo.
    expect(alta.card.id).toBe('x');
    expect(alta.card.fsrs.reps).toBe(existente.fsrs.reps + 1);
  });

  it('distingue por identidad ajedrecística: otra posición no es equivalente', () => {
    const existente = buildErrorCard({ ...base, id: 'x', now });
    const otra = { ...base, fen: '8/8/8/8/8/8/8/8 w - - 0 1', now };
    expect(tarjetaEquivalente([existente], otra.fen, otra.jugadaCorrecta)).toBeUndefined();
    expect(altaErrorCard([existente], otra).accion).toBe('crear');
  });

  it('omite tarjetas nuevas al alcanzar el tope diario, pero sigue reforzando existentes', () => {
    // 10 tarjetas nuevas creadas hoy, todas de posiciones distintas.
    const hoy = Array.from({ length: 10 }, (_, i) =>
      buildErrorCard({ ...base, id: `c${i}`, fen: `8/8/8/8/8/8/8/${i}k6 w - - 0 1`, jugadaCorrecta: `mv${i}`, now }),
    );
    expect(tarjetasNuevasHoy(hoy, now)).toBe(10);
    // Una posición NO vista antes: se omite (tope alcanzado).
    expect(altaErrorCard(hoy, { ...base, fen: 'nueva-fen', jugadaCorrecta: 'nueva', now }).accion).toBe('omitir');
    // Pero una equivalente a una existente igual se refuerza (no es "nueva").
    expect(altaErrorCard(hoy, { ...base, fen: `8/8/8/8/8/8/8/0k6 w - - 0 1`, jugadaCorrecta: 'mv0', now }).accion).toBe('reforzar');
  });

  it('el tope es por día: tarjetas de ayer no cuentan para el tope de hoy', () => {
    const ayer = Array.from({ length: 10 }, (_, i) =>
      buildErrorCard({ ...base, id: `a${i}`, fen: `8/8/8/8/8/8/8/${i}K6 w - - 0 1`, jugadaCorrecta: `mv${i}`, now: new Date('2026-07-16T12:00:00.000Z') }),
    );
    expect(tarjetasNuevasHoy(ayer, now)).toBe(0);
    expect(altaErrorCard(ayer, { ...base, fen: 'hoy-fen', jugadaCorrecta: 'hoy', now }).accion).toBe('crear');
  });
});
