import { describe, expect, it } from 'vitest';
import { prescripcionesDe, prescripcionesExternas, prescripcionesPendientes } from './prescripcionesExternas';
import type { AjusteFugaCalculo } from './prescriptor';
import type { CompromisoAttempt, GameRecord } from './types';

const AHORA = new Date(2026, 6, 22, 20); // miércoles 22/07
// Diagnóstico hace 10 días: fuera de la ventana de escalonamiento inicial,
// para que los casos que no la prueban no la pisen.
const DIAGNOSTICO_VIEJO = new Date(2026, 6, 12, 9).toISOString();
const SIN_FUGA: AjusteFugaCalculo = { activa: false, fallos: 0, total: 0 };

function game(overrides: Partial<GameRecord> = {}): GameRecord {
  return {
    id: crypto.randomUUID(),
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *',
    fuente: 'local',
    ritmo: 'clasica',
    resultado: '*',
    tiemposPorJugadaMs: [],
    analizada: false,
    fecha: new Date(2026, 6, 21, 10).toISOString(),
    ...overrides,
  };
}

function entrada(overrides: Partial<Parameters<typeof prescripcionesExternas>[0]> = {}) {
  return {
    games: [],
    finalesPendientes: 0,
    profile: { diagnosticoCompletadoEn: DIAGNOSTICO_VIEJO },
    compromisoAttempts: [],
    fugaCalculo: SIN_FUGA,
    now: AHORA,
    ...overrides,
  };
}

function tipos(lista: ReturnType<typeof prescripcionesExternas>) {
  return lista.map((p) => p.tipo);
}

describe('prescripcionesExternas (E11, principio 1)', () => {
  it('la partida lenta encabeza siempre: es el ejercicio con más respaldo', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 3 }));
    expect(lista[0].tipo).toBe('partida-lenta');
  });

  it('una partida lenta jugada pero sin analizar apunta al análisis, no a jugar otra', () => {
    const lista = prescripcionesExternas(entrada({ games: [game()] }));
    const partidaLenta = lista.find((p) => p.tipo === 'partida-lenta')!;
    expect(partidaLenta.estado).toBe('pendiente');
    expect(partidaLenta.ruta).toBe('#/panel/partidas');
  });

  it('cumplida la semana, se muestra igual pero como cumplida', () => {
    const lista = prescripcionesExternas(entrada({ games: [game({ analizada: true })] }));
    expect(lista.find((p) => p.tipo === 'partida-lenta')!.estado).toBe('cumplida');
  });

  it('los finales solo aparecen cuando hay técnicas vencidas o jugadas hoy', () => {
    expect(tipos(prescripcionesExternas(entrada()))).not.toContain('finales');
    const conFinales = prescripcionesExternas(entrada({ finalesPendientes: 2 }));
    expect(conFinales.find((p) => p.tipo === 'finales')).toMatchObject({ estado: 'pendiente', cantidad: 2 });
  });

  // El final jugado en otra pantalla no movía nada en Hoy: la prescripción
  // seguía diciendo "hoy te toca demostrar 2 técnicas" con las dos ya jugadas,
  // porque su estado era 'pendiente' escrito a mano y solo desaparecía cuando
  // el catálogo entero dejaba de estar vencido.
  it('un final jugado hoy descuenta de la carga del día, y completarla la marca cumplida', () => {
    const unoHecho = prescripcionesExternas(entrada({ finalesPendientes: 7, finalesHechosHoy: 1 }));
    expect(unoHecho.find((p) => p.tipo === 'finales')).toMatchObject({ estado: 'pendiente', cantidad: 1, minutos: 8 });

    const dosHechos = prescripcionesExternas(entrada({ finalesPendientes: 6, finalesHechosHoy: 2 }));
    expect(dosHechos.find((p) => p.tipo === 'finales')).toMatchObject({ estado: 'cumplida', cadencia: 'hoy', cantidad: 2 });
  });

  it('haber terminado el catálogo hoy se muestra cumplido, no desaparecido', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 0, finalesHechosHoy: 1 }));
    expect(lista.find((p) => p.tipo === 'finales')).toMatchObject({ estado: 'cumplida', cantidad: 1 });
  });

  it('los finales de hoy dejan de contar como pendientes una vez hechos', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 6, finalesHechosHoy: 2 }));
    expect(lista.filter((p) => p.estado === 'pendiente').map((p) => p.tipo)).not.toContain('finales');
  });

  it('Stoyko aparece disponible o en enfriamiento, nunca oculto', () => {
    const disponible = prescripcionesExternas(entrada());
    expect(disponible.find((p) => p.tipo === 'stoyko')!.estado).toBe('pendiente');

    // Hecho anteayer: sigue listado, con la fecha en que vuelve.
    const enfriando = prescripcionesExternas(
      entrada({ profile: { diagnosticoCompletadoEn: DIAGNOSTICO_VIEJO, stoykoUltimaCompletadaEn: new Date(2026, 6, 20, 10).toISOString() } }),
    );
    const stoyko = enfriando.find((p) => p.tipo === 'stoyko')!;
    expect(stoyko.estado).toBe('en-espera');
    expect(stoyko.fecha).toBeDefined();
    expect(stoyko.primeraVez).toBeUndefined();
  });

  it('el primer Stoyko se escalona: no se prescribe hasta 3 días después del diagnóstico', () => {
    // Diagnóstico ayer, Stoyko nunca hecho: en espera con la fecha en que se suma.
    const reciente = prescripcionesExternas(
      entrada({ profile: { diagnosticoCompletadoEn: new Date(2026, 6, 21, 9).toISOString() } }),
    );
    const stoyko = reciente.find((p) => p.tipo === 'stoyko')!;
    expect(stoyko.estado).toBe('en-espera');
    expect(stoyko.primeraVez).toBe(true);
    expect(stoyko.fecha).toBe(new Date(2026, 6, 24, 9).toISOString());

    // Pasada la espera inicial, queda pendiente como siempre (caso del
    // perfil por defecto, diagnóstico hace 10 días, cubierto arriba).
    // Y si ya hizo alguno, manda el enfriamiento semanal, no el escalonamiento.
    const conHistorial = prescripcionesExternas(
      entrada({
        profile: {
          diagnosticoCompletadoEn: new Date(2026, 6, 21, 9).toISOString(),
          stoykoUltimaCompletadaEn: new Date(2026, 6, 20, 10).toISOString(),
        },
      }),
    );
    expect(conHistorial.find((p) => p.tipo === 'stoyko')!.primeraVez).toBeUndefined();
  });

  it('los finales se topean por día y los minutos son por final, no totales', () => {
    const ocho = prescripcionesExternas(entrada({ finalesPendientes: 8 }));
    expect(ocho.find((p) => p.tipo === 'finales')).toMatchObject({ cantidad: 2, minutos: 16 });

    const uno = prescripcionesExternas(entrada({ finalesPendientes: 1 }));
    expect(uno.find((p) => p.tipo === 'finales')).toMatchObject({ cantidad: 1, minutos: 8 });
  });

  it('el cálculo comprometido solo aparece con señal, y con el porcentaje que la explica', () => {
    expect(tipos(prescripcionesExternas(entrada()))).not.toContain('compromiso');

    const conFuga = prescripcionesExternas(
      entrada({ fugaCalculo: { activa: true, fallos: 6, total: 10 } }),
    );
    expect(conFuga.find((p) => p.tipo === 'compromiso')).toMatchObject({ estado: 'pendiente', cantidad: 60 });
  });

  it('un ejercicio de cálculo hecho hoy queda cumplido; el de ayer no cuenta', () => {
    const attempt = (fecha: Date): CompromisoAttempt => ({
      id: crypto.randomUUID(),
      itemId: 'x',
      profundidad: 3,
      correcta: true,
      primerErrorEn: null,
      fecha: fecha.toISOString(),
    });
    const fuga: AjusteFugaCalculo = { activa: true, fallos: 5, total: 10 };

    const hoy = prescripcionesExternas(
      entrada({ fugaCalculo: fuga, compromisoAttempts: [attempt(new Date(2026, 6, 22, 9))] }),
    );
    expect(hoy.find((p) => p.tipo === 'compromiso')!.estado).toBe('cumplida');

    const ayer = prescripcionesExternas(
      entrada({ fugaCalculo: fuga, compromisoAttempts: [attempt(new Date(2026, 6, 21, 23))] }),
    );
    expect(ayer.find((p) => p.tipo === 'compromiso')!.estado).toBe('pendiente');
  });

  it('cuenta solo las pendientes: el enfriamiento no es una tarea atrasada', () => {
    const lista = prescripcionesExternas(
      entrada({
        games: [game({ analizada: true })],
        profile: { diagnosticoCompletadoEn: DIAGNOSTICO_VIEJO, stoykoUltimaCompletadaEn: new Date(2026, 6, 20, 10).toISOString() },
        finalesPendientes: 1,
      }),
    );
    expect(prescripcionesPendientes(lista)).toBe(1);
  });
});

// La carga de hoy no puede ser "todo lo que existe": el plan semanal declara
// cuánto tiempo hay, y lo que no entra se muestra como tarea de la semana en
// vez de acumularse como deuda diaria (E11, feedback 2026-07).
describe('cadencia y presupuesto (RF-11.3)', () => {
  it('la partida lenta y el Stoyko son semanales, no tareas de hoy', () => {
    const lista = prescripcionesExternas(entrada());
    expect(lista.find((p) => p.tipo === 'partida-lenta')!.cadencia).toBe('esta-semana');
    expect(lista.find((p) => p.tipo === 'stoyko')!.cadencia).toBe('esta-semana');
  });

  it('los finales vencen día a día: entran hoy si el presupuesto alcanza', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 8 }));
    const finales = lista.find((p) => p.tipo === 'finales')!;
    // Plan por defecto: 90 min / 3 sesiones = 30 min, sin sesión encima.
    expect(finales.cadencia).toBe('hoy');
    expect(finales.cantidad).toBe(2); // el tope diario, que cabe en 30 min
  });

  it('con la sesión ocupando casi todo el presupuesto, entra un solo final', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 8, minutosSesion: 20 }));
    const finales = lista.find((p) => p.tipo === 'finales')!;
    expect(finales.cadencia).toBe('hoy');
    expect(finales.cantidad).toBe(1); // quedan 10 min: entra uno de 8
  });

  it('sin presupuesto libre, los finales pasan a la semana y dicen por qué', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 8, minutosSesion: 30 }));
    const finales = lista.find((p) => p.tipo === 'finales')!;
    expect(finales.cadencia).toBe('esta-semana');
    expect(finales.fueraDePresupuesto).toBe(true);
    // No desaparece: sigue listada, con una técnica como unidad mínima.
    expect(finales.cantidad).toBe(1);
  });

  it('un plan más grande admite más carga diaria', () => {
    const conPlanChico = prescripcionesExternas(
      entrada({
        finalesPendientes: 8,
        minutosSesion: 20,
        profile: { diagnosticoCompletadoEn: DIAGNOSTICO_VIEJO, planSemanal: { sesionesObjetivo: 3, minutosObjetivo: 90 } },
      }),
    );
    const conPlanGrande = prescripcionesExternas(
      entrada({
        finalesPendientes: 8,
        minutosSesion: 20,
        profile: { diagnosticoCompletadoEn: DIAGNOSTICO_VIEJO, planSemanal: { sesionesObjetivo: 3, minutosObjetivo: 180 } },
      }),
    );
    expect(conPlanChico.find((p) => p.tipo === 'finales')!.cantidad).toBe(1);
    expect(conPlanGrande.find((p) => p.tipo === 'finales')!.cantidad).toBe(2);
  });

  it('prescripcionesDe separa las dos listas sin perder el orden por valor', () => {
    const lista = prescripcionesExternas(entrada({ finalesPendientes: 2, fugaCalculo: { activa: true, fallos: 6, total: 10 } }));
    expect(tipos(prescripcionesDe(lista, 'hoy'))).toEqual(['finales', 'compromiso']);
    expect(tipos(prescripcionesDe(lista, 'esta-semana'))).toEqual(['partida-lenta', 'stoyko']);
  });
});
