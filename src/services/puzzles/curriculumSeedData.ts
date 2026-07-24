// Currículo base de patrones (E6, RF-6.1): 8 posiciones, una por patrón,
// verificadas programáticamente con scripts/verify-curriculum-patrones.mjs
// (mate forzado o motivo táctico confirmado con chess.js — nunca de
// memoria). Set inicial deliberadamente chico y 100% verificado; ampliarlo
// es trabajo futuro (ver docs/roadmap.md, Fase 3).
import type { CurriculumItem } from '../../core/types';
import finalesCatalogo from '../../config/finales-catalogo.json' with { type: 'json' };

export const CURRICULUM_DATASET_VERSION = 'curriculo-patrones-finales-v3';

export const seedCurriculumItems: CurriculumItem[] = [
  // Mate de pasillo (back-rank): la torre/dama entra por la última fila con
  // el rey enrocado y encerrado por sus propios peones.
  {
    id: 'patron-mate-pasillo-1',
    tipo: 'patron',
    patternKey: 'mate-pasillo',
    nombre: 'Mate de pasillo',
    fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    solucion: ['a1a8'],
  },
  {
    id: 'patron-mate-pasillo-2',
    tipo: 'patron',
    patternKey: 'mate-pasillo',
    nombre: 'Mate de pasillo (otra torre)',
    fen: '6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1',
    solucion: ['b1b8'],
  },
  {
    id: 'patron-mate-pasillo-3',
    tipo: 'patron',
    patternKey: 'mate-pasillo',
    nombre: 'Mate de pasillo con la dama',
    fen: '6k1/5ppp/8/8/8/8/8/Q5K1 w - - 0 1',
    solucion: ['a1a8'],
  },
  // Mate de la escalera: dos torres se turnan para empujar al rey al borde.
  {
    id: 'patron-mate-escalera-1',
    tipo: 'patron',
    patternKey: 'mate-escalera',
    nombre: 'Mate de la escalera',
    fen: '7k/1R6/8/8/8/8/8/R6K w - - 0 1',
    solucion: ['a1a8'],
  },
  {
    id: 'patron-mate-escalera-2',
    tipo: 'patron',
    patternKey: 'mate-escalera',
    nombre: 'Mate de la escalera (muro en c7)',
    fen: '7k/2R5/8/8/8/8/8/R6K w - - 0 1',
    solucion: ['a1a8'],
  },
  {
    id: 'patron-mate-escalera-3',
    tipo: 'patron',
    patternKey: 'mate-escalera',
    nombre: 'Mate de la escalera en la esquina',
    fen: 'k7/6R1/8/8/8/8/8/2R4K w - - 0 1',
    solucion: ['c1c8'],
  },
  // Mate de dama y rey: el rey sostiene a la dama para dar mate en el borde.
  {
    id: 'patron-mate-dama-rey-1',
    tipo: 'patron',
    patternKey: 'mate-dama-rey',
    nombre: 'Mate de dama y rey',
    fen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
    solucion: ['g1g7'],
  },
  {
    id: 'patron-mate-dama-rey-2',
    tipo: 'patron',
    patternKey: 'mate-dama-rey',
    nombre: 'Mate de dama y rey (al lado del rey)',
    fen: '7k/8/5K1Q/8/8/8/8/8 w - - 0 1',
    solucion: ['h6g7'],
  },
  {
    id: 'patron-mate-dama-rey-3',
    tipo: 'patron',
    patternKey: 'mate-dama-rey',
    nombre: 'Mate de dama y rey en la esquina',
    fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1',
    solucion: ['b1b7'],
  },
  // Mate de la coz: el caballo mata al rey ahogado por sus propias piezas.
  {
    id: 'patron-mate-coz-1',
    tipo: 'patron',
    patternKey: 'mate-coz',
    nombre: 'Mate de la coz (ahogado)',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    solucion: ['g5f7'],
  },
  {
    id: 'patron-mate-coz-2',
    tipo: 'patron',
    patternKey: 'mate-coz',
    nombre: 'Mate de la coz (desde h6)',
    fen: '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1',
    solucion: ['h6f7'],
  },
  // Horquilla de caballo: un salto ataca dos piezas a la vez.
  {
    id: 'patron-horquilla-1',
    tipo: 'patron',
    patternKey: 'horquilla',
    nombre: 'Horquilla de caballo',
    fen: '4k1q1/8/8/3N4/8/8/8/K7 w - - 0 1',
    solucion: ['d5f6'],
  },
  {
    id: 'patron-horquilla-2',
    tipo: 'patron',
    patternKey: 'horquilla',
    nombre: 'Horquilla de rey y dama en la esquina',
    fen: 'q3k3/8/8/1N6/8/8/8/6K1 w - - 0 1',
    solucion: ['b5c7'],
  },
  {
    id: 'patron-horquilla-3',
    tipo: 'patron',
    patternKey: 'horquilla',
    nombre: 'Horquilla con jaque a rey y dama',
    fen: '4k3/8/8/3q4/4N3/8/8/K7 w - - 0 1',
    solucion: ['e4f6'],
  },
  // Clavada absoluta: la pieza clavada al rey no puede moverse.
  {
    id: 'patron-clavada-1',
    tipo: 'patron',
    patternKey: 'clavada',
    nombre: 'Clavada absoluta',
    fen: '4k3/8/2n5/8/1N6/3B4/8/K7 w - - 0 1',
    solucion: ['d3b5'],
  },
  {
    id: 'patron-clavada-2',
    tipo: 'patron',
    patternKey: 'clavada',
    nombre: 'Clavada del caballo en la diagonal',
    fen: 'k7/1n6/8/3B4/8/8/8/K7 w - - 0 1',
    solucion: ['d5c6'],
  },
  {
    id: 'patron-clavada-3',
    tipo: 'patron',
    patternKey: 'clavada',
    nombre: 'Clavada del caballo con la torre',
    fen: '4k3/8/4n3/8/8/8/8/R6K w - - 0 1',
    solucion: ['a1e1'],
  },
  // Jaque a la descubierta: al mover el caballo se revela el jaque de la torre
  // (el caballo tapaba la columna) y de paso se lleva una pieza.
  {
    id: 'patron-descubierta-1',
    tipo: 'patron',
    patternKey: 'descubierta',
    nombre: 'Jaque a la descubierta',
    fen: '4k3/8/2q5/4N3/8/8/8/4R1K1 w - - 0 1',
    solucion: ['e5c6'],
  },
  // Rayos X (enfilada): el rey adelante y una pieza valiosa detrás en la misma
  // línea; el rey se mueve y cae la de atrás.
  {
    id: 'patron-rayos-x-1',
    tipo: 'patron',
    patternKey: 'rayos-x',
    nombre: 'Rayos X (enfilada de rey y dama)',
    fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1',
    solucion: ['a1e1'],
  },
  {
    id: 'patron-rayos-x-2',
    tipo: 'patron',
    patternKey: 'rayos-x',
    nombre: 'Rayos X en la fila',
    fen: '8/8/8/8/q3k3/8/6K1/7R w - - 0 1',
    solucion: ['h1h4'],
  },
  ...(finalesCatalogo as CurriculumItem[]),
];
