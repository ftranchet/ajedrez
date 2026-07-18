// Catálogo del ejercicio de Stoyko semanal (E7, RF-7.2): posiciones "ricas"
// (varias jugadas genuinamente competitivas, sin ganador claro) obtenidas
// por autojuego del motor local y verificadas con MultiPV a profundidad 14 +
// reconfirmación a 17 (scripts/mine-stoyko.mjs; metodología documentada en
// docs/radar-dataset.md). Set inicial deliberadamente chico: a un ejercicio
// por semana, alcanza para varios meses sin repetir. `mejorLinea` son las
// primeras 3 jugadas de la variante principal del motor a
// profundidad 17, verificadas legales con chess.js.
import type { StoykoItem } from '../../core/types';

export const STOYKO_DATASET_VERSION = "stoyko-v1-8";

export const seedStoykoItems: StoykoItem[] = [
  {
    id: "stoyko-01",
    fen: "r1b1kb1r/pp3ppp/2n2n2/1qpp4/N2P4/5NP1/PP2PPBP/R1BQK2R w KQkq - 4 9",
    mejorLinea: ["e1g1","c8e6","d4c5"],
    evaluacionMotor: "±",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-02",
    fen: "r1bq1rk1/ppp2p2/2nnpPpp/1B1p4/3P2P1/2N2N2/PPPQ1P1P/R3K2R w KQ - 1 12",
    mejorLinea: ["d2f4","d6e8","b5c6"],
    evaluacionMotor: "±",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-03",
    fen: "r3kbnr/p1B2ppp/b1p1p3/2p5/4P3/2N5/PPP2PPP/R3K1NR w KQ - 4 10",
    mejorLinea: ["g1f3","a8c8","c7f4"],
    evaluacionMotor: "±",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-04",
    fen: "rn1qk2r/pp3ppp/4pn2/2p5/2BP1Bb1/4PN2/PP1b1PPP/R2Q1RK1 w kq - 0 9",
    mejorLinea: ["d1a4","b8c6","f3d2"],
    evaluacionMotor: "=",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-05",
    fen: "rn1q1rk1/pbp1bppp/1p2pn2/8/2BP4/2N1PN2/PP3PPP/R1BQ1RK1 w - - 4 9",
    mejorLinea: ["d1e2","c7c5","d4c5"],
    evaluacionMotor: "=",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-06",
    fen: "r2qkb1r/ppp1nppp/8/3b4/3Q4/2N2N2/PPP2PPP/R1B1K2R w KQkq - 0 9",
    mejorLinea: ["d4e3","d5e6","e1g1"],
    evaluacionMotor: "=",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-07",
    fen: "rn1qk2r/pp2bppp/3p1n2/2pP3b/8/2N2NPP/PP2PP2/R1BQKB1R w KQkq - 1 9",
    mejorLinea: ["e2e4","b8d7","g3g4"],
    evaluacionMotor: "±",
    fuente: "pipeline-stoyko",
  },
  {
    id: "stoyko-08",
    fen: "r1bqk1nr/1p3ppp/p1np4/2b1p3/4PB2/P1N2N2/1PPQ1PPP/R3KB1R w KQkq - 0 9",
    mejorLinea: ["f4e3","c5e3","f2e3"],
    evaluacionMotor: "=",
    fuente: "pipeline-stoyko",
  },
];
