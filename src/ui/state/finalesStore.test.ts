import { describe, expect, it } from 'vitest';
import type { EngineEvaluation, EnginePort } from '../../core/ports';
import type { CurriculumItem, CurriculumProgress, ErrorCard } from '../../core/types';
import { createFinalesStore } from './finalesStore';

class FakeFinalEngine implements EnginePort {
  constructor(private readonly evaluations: EngineEvaluation[] = []) {}
  async init() {}
  async bestMove() { return ''; }
  async evaluate() {
    const next = this.evaluations.shift();
    if (!next) throw new Error('evaluación falsa agotada');
    return next;
  }
  dispose() {}
}

function deps(item: CurriculumItem, enginePort: EnginePort) {
  const savedProgress: CurriculumProgress[] = [];
  const savedErrors: ErrorCard[] = [];
  return {
    savedProgress,
    savedErrors,
    value: {
      enginePort,
      items: { async ensureSeeded() {}, async list() { return [item]; } },
      progress: { async list() { return []; }, async save(progress: CurriculumProgress) { savedProgress.push(progress); } },
      errors: { async list() { return []; }, async save(card: ErrorCard) { savedErrors.push(card); } },
    },
  };
}

const promocion: CurriculumItem = {
  id: 'promocion', tipo: 'final', patternKey: 'final-cuadrado', nombre: 'Promoción',
  fen: '8/P7/8/8/8/8/4k3/7K w - - 0 1', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w',
  objetivo: 'coronar',
};

describe('finalesStore', () => {
  it('promocionar contra el motor registra una demostración limpia en FSRS', async () => {
    // Tras coronar, el motor confirma que el rival sigue perdido: recién ahí
    // la conversión cuenta como técnica demostrada (RF-6.2).
    const setup = deps(promocion, new FakeFinalEngine([{ move: 'e2f2', cp: null, mateIn: -6 }]));
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(promocion.id);

    await store.getState().userMove('a7' as never, 'a8' as never);
    expect(store.getState().pendingPromotion).not.toBeNull();
    await store.getState().userMove('a7' as never, 'a8' as never, 'q');

    expect(store.getState().phase).toBe('feedback');
    expect(store.getState().limpia).toBe(true);
    expect(setup.savedProgress).toHaveLength(1);
    expect(setup.savedProgress[0].demostracionesLimpias).toBe(1);
    expect(setup.savedErrors).toHaveLength(0);
  });

  // Coronar era terminal por sí solo: la app daba la técnica por demostrada
  // aunque la dama recién coronada se cayera en la jugada siguiente, que es
  // exactamente el error que el final de Lucena enseña a evitar.
  it('coronar y quedar en tablas no demuestra la técnica', async () => {
    const setup = deps(
      promocion,
      new FakeFinalEngine([
        { move: 'e2e3', cp: -10, mateIn: null }, // evaluación posterior a coronar
        { move: 'a7a8q', cp: 900, mateIn: null }, // la que busca la alternativa para la tarjeta
      ]),
    );
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(promocion.id);

    await store.getState().userMove('a7' as never, 'a8' as never, 'q');

    expect(store.getState().phase).toBe('feedback');
    expect(store.getState().limpia).toBe(false);
  });

  // El bug de fondo: en los mates elementales bastaba con que Stockfish viera
  // el mate contra sí mismo —cosa que pasa tras la primera jugada razonable—
  // para cerrar el ejercicio con "técnica demostrada".
  it('un mate elemental sigue en juego mientras el mate no esté dado', async () => {
    const mate: CurriculumItem = {
      id: 'mate-torre', tipo: 'final', patternKey: 'final-torre', nombre: 'Mate de torre',
      fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w',
      objetivo: 'mate',
    };
    const setup = deps(mate, new FakeFinalEngine([{ move: 'e5e6', cp: null, mateIn: -13 }]));
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(mate.id);

    await store.getState().userMove('h1' as never, 'h5' as never);

    expect(store.getState().phase).toBe('jugando');
    expect(store.getState().limpia).toBeNull();
    expect(setup.savedProgress).toHaveLength(0);
  });

  // RF-6.3 pide tres demostraciones *espaciadas*. La lista de finales dejaba
  // repetir el mismo final las veces que quisieras: tres seguidas en cinco
  // minutos lo daban por automatizado y desaparecía para siempre, que es
  // práctica masiva disfrazada de currículo espaciado.
  it('la práctica libre no toca el planificador ni suma a la racha', async () => {
    const item = promocion;
    const setup = deps(item, new FakeFinalEngine([{ move: 'e2f2', cp: null, mateIn: -6 }]));
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(item.id, true);

    await store.getState().userMove('a7' as never, 'a8' as never, 'q');

    expect(store.getState().phase).toBe('feedback');
    expect(store.getState().limpia).toBe(true);
    expect(store.getState().practica).toBe(true);
    expect(setup.savedProgress).toHaveLength(0);
  });

  it('perder la técnica en práctica libre igual deja la tarjeta de error', async () => {
    // Un error propio es material de repaso venga de donde venga (RF-4.1): lo
    // que la práctica no hace es mover la racha ni la fecha de reaparición.
    const item: CurriculumItem = {
      id: 'philidor', tipo: 'final', patternKey: 'final-philidor', nombre: 'Philidor',
      fen: '8/4k3/r7/4K3/4P3/8/8/7R b - - 0 1', solucion: [], resultadoEsperado: 'tablas', ladoUsuario: 'b',
    };
    const setup = deps(
      item,
      // Tras la jugada del usuario el rival queda claramente ganador: técnica
      // perdida. La segunda evaluación es la que busca la jugada correcta para
      // la tarjeta de error.
      new FakeFinalEngine([
        { move: 'h1h7', cp: 900, mateIn: null },
        { move: 'a6a1', cp: 0, mateIn: null },
      ]),
    );
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(item.id, true);

    await store.getState().userMove('a6' as never, 'a5' as never);

    expect(store.getState().limpia).toBe(false);
    expect(setup.savedProgress).toHaveLength(0);
    expect(setup.savedErrors).toHaveLength(1);
    // El punto crítico queda listo para mostrarse: posición, jugada propia y
    // la que prefería el motor (la flecha del tablero, RF-5.3).
    expect(store.getState().revision).toEqual({
      fen: item.fen,
      jugada: ['a6', 'a5'],
      correcta: ['a6', 'a1'],
      jaque: false,
    });
    expect(store.getState().jugadaCorrecta).toBe('Ta1');
  });

  it('si mueve primero el rival, Stockfish juega antes de habilitar al usuario', async () => {
    const item: CurriculumItem = {
      id: 'oposicion', tipo: 'final', patternKey: 'final-rey-peon', nombre: 'Oposición',
      fen: '8/4k3/8/4K3/4P3/8/8/8 b - - 0 1', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w',
    };
    const setup = deps(item, new FakeFinalEngine([{ move: 'e7d7', cp: -600, mateIn: null }]));
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(item.id);

    expect(store.getState().phase).toBe('jugando');
    expect(store.getState().turn).toBe('w');
    expect(store.getState().lastMove).toEqual(['e7', 'd7']);
  });
});
