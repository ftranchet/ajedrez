// GENERADO por scripts/build-seed-puzzles.mjs — no editar a mano.
// Dataset semilla de DESARROLLO para el Radar (E5): cada posición fue
// construida y verificada con chess.js + Stockfish (ver el script), no
// tomada del dataset real de Lichess CC0 (ADR-0005) por la limitación de
// red de este entorno. Para producción, correr scripts/import-puzzles.mjs
// sobre el CSV oficial en un entorno con acceso a database.lichess.org.
import type { RadarItem } from '../../core/types';

export const seedRadarItems: RadarItem[] = [
  {
    "id": "seed-01",
    "fen": "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    "tipo": "ofensiva",
    "temas": [
      "mateEnUno",
      "ataqueDescubierto"
    ],
    "rating": 900,
    "solucion": [
      "e1e8"
    ],
    "fuente": "seed-dev"
  },
  {
    "id": "seed-03",
    "fen": "r2q1rk1/ppp2p1p/3p1npb/4p3/2B1P3/3P1N2/PPPQ1PPP/R4RK1 w - - 0 1",
    "tipo": "genuina",
    "temas": [
      "ofertaMaterial"
    ],
    "rating": 1000,
    "solucion": [
      "d2h6"
    ],
    "fuente": "seed-dev"
  },
  {
    "id": "seed-04",
    "fen": "rnb1kbnr/ppp2ppp/8/3q4/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 2 4",
    "tipo": "envenenada",
    "temas": [
      "ofertaMaterial",
      "trampa"
    ],
    "rating": 1300,
    "solucion": [
      "d5h5"
    ],
    "fuente": "seed-dev"
  },
  {
    "id": "seed-05",
    "fen": "r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5",
    "tipo": "tranquila",
    "temas": [
      "desarrollo"
    ],
    "rating": 1000,
    "solucion": [
      "e1g1"
    ],
    "fuente": "seed-dev"
  },
  {
    "id": "seed-06",
    "fen": "rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQ - 1 5",
    "tipo": "tranquila",
    "temas": [
      "desarrollo"
    ],
    "rating": 1200,
    "solucion": [
      "g1f3"
    ],
    "fuente": "seed-dev"
  },
  {
    "id": "seed-07",
    "fen": "rn3rk1/pppp1ppp/8/2b1p1N1/7q/8/PPPPPPPP/RN1Q1RK1 w - - 0 1",
    "tipo": "defensa",
    "temas": [
      "defensaObligada"
    ],
    "rating": 1200,
    "solucion": [
      "g5f3"
    ],
    "fuente": "seed-dev"
  },
  {
    "id": "seed-08",
    "fen": "r3k2r/ppp2ppp/2n5/3qp3/1b1P4/2N1PN2/PPP2PPP/R2QKB1R w KQkq - 0 1",
    "tipo": "ofensiva",
    "temas": [
      "tenedor"
    ],
    "rating": 1500,
    "solucion": [
      "f1e2"
    ],
    "fuente": "seed-dev"
  }
];
