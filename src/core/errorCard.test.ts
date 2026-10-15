import { describe, expect, it } from 'vitest';
import { altaErrorCard, buildErrorCard, dueErrorCards, esAciertoEnRepaso, leechCards, reviewErrorCard, tarjetaEquivalente, tarjetasNuevasHoy, type AltaTarjeta } from './errorCard';
import { bloqueAsignado, buildDailyAssignment, sincronizarColaConVencidas } from './dailyAssignment';
import type { ErrorCard } from './types';

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

  it('al alcanzar el tope diario la tarjeta nueva se crea diferida, y las existentes se siguen reforzando', () => {
    // 10 tarjetas nuevas creadas hoy, todas de posiciones distintas.
    const hoy = Array.from({ length: 10 }, (_, i) =>
      buildErrorCard({ ...base, id: `c${i}`, fen: `8/8/8/8/8/8/8/${i}k6 w - - 0 1`, jugadaCorrecta: `mv${i}`, now }),
    );
    expect(tarjetasNuevasHoy(hoy, now)).toBe(10);
    // Una posición NO vista antes: se crea igual, pero no entra a repaso hoy.
    const nueva = altaErrorCard(hoy, { ...base, fen: 'nueva-fen', jugadaCorrecta: 'nueva', now });
    expect(nueva.accion).toBe('crear');
    expect(nueva.accion === 'crear' && nueva.diferidaHasta).toBeTruthy();
    // Una equivalente a una existente igual se refuerza (no es "nueva").
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

// Los instantes se arman en hora local (`new Date(año, mes, día, hora)`): así
// los tests valen en cualquier zona horaria del proceso. La regresión de B3
// solo se manifiesta fuera de UTC: la CI corre la suite también en
// Pacific/Kiritimati (UTC+14) y Pacific/Pago_Pago (UTC−11).
const local = (dia: number, hora = 12, minuto = 0) => new Date(2026, 6, dia, hora, minuto);
const inicioDelDia = (dia: number) => new Date(2026, 6, dia);
const distinta = (i: number, now: Date) => ({ ...base, id: `d${i}`, fen: `fen-${i}`, jugadaCorrecta: `mv${i}`, now });

/** Confirma `n` errores de posiciones distintas en el instante dado, como la pantalla de análisis. */
function confirmarSeguidos(n: number, now: Date, previas: ErrorCard[] = [], desde = 0) {
  let cards = [...previas];
  const altas: AltaTarjeta[] = [];
  for (let i = desde; i < desde + n; i++) {
    const alta = altaErrorCard(cards, distinta(i, now));
    altas.push(alta);
    cards = [...cards, alta.card];
  }
  return { cards, altas };
}

describe('tarjetasNuevasHoy — el día es el local, no el UTC (B3, RF-4.5)', () => {
  it('cuenta juntas las tarjetas del mismo día local aunque crucen la medianoche UTC', () => {
    // En UTC−3 las 23:30 ya son mañana en UTC; en UTC+9 las 00:30 todavía son ayer.
    const cards = [local(17, 0, 30), local(17, 12), local(17, 23, 30)].map((now, i) => buildErrorCard(distinta(i, now)));
    expect(tarjetasNuevasHoy(cards, local(17, 23, 45))).toBe(3);
    expect(tarjetasNuevasHoy(cards, local(17, 0, 45))).toBe(3);
  });

  it('no cuenta juntas tarjetas de días locales distintos', () => {
    const anoche = buildErrorCard(distinta(0, local(16, 23, 30)));
    const madrugada = buildErrorCard(distinta(1, local(17, 0, 30)));
    expect(tarjetasNuevasHoy([anoche, madrugada], local(17, 12))).toBe(1);
    expect(tarjetasNuevasHoy([anoche, madrugada], local(16, 23, 45))).toBe(1);
  });

  it('el tope se llena con las del día local: a las 23:30 cuentan las del mediodía', () => {
    const { cards } = confirmarSeguidos(10, local(17, 12));
    const alta = altaErrorCard(cards, distinta(99, local(17, 23, 30)));
    expect(alta.accion === 'crear' && alta.diferidaHasta).toBe(inicioDelDia(18).toISOString());
  });
});

describe('altaErrorCard — pasado el tope, difiere; nunca descarta (B2, RF-4.5)', () => {
  const ahora = local(17, 12);

  it('con 10 creadas hoy, la 11.ª se crea con due al inicio de mañana local', () => {
    const { altas } = confirmarSeguidos(11, ahora);
    for (const alta of altas.slice(0, 10)) {
      expect(alta.accion).toBe('crear');
      expect(alta.accion === 'crear' && alta.diferidaHasta).toBeUndefined();
      expect(alta.card.fsrs.due).toBe(ahora.toISOString());
    }
    const undecima = altas[10];
    expect(undecima.accion).toBe('crear');
    if (undecima.accion !== 'crear') return;
    expect(undecima.diferidaHasta).toBe(inicioDelDia(18).toISOString());
    expect(undecima.card.fsrs.due).toBe(inicioDelDia(18).toISOString());
    // Es una tarjeta nueva normal: solo cambia cuándo entra; `creadaEn` no se falsea.
    expect(undecima.card.fsrs.state).toBe('new');
    expect(undecima.card.fsrs.reps).toBe(0);
    expect(undecima.card.creadaEn).toBe(ahora.toISOString());
  });

  it('el excedente se reparte de a 10 por día: de la 11.ª a la 20.ª mañana, la 21.ª pasado mañana', () => {
    const { altas } = confirmarSeguidos(21, ahora);
    const dias = altas.map((alta) => (alta.accion === 'crear' ? (alta.diferidaHasta ?? 'hoy') : alta.accion));
    expect(dias.slice(0, 10)).toEqual(Array(10).fill('hoy'));
    expect(dias.slice(10, 20)).toEqual(Array(10).fill(inicioDelDia(18).toISOString()));
    expect(dias[20]).toBe(inicioDelDia(19).toISOString());
  });

  it('la Cola no sirve la diferida antes de su día, y sí al llegar', () => {
    const { cards } = confirmarSeguidos(11, ahora);
    const diferida = cards[10];
    expect(dueErrorCards(cards, local(17, 23, 59)).map((c) => c.id)).not.toContain(diferida.id);
    expect(dueErrorCards(cards, new Date(inicioDelDia(18).getTime() - 1)).map((c) => c.id)).not.toContain(diferida.id);
    const manana = dueErrorCards(cards, local(18, 9));
    expect(manana).toHaveLength(11);
    // Va detrás de las de ayer: su `due` es posterior.
    expect(manana[10].id).toBe(diferida.id);
  });

  it('el plan del día no la suma a la Cola antes de su día, y el de mañana sí la trae', () => {
    const { cards } = confirmarSeguidos(11, ahora);
    const diferida = cards[10];
    const vacio = { colaIds: [], curriculumIds: [], triageCount: 0, radarCount: 0 };
    // El plan de hoy se armó a la mañana; a la noche se sincroniza con lo vencido.
    const planHoy = sincronizarColaConVencidas(
      buildDailyAssignment(vacio, [], local(17, 8)),
      dueErrorCards(cards, local(17, 23, 59)).map((c) => c.id),
    );
    expect(bloqueAsignado(planHoy, 'cola')?.itemIds).toHaveLength(10);
    expect(bloqueAsignado(planHoy, 'cola')?.itemIds).not.toContain(diferida.id);
    const planManana = buildDailyAssignment({ ...vacio, colaIds: dueErrorCards(cards, local(18, 8)).map((c) => c.id) }, [], local(18, 8));
    expect(bloqueAsignado(planManana, 'cola')?.itemIds).toContain(diferida.id);
  });

  it('al llegar su día se repasa igual que una tarjeta recién creada', () => {
    const { cards } = confirmarSeguidos(11, ahora);
    const diferida = cards[10];
    const cuando = local(18, 9);
    const fresca = buildErrorCard({ ...distinta(10, cuando) });
    for (const acierto of [true, false]) {
      const repasada = reviewErrorCard(diferida, acierto, cuando).fsrs;
      const referencia = reviewErrorCard(fresca, acierto, cuando).fsrs;
      expect(repasada).toEqual(referencia);
      expect(new Date(repasada.due).getTime()).toBeGreaterThan(cuando.getTime());
    }
  });

  it('lo que ya quedó diferido ocupa el cupo de su día: al otro día, las nuevas van detrás', () => {
    // 25 un día: 10 entran ese día, 10 al siguiente y 5 al otro.
    const { cards } = confirmarSeguidos(25, ahora);
    // Al día siguiente el cupo ya está lleno con las 10 diferidas: la nueva
    // va al primer día con lugar (el 19, que tiene 5), no se suma a las 10.
    const { altas } = confirmarSeguidos(6, local(18, 12), cards, 100);
    expect(altas.map((alta) => alta.accion === 'crear' && alta.diferidaHasta)).toEqual([
      ...Array(5).fill(inicioDelDia(19).toISOString()),
      inicioDelDia(20).toISOString(),
    ]);
  });

  it('reforzar sigue funcionando con el cupo lleno', () => {
    const { cards } = confirmarSeguidos(10, ahora);
    const alta = altaErrorCard(cards, distinta(3, ahora));
    expect(alta.accion).toBe('reforzar');
    expect(alta.card.id).toBe(cards[3].id);
  });

  it('volver a fallar una diferida que todavía espera su día no la adelanta a hoy', () => {
    // El mismo error de apertura en dos partidas de un lote exprés: la segunda
    // confirmación no puede meterla hoy por encima del cupo (ni dejar
    // desactualizado el aviso de "entran en los próximos días").
    const { cards } = confirmarSeguidos(11, ahora);
    const alta = altaErrorCard(cards, distinta(10, local(17, 18)));
    expect(alta.accion).toBe('reforzar');
    expect(alta.card).toEqual(cards[10]);
    // Devuelve su día, para que el cierre del análisis avise que no entra hoy.
    expect(alta.diferidaHasta).toBe(local(18, 0).toISOString());
    expect(dueErrorCards([alta.card], local(17, 23))).toEqual([]);
    expect(tarjetasNuevasHoy([...cards.slice(0, 10), alta.card], local(17, 23))).toBe(10);
  });

  it('una diferida que ya entró se refuerza como cualquier otra', () => {
    const { cards } = confirmarSeguidos(11, ahora);
    const alta = altaErrorCard(cards, distinta(10, local(18, 18)));
    expect(alta.accion).toBe('reforzar');
    expect(alta.card.fsrs.reps).toBe(1);
    expect(alta.diferidaHasta).toBeUndefined();
  });

  it('la diferida guarda su día de entrada', () => {
    const { altas } = confirmarSeguidos(11, ahora);
    expect(altas[9].card.entraEn).toBeUndefined();
    expect(altas[10].card.entraEn).toBe('2026-07-18');
  });

  it('el día de entrada no depende de si la Cola se hizo antes o después de analizar', () => {
    // Domingo: 40 errores en un lote → 10 entran cada día de dom a mié.
    const domingo = confirmarSeguidos(40, local(19, 12));
    const lunes = local(20, 8);
    // (A) El lunes analiza 6 errores nuevos antes de repasar.
    const antes = confirmarSeguidos(6, local(20, 9), domingo.cards, 100);
    // (B) El lunes primero repasa las 10 diferidas que entraban ese día…
    const repasadas = domingo.cards.map((card) =>
      card.entraEn === '2026-07-20' ? reviewErrorCard(card, true, lunes) : card,
    );
    expect(repasadas.filter((card) => card.entraEn === '2026-07-20' && card.fsrs.state !== 'new')).toHaveLength(10);
    // …y después analiza los mismos 6.
    const despues = confirmarSeguidos(6, local(20, 20), repasadas, 100);
    const dias = (altas: AltaTarjeta[]) => altas.map((alta) => alta.card.entraEn);
    expect(dias(despues.altas)).toEqual(dias(antes.altas));
    expect(dias(antes.altas)).toEqual(Array(6).fill('2026-07-23'));
  });
});

describe('respuestas aceptadas en el repaso (B13)', () => {
  const ahora = new Date(2026, 6, 17, 12);
  // Rey y dama contra rey: Dg7#, Dg8#, Dh1# y Dh2# son mate; Dg6 ahoga, y
  // Da1 sigue ganando sin dar mate.
  const finalDama = { ...base, fen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1', ladoAMover: 'w' as const, jugadaUsuario: 'g1g6', jugadaCorrecta: 'g1g7', origen: 'final' as const };

  it('la tarjeta guarda las alternativas sin repetirlas ni repetir la correcta', () => {
    const card = buildErrorCard({ ...base, jugadasAceptables: ['f8c5', 'f8c5', 'd7d6'], now: ahora });
    expect(card.jugadasAceptables).toEqual(['f8c5']);
  });

  it('sin alternativas la tarjeta no lleva el campo, como las anteriores a él', () => {
    expect(buildErrorCard({ ...base, jugadasAceptables: [], now: ahora })).not.toHaveProperty('jugadasAceptables');
    expect(buildErrorCard({ ...base, jugadasAceptables: ['d7d6'], now: ahora })).not.toHaveProperty('jugadasAceptables');
    expect(buildErrorCard({ ...base, now: ahora })).not.toHaveProperty('jugadasAceptables');
  });

  it('acierta la correcta y cualquier alternativa guardada; otra jugada no', () => {
    const card = buildErrorCard({ ...base, jugadasAceptables: ['f8c5'], now: ahora });
    expect(esAciertoEnRepaso(card, 'd7d6')).toBe(true);
    expect(esAciertoEnRepaso(card, 'f8c5')).toBe(true);
    expect(esAciertoEnRepaso(card, 'g8f6')).toBe(false);
  });

  it('una tarjeta sin alternativas, como las anteriores al campo, sigue exigiendo la correcta', () => {
    const card = buildErrorCard({ ...base, now: ahora });
    expect(esAciertoEnRepaso(card, 'd7d6')).toBe(true);
    expect(esAciertoEnRepaso(card, 'f8c5')).toBe(false);
  });

  it('si la correcta es mate, cualquier otro mate acierta', () => {
    const card = buildErrorCard({ ...finalDama, now: ahora });
    expect(esAciertoEnRepaso(card, 'g1g8')).toBe(true);
    expect(esAciertoEnRepaso(card, 'g1h1')).toBe(true);
    expect(esAciertoEnRepaso(card, 'g1h2')).toBe(true);
  });

  it('sin motor no se da por buena una jugada que solo sigue ganando, ni el ahogado', () => {
    const card = buildErrorCard({ ...finalDama, now: ahora });
    expect(esAciertoEnRepaso(card, 'g1a1')).toBe(false);
    expect(esAciertoEnRepaso(card, 'g1g6')).toBe(false);
  });

  it('una jugada ilegal no acierta ni rompe el repaso', () => {
    const card = buildErrorCard({ ...finalDama, now: ahora });
    expect(esAciertoEnRepaso(card, 'a1a8')).toBe(false);
    expect(esAciertoEnRepaso(card, '')).toBe(false);
  });

  it('dos fallos con una respuesta en común son la misma tarjeta, en las dos direcciones', () => {
    const conAlternativa = buildErrorCard({ ...base, id: 'x', jugadasAceptables: ['f8c5'], now: ahora });
    // La nueva pide justo la alternativa de la existente…
    expect(tarjetaEquivalente([conAlternativa], base.fen, 'f8c5')?.id).toBe('x');
    // …o la existente pide una que la nueva también acepta.
    const sinAlternativa = buildErrorCard({ ...base, id: 'y', now: ahora });
    expect(tarjetaEquivalente([sinAlternativa], base.fen, 'f8c5', ['d7d6'])?.id).toBe('y');
  });

  it('dos mates distintos de la misma posición son la misma tarjeta', () => {
    const existente = buildErrorCard({ ...finalDama, id: 'x', now: ahora });
    expect(tarjetaEquivalente([existente], finalDama.fen, 'g1h1')?.id).toBe('x');
  });

  it('sin ninguna respuesta en común siguen siendo tarjetas distintas', () => {
    const existente = buildErrorCard({ ...base, id: 'x', jugadasAceptables: ['f8c5'], now: ahora });
    expect(tarjetaEquivalente([existente], base.fen, 'f8b4', ['a7a6'])).toBeUndefined();
    expect(altaErrorCard([existente], { ...base, jugadaCorrecta: 'f8b4', now: ahora }).accion).toBe('crear');
  });

  it('reforzar suma a la tarjeta las respuestas del fallo nuevo que todavía no aceptaba', () => {
    const existente = buildErrorCard({ ...base, id: 'x', jugadasAceptables: ['f8c5'], now: new Date(2026, 6, 10, 12) });
    const alta = altaErrorCard([existente], { ...base, jugadaCorrecta: 'f8c5', jugadasAceptables: ['f8b4', 'd7d6'], now: ahora });
    expect(alta.accion).toBe('reforzar');
    expect(alta.card.id).toBe('x');
    expect(alta.card.jugadaCorrecta).toBe('d7d6');
    expect(alta.card.jugadasAceptables).toEqual(['f8c5', 'f8b4']);
    expect(alta.card.fsrs.reps).toBe(existente.fsrs.reps + 1);
  });

  it('reforzar sin respuestas nuevas no toca las aceptadas, ni agrega un mate que ya contaba', () => {
    const conAlternativa = buildErrorCard({ ...base, id: 'x', jugadasAceptables: ['f8c5'], now: ahora });
    expect(altaErrorCard([conAlternativa], { ...base, jugadasAceptables: ['f8c5'], now: ahora }).card.jugadasAceptables).toEqual(['f8c5']);
    const mate = buildErrorCard({ ...finalDama, id: 'y', now: ahora });
    expect(altaErrorCard([mate], { ...finalDama, jugadaCorrecta: 'g1h1', now: ahora }).card).not.toHaveProperty('jugadasAceptables');
  });

  it('una diferida que todavía espera su día también suma las respuestas nuevas, sin adelantarse', () => {
    const manana = new Date(2026, 6, 18).toISOString();
    const diferida = buildErrorCard({ ...base, id: 'x', now: ahora });
    const esperando = { ...diferida, fsrs: { ...diferida.fsrs, due: manana }, entraEn: '2026-07-18' };
    const alta = altaErrorCard([esperando], { ...base, jugadasAceptables: ['f8c5'], now: ahora });
    expect(alta.accion).toBe('reforzar');
    expect(alta.diferidaHasta).toBe(manana);
    expect(alta.card.fsrs).toEqual(esperando.fsrs);
    expect(alta.card.jugadasAceptables).toEqual(['f8c5']);
  });
});
