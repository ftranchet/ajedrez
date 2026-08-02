import { describe, expect, it, vi } from 'vitest';
import { singleFlight } from './singleFlight';

/** Una promesa que se resuelve cuando el test lo decide, como un repo lento. */
function diferida(): { promesa: Promise<void>; resolver: () => void; rechazar: (e: Error) => void } {
  let resolver!: () => void;
  let rechazar!: (e: Error) => void;
  const promesa = new Promise<void>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe('singleFlight', () => {
  it('dos clics rápidos ejecutan la acción una sola vez', async () => {
    // El caso real: confirmar confianza guarda una calibración y un intento.
    // Con la guarda por fase, el segundo clic entraba antes del primer `set` y
    // guardaba un segundo registro del mismo acto.
    const repo = diferida();
    const guardar = vi.fn(() => repo.promesa);
    const accion = singleFlight(guardar);

    const primero = accion();
    const segundo = accion();
    expect(guardar).toHaveBeenCalledTimes(1);
    // El segundo no se descarta: espera lo mismo que el primero.
    expect(segundo).toBe(primero);

    repo.resolver();
    await Promise.all([primero, segundo]);
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('una vez terminada, la acción vuelve a estar disponible', async () => {
    const guardar = vi.fn(async () => {});
    const accion = singleFlight(guardar);
    await accion();
    await accion();
    expect(guardar).toHaveBeenCalledTimes(2);
  });

  it('un fallo no deja la acción trabada', async () => {
    // Si el repositorio rechaza, el usuario tiene que poder reintentar; una
    // guarda que no se libera ante el error convierte un fallo en un bloqueo.
    const primera = diferida();
    const guardar = vi.fn().mockReturnValueOnce(primera.promesa).mockResolvedValueOnce(undefined);
    const accion = singleFlight(guardar);

    const fallo = accion();
    const esperado = expect(fallo).rejects.toThrow('IndexedDB caído');
    primera.rechazar(new Error('IndexedDB caído'));
    await esperado;

    await accion();
    expect(guardar).toHaveBeenCalledTimes(2);
  });

  it('pasa los argumentos tal cual', async () => {
    const vistos: number[] = [];
    const accion = singleFlight(async (valor: number) => {
      vistos.push(valor);
    });
    await accion(75);
    expect(vistos).toEqual([75]);
  });
});
