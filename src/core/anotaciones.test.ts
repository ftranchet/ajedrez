import { describe, expect, it } from 'vitest';
import { alternarAnotacion, type Anotacion } from './anotaciones';

const flecha = (orig: string, dest: string, brush: Anotacion['brush'] = 'green'): Anotacion => ({ orig, dest, brush });
const circulo = (orig: string, brush: Anotacion['brush'] = 'green'): Anotacion => ({ orig, brush });

describe('alternarAnotacion', () => {
  it('agrega una marca que no estaba', () => {
    expect(alternarAnotacion([], flecha('e2', 'e4'))).toEqual([flecha('e2', 'e4')]);
  });

  // Volver a marcar lo mismo es la forma natural de deshacer, sin botón.
  it('repetir la misma marca del mismo color la borra', () => {
    const previas = [flecha('e2', 'e4')];
    expect(alternarAnotacion(previas, flecha('e2', 'e4'))).toEqual([]);
  });

  it('la misma marca en otro color la repinta, no la duplica', () => {
    const previas = [flecha('e2', 'e4', 'green')];
    expect(alternarAnotacion(previas, flecha('e2', 'e4', 'red'))).toEqual([flecha('e2', 'e4', 'red')]);
  });

  it('no toca las demás marcas', () => {
    const previas = [flecha('e2', 'e4'), flecha('d2', 'd4'), circulo('f7')];
    expect(alternarAnotacion(previas, flecha('d2', 'd4'))).toEqual([flecha('e2', 'e4'), circulo('f7')]);
  });

  it('un círculo y una flecha desde la misma casilla son marcas distintas', () => {
    const previas = [circulo('e2')];
    expect(alternarAnotacion(previas, flecha('e2', 'e4'))).toEqual([circulo('e2'), flecha('e2', 'e4')]);
  });

  it('una flecha y su inversa son marcas distintas', () => {
    const previas = [flecha('e2', 'e4')];
    expect(alternarAnotacion(previas, flecha('e4', 'e2'))).toEqual([flecha('e2', 'e4'), flecha('e4', 'e2')]);
  });

  it('no muta la lista que recibe', () => {
    const previas = [flecha('e2', 'e4')];
    alternarAnotacion(previas, flecha('d2', 'd4'));
    expect(previas).toEqual([flecha('e2', 'e4')]);
  });
});
