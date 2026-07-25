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

describe('finalesStore', () => {
  it('promocionar contra el motor registra una demostración limpia en FSRS', async () => {
    const item: CurriculumItem = {
      id: 'promocion', tipo: 'final', patternKey: 'final-cuadrado', nombre: 'Promoción',
      fen: '8/P7/8/8/8/8/4k3/7K w - - 0 1', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w',
    };
    const setup = deps(item, new FakeFinalEngine());
    const store = createFinalesStore(setup.value);
    await store.getState().load();
    await store.getState().start(item.id);

    await store.getState().userMove('a7' as never, 'a8' as never);
    expect(store.getState().pendingPromotion).not.toBeNull();
    await store.getState().userMove('a7' as never, 'a8' as never, 'q');

    expect(store.getState().phase).toBe('feedback');
    expect(store.getState().limpia).toBe(true);
    expect(setup.savedProgress).toHaveLength(1);
    expect(setup.savedProgress[0].demostracionesLimpias).toBe(1);
    expect(setup.savedErrors).toHaveLength(0);
  });

  // RF-6.3 pide tres demostraciones *espaciadas*. La lista de finales dejaba
  // repetir el mismo final las veces que quisieras: tres seguidas en cinco
  // minutos lo daban por automatizado y desaparecía para siempre, que es
  // práctica masiva disfrazada de currículo espaciado.
  it('la práctica libre no toca el planificador ni suma a la racha', async () => {
    const item: CurriculumItem = {
      id: 'promocion', tipo: 'final', patternKey: 'final-cuadrado', nombre: 'Promoción',
      fen: '8/P7/8/8/8/8/4k3/7K w - - 0 1', solucion: [], resultadoEsperado: 'gana', ladoUsuario: 'w',
    };
    const setup = deps(item, new FakeFinalEngine());
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
