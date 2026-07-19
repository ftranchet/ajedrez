// Currículo base de patrones (E6, RF-6.1): 8 posiciones, una por patrón,
// verificadas programáticamente con scripts/verify-curriculum-patrones.mjs
// (mate forzado o motivo táctico confirmado con chess.js — nunca de
// memoria). Set inicial deliberadamente chico y 100% verificado; ampliarlo
// es trabajo futuro (ver docs/roadmap.md, Fase 3).
import type { CurriculumItem } from '../../core/types';
import finalesCatalogo from '../../config/finales-catalogo.json' with { type: 'json' };

export const CURRICULUM_DATASET_VERSION = 'curriculo-patrones-finales-v2';

export const seedCurriculumItems: CurriculumItem[] = [
  {
    id: 'patron-mate-pasillo-1',
    tipo: 'patron',
    patternKey: 'mate-pasillo',
    nombre: 'Mate de pasillo',
    fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    solucion: ['a1a8'],
  },
  {
    id: 'patron-mate-escalera-1',
    tipo: 'patron',
    patternKey: 'mate-escalera',
    nombre: 'Mate de la escalera',
    fen: '7k/1R6/8/8/8/8/8/R6K w - - 0 1',
    solucion: ['a1a8'],
  },
  {
    id: 'patron-mate-dama-rey-1',
    tipo: 'patron',
    patternKey: 'mate-dama-rey',
    nombre: 'Mate de dama y rey',
    fen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
    solucion: ['g1g7'],
  },
  {
    id: 'patron-mate-coz-1',
    tipo: 'patron',
    patternKey: 'mate-coz',
    nombre: 'Mate de la coz (ahogado)',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    solucion: ['g5f7'],
  },
  {
    id: 'patron-horquilla-1',
    tipo: 'patron',
    patternKey: 'horquilla',
    nombre: 'Horquilla de caballo',
    fen: '4k1q1/8/8/3N4/8/8/8/K7 w - - 0 1',
    solucion: ['d5f6'],
  },
  {
    id: 'patron-clavada-1',
    tipo: 'patron',
    patternKey: 'clavada',
    nombre: 'Clavada absoluta',
    fen: '4k3/8/2n5/8/1N6/3B4/8/K7 w - - 0 1',
    solucion: ['d3b5'],
  },
  {
    id: 'patron-descubierta-1',
    tipo: 'patron',
    patternKey: 'descubierta',
    nombre: 'Jaque a la descubierta',
    fen: '4k3/8/8/8/8/4R3/4N3/4K3 w - - 0 1',
    solucion: ['e2c3'],
  },
  {
    id: 'patron-rayos-x-1',
    tipo: 'patron',
    patternKey: 'rayos-x',
    nombre: 'Rayos X (clavada de rey y dama)',
    fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1',
    solucion: ['a1e1'],
  },
  ...(finalesCatalogo as CurriculumItem[]),
];
