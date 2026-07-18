// GENERADO por scripts/build-radar-dataset.mjs — no editar a mano.
// Lote radar-6485d21c233a: puzzles de Lichess (CC0) y posiciones tranquilas de
// partidas reales verificadas por Stockfish. Ver docs/radar-dataset.md,
// ADR-0005 y RF-5.6 para reproducirlo.
import type { RadarItem } from '../../core/types';

export const RADAR_DATASET_VERSION = "radar-6485d21c233a";

export const seedRadarItems: RadarItem[] = [
  {
    "id": "lichess-0000D",
    "fen": "5rk1/1p3ppp/pq1Q1b2/8/8/1P3N2/P4PPP/3R2K1 b - - 3 27",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "endgame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1474,
    "solucion": [
      "f8d8",
      "d6d8",
      "f6d8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-002Uy",
    "fen": "8/8/1p6/k7/P7/1KR4r/8/8 b - - 27 64",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "long",
      "rookEndgame",
      "reclasificado-motor"
    ],
    "rating": 1599,
    "solucion": [
      "h3c3",
      "b3c3",
      "a5a4",
      "c3b2",
      "a4b4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-2a7a97c581ac3c85",
    "fen": "rn2kb1r/pbpp1p1p/1p2p1q1/7p/3PP1B1/P1N2N2/1PP2PPP/R2QK2R w KQkq - 2 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1521,
    "solucion": [
      "f3e5"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "g4h3"
    ]
  },
  {
    "id": "lichess-00008",
    "fen": "r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2b1/PqP3PP/7K w - - 0 25",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "hangingPiece",
      "long",
      "middlegame",
      "reclasificado-motor"
    ],
    "rating": 1784,
    "solucion": [
      "e6e7",
      "b2b1",
      "b3c1",
      "b1c1",
      "h6c1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001XA",
    "fen": "2r2rk1/pbq1bppp/8/8/2p1N3/P1Bn2P1/2Q2PBP/1R3RK1 w - - 4 24",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "discoveredAttack",
      "long",
      "master",
      "middlegame",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1687,
    "solucion": [
      "b1b7",
      "c7b7",
      "e4f6",
      "e7f6",
      "g2b7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-0008Q",
    "fen": "8/5R2/1p2P3/p4r2/P6p/1P3Pk1/4K3/8 b - - 2 64",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "endgame",
      "rookEndgame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1383,
    "solucion": [
      "f5e5",
      "e2f1",
      "e5e6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-0039T",
    "fen": "1r5r/p3kp2/4p2p/4P3/R4Pp1/6P1/P1P4P/4K2R b K - 2 25",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "long",
      "rookEndgame",
      "skewer",
      "reclasificado-motor"
    ],
    "rating": 1115,
    "solucion": [
      "b8b1",
      "e1f2",
      "b1h1",
      "a4a7",
      "e7f8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-69c6122059d6afe2",
    "fen": "r2qkb1r/pp2pppp/2p2nb1/8/2B5/3P2Q1/PPP2PPP/R1B1K1NR w KQkq - 1 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1899,
    "solucion": [
      "g1f3"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "c4b3",
      "a2a4",
      "g3h3",
      "g3h4",
      "c1e3",
      "c1d2",
      "a2a3",
      "g1e2",
      "c1g5",
      "g3e3",
      "g3f3",
      "h2h3",
      "g1h3",
      "g3g5",
      "f2f4",
      "g3f4",
      "a1b1",
      "g3e5",
      "h2h4",
      "f2f3",
      "c2c3",
      "c1f4"
    ]
  },
  {
    "id": "lichess-000lC",
    "fen": "3r3r/pQNk1ppp/1qnR1n2/1B6/8/8/PPP3PP/5R1K b - - 0 19",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "hangingPiece",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1377,
    "solucion": [
      "d7d6",
      "b7b6",
      "a7b6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001h8",
    "fen": "2r3k1/2r4p/4p1p1/1p1q1pP1/p2P1P1Q/P6R/4bB2/2R3K1 w - - 6 35",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "deflection",
      "kingsideAttack",
      "long",
      "middlegame",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1780,
    "solucion": [
      "h4h7",
      "c7h7",
      "c1c8",
      "g8g7",
      "c8c7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-0009B",
    "fen": "r2qr1k1/b1p2ppp/p5n1/P1p1p3/4P1n1/B2P2Pb/3NBP1P/RN1QR1K1 w - - 0 17",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1084,
    "solucion": [
      "e2g4",
      "h3g4",
      "d1g4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-003aS",
    "fen": "8/8/5k1p/6pP/1R4P1/1p2KP2/8/1r6 b - - 0 43",
    "tipo": "defensa",
    "temas": [
      "advancedPawn",
      "crushing",
      "defensiveMove",
      "endgame",
      "long",
      "rookEndgame",
      "reclasificado-motor"
    ],
    "rating": 1921,
    "solucion": [
      "b3b2",
      "b4b6",
      "f6e5",
      "f3f4",
      "g5f4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-964a4238ada36f25",
    "fen": "r2qk2r/pp2bppp/2p1p1b1/8/2B2N2/3P1Q2/PPP2PPP/R3K2R w KQkq - 1 13",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1899,
    "solucion": [
      "h2h4"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "c2c3",
      "f4g6",
      "e1c1"
    ]
  },
  {
    "id": "lichess-001gi",
    "fen": "N6r/1p1k1ppp/2np4/b3p3/4P1b1/N1Q5/P4PPP/R3KB1R b KQ - 0 18",
    "tipo": "genuina",
    "temas": [
      "bodenMate",
      "hangingPiece",
      "mate",
      "mateIn1",
      "middlegame",
      "oneMove",
      "reclasificado-motor"
    ],
    "rating": 819,
    "solucion": [
      "a5c3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001xO",
    "fen": "k1r1b3/p1r1nppp/Bp1qpn2/2Np4/1P1P4/PQR1PN2/5PPP/2R3K1 b - - 1 19",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "master",
      "masterVsMaster",
      "middlegame",
      "sacrifice",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1876,
    "solucion": [
      "b6c5",
      "a6c8",
      "c5c4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000Pw",
    "fen": "6k1/5p1p/4p3/4q3/3n4/2Q3P1/PP1N1P1P/6K1 b - - 3 37",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "endgame",
      "fork",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1547,
    "solucion": [
      "d4e2",
      "g1f1",
      "e2c3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-004LZ",
    "fen": "8/7R/5p2/p7/7P/2p5/3k2N1/1K6 b - - 0 48",
    "tipo": "defensa",
    "temas": [
      "advancedPawn",
      "crushing",
      "defensiveMove",
      "deflection",
      "endgame",
      "long",
      "promotion",
      "reclasificado-motor"
    ],
    "rating": 1197,
    "solucion": [
      "c3c2",
      "b1a2",
      "c2c1q",
      "h7d7",
      "d2e2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-0a2497e95655916d",
    "fen": "8/pp2k1p1/2p5/6p1/3PP3/2P2K1P/PP4P1/4b3 w - - 2 29",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1899,
    "solucion": [
      "a2a4"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "f3e3",
      "f3e2",
      "e4e5",
      "g2g4",
      "g2g3"
    ]
  },
  {
    "id": "lichess-002Z9",
    "fen": "4r1k1/1p2R1p1/p2p2Pp/P1pP4/8/1R3p2/1P1q3P/5B1K w - - 0 35",
    "tipo": "genuina",
    "temas": [
      "endgame",
      "hangingPiece",
      "master",
      "mate",
      "mateIn1",
      "oneMove",
      "reclasificado-motor"
    ],
    "rating": 1231,
    "solucion": [
      "e7e8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-003mh",
    "fen": "4rk1r/1pp2p2/p2p3p/3N4/3P2q1/8/PPP5/1K2Q1NR w - - 2 24",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "attraction",
      "fork",
      "long",
      "middlegame",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1328,
    "solucion": [
      "e1e8",
      "f8e8",
      "d5f6",
      "e8e7",
      "f6g4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000Sa",
    "fen": "2Q2bk1/5p1p/p5p1/2p3P1/4B3/7P/qPr2P2/2K4R w - - 0 33",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "endgame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1545,
    "solucion": [
      "e4c2",
      "a2a1",
      "c2b1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-005YX",
    "fen": "2rr4/5pk1/p1Q1N1pp/1p4q1/3pP3/1B1P4/PPP3PP/6RK b - - 0 25",
    "tipo": "defensa",
    "temas": [
      "defensiveMove",
      "equality",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1964,
    "solucion": [
      "f7e6",
      "c6b7",
      "g7h8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-e22238370bd245f1",
    "fen": "r3kb1r/pp1b1ppp/1qn1p3/2ppPn2/5P2/2PP1N2/PP2B1PP/RNBQ1RK1 w kq - 5 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1790,
    "solucion": [
      "d1b3"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "b1a3",
      "h2h3",
      "d1e1",
      "b2b3",
      "f1f2",
      "f1e1",
      "d1d2",
      "g1h1",
      "g2g3",
      "d1c2",
      "g2g4",
      "f3e1",
      "f3g5",
      "g1f2",
      "a2a4",
      "c3c4",
      "h2h4"
    ]
  },
  {
    "id": "lichess-002bK",
    "fen": "8/7p/4k3/pb1p1pPB/1n1P3P/N1p1P3/4K3/8 w - - 2 43",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "endgame",
      "hangingPiece",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1129,
    "solucion": [
      "a3b5",
      "c3c2",
      "e2d2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-004RF",
    "fen": "5rk1/5ppp/1p6/1q3P1Q/2pp3P/6R1/6PK/8 w - - 0 31",
    "tipo": "ofensiva",
    "temas": [
      "attraction",
      "crushing",
      "discoveredAttack",
      "endgame",
      "long",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1746,
    "solucion": [
      "g3g7",
      "g8g7",
      "f5f6",
      "g7f6",
      "h5b5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000Vc",
    "fen": "8/8/4k1p1/2KpP2P/5P2/8/8/8 b - - 0 53",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "endgame",
      "long",
      "pawnEndgame",
      "reclasificado-motor"
    ],
    "rating": 1569,
    "solucion": [
      "g6h5",
      "f4f5",
      "e6e5",
      "f5f6",
      "e5f6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-0071K",
    "fen": "3N1r2/R7/kp6/p2pPp1Q/2pP2P1/2q5/2P5/2K5 b - - 1 38",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "hangingPiece",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1135,
    "solucion": [
      "a6a7",
      "h5h7",
      "a7a6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-db862e2fb56712e2",
    "fen": "r2qk1r1/pbpp1pbp/1pn1p2p/8/2B1P3/2PP2QN/PP3PPP/RN2K2R w KQq - 3 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1482,
    "solucion": [
      "d3d4"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "e1g1",
      "g3e3"
    ]
  },
  {
    "id": "lichess-005wJ",
    "fen": "r3kb1r/ppqN1ppp/4pn2/1Q3b2/3P4/8/PP2PPPP/RNB1KB1R b KQkq - 0 9",
    "tipo": "genuina",
    "temas": [
      "hangingPiece",
      "mate",
      "mateIn1",
      "oneMove",
      "opening",
      "reclasificado-motor"
    ],
    "rating": 1393,
    "solucion": [
      "c7c1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-004kB",
    "fen": "4rr1k/p1Qn2pp/3p1q2/8/8/2P5/PP3PPP/RN3RK1 b - - 0 16",
    "tipo": "ofensiva",
    "temas": [
      "kingsideAttack",
      "long",
      "mate",
      "mateIn3",
      "middlegame",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1209,
    "solucion": [
      "f6f2",
      "f1f2",
      "e8e1",
      "f2f1",
      "e1f1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000Zo",
    "fen": "4r3/1k6/pp3P2/1b5p/3R1p2/P1R2P2/1P4PP/6K1 b - - 0 35",
    "tipo": "ofensiva",
    "temas": [
      "endgame",
      "mate",
      "mateIn2",
      "operaMate",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1363,
    "solucion": [
      "e8e1",
      "g1f2",
      "e1f1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00CMj",
    "fen": "7R/8/8/6p1/2p1p1k1/2Pb3p/P4K2/8 b - - 5 71",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "master",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1647,
    "solucion": [
      "e4e3",
      "f2e3",
      "g4g3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-71b6f89c89a36440",
    "fen": "3q1rk1/p1p2p2/Q2pbn2/2b1p1p1/4P2p/2PP2BP/P2N1PP1/R4RK1 w - - 0 17",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1521,
    "solucion": [
      "g3h2"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "d3d4"
    ]
  },
  {
    "id": "lichess-007OE",
    "fen": "8/pkp5/2p1p3/3p4/N2q4/1P4Q1/1PP3Pr/K2R4 b - - 0 29",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "endgame",
      "hangingPiece",
      "long",
      "quietMove",
      "reclasificado-motor"
    ],
    "rating": 1279,
    "solucion": [
      "d4d1",
      "a1a2",
      "h2h1",
      "a4c5",
      "b7b6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-005do",
    "fen": "5r2/pp1k4/4p1b1/3pP1Np/3P1P1K/8/P7/2R5 w - - 8 43",
    "tipo": "ofensiva",
    "temas": [
      "attraction",
      "crushing",
      "deflection",
      "endgame",
      "fork",
      "long",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1433,
    "solucion": [
      "c1c7",
      "d7c7",
      "g5e6",
      "c7b6",
      "e6f8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000aY",
    "fen": "r4rk1/pp2Bppp/2n1b3/q1pp4/8/P1Q2NP1/1PP1PP1P/2KR3R b - - 1 15",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "master",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1412,
    "solucion": [
      "a5c3",
      "b2c3",
      "c6e7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00Cqg",
    "fen": "3r2k1/pp4bp/4qpp1/3Pp3/8/4Q2P/4B1P1/2rR3K w - - 0 27",
    "tipo": "defensa",
    "temas": [
      "advantage",
      "defensiveMove",
      "hangingPiece",
      "long",
      "middlegame",
      "reclasificado-motor"
    ],
    "rating": 1621,
    "solucion": [
      "d5e6",
      "d8d1",
      "e2d1",
      "c1d1",
      "h1h2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-0808e90fc2a1fa55",
    "fen": "r3k1nr/1ppn1ppp/p2p1q2/2b1p3/2P1P3/P2P1Q1P/1P2BPP1/RNB1K2R w KQkq - 3 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1759,
    "solucion": [
      "b1c3"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "c1e3",
      "b1d2",
      "f3f6",
      "h1f1",
      "a1a2",
      "f3g3",
      "a3a4",
      "c1d2",
      "h3h4",
      "e1g1",
      "e2d1",
      "h1g1",
      "g2g3"
    ]
  },
  {
    "id": "lichess-0095W",
    "fen": "8/pp1r2kp/q2P1ppb/4N3/4P3/1Q5P/PPR2PP1/6K1 b - - 0 32",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "endgame",
      "hangingPiece",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1836,
    "solucion": [
      "f6e5",
      "c2c7",
      "a6d6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-005f3",
    "fen": "r5k1/2p1pp2/pp4p1/1q5r/5P2/2QP2R1/PP6/1K4R1 w - - 1 33",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "endgame",
      "sacrifice",
      "veryLong",
      "reclasificado-motor"
    ],
    "rating": 1903,
    "solucion": [
      "g3g6",
      "f7g6",
      "g1g6",
      "g8f7",
      "c3g7",
      "f7e8",
      "g7g8",
      "e8d7",
      "g8e6",
      "d7d8",
      "g6g8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000hf",
    "fen": "r1bq3r/pp1nbkp1/2p1p2p/8/2BP4/1PN3P1/P3QP1P/3R1RK1 w - - 0 20",
    "tipo": "ofensiva",
    "temas": [
      "mate",
      "mateIn2",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1576,
    "solucion": [
      "e2e6",
      "f7f8",
      "e6f7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00Erm",
    "fen": "3r4/6k1/1p1pr1p1/p1p2p2/P1P1p1P1/1P1n4/3R1PBP/4R1K1 w - - 1 30",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "long",
      "reclasificado-motor"
    ],
    "rating": 1402,
    "solucion": [
      "d2d3",
      "e4d3",
      "e1e6",
      "d3d2",
      "g2f3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-18d5f010a16f7d5c",
    "fen": "4k2r/rp1nnp2/p1pp2qp/4p1p1/1PP1P1Q1/P1NP3P/4BPP1/1R3RK1 w k - 1 17",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1759,
    "solucion": [
      "b1d1"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "g4f3",
      "g4g3",
      "c4c5",
      "f1d1",
      "h3h4",
      "a3a4",
      "e2d1",
      "g4h5"
    ]
  },
  {
    "id": "lichess-00B8m",
    "fen": "3b4/3P4/pp2Pk2/5Q2/P6p/8/8/7K b - - 0 43",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "endgame",
      "hangingPiece",
      "long",
      "reclasificado-motor"
    ],
    "rating": 1275,
    "solucion": [
      "f6f5",
      "e6e7",
      "d8e7",
      "d7d8q",
      "e7d8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-006wz",
    "fen": "2r5/4ppkp/6p1/1p6/1P6/P3B3/1br2PPP/1R1R2K1 w - - 3 23",
    "tipo": "ofensiva",
    "temas": [
      "attraction",
      "crushing",
      "endgame",
      "fork",
      "long",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1426,
    "solucion": [
      "b1b2",
      "c2b2",
      "e3d4",
      "f7f6",
      "d4b2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000mr",
    "fen": "5r1k/5rp1/p7/1b2B2p/1P1P1Pq1/2R3Q1/P3p1P1/2R3K1 b - - 1 41",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1957,
    "solucion": [
      "f7f4",
      "e5f4",
      "f8f4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00G1l",
    "fen": "5k2/1R6/3pp1P1/2p5/1p2PK2/5P2/8/2r5 w - - 1 61",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "master",
      "rookEndgame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1815,
    "solucion": [
      "f4g5",
      "c1g1",
      "g5f6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-a3281b6b281e83e4",
    "fen": "1r2k2r/1p2np2/pNpp1nq1/4p1pp/1PP1P3/P2PQ2P/4BPP1/1R3RK1 w k - 6 21",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1759,
    "solucion": [
      "c4c5"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "b1d1",
      "b1e1",
      "b4b5",
      "e2d1",
      "a3a4",
      "b1b3",
      "f1d1",
      "b1b2",
      "f1e1",
      "e3g3",
      "f1c1",
      "g2g3",
      "b1a1"
    ]
  },
  {
    "id": "lichess-00BJm",
    "fen": "r4rk1/1Q2bppp/p1N1p3/1p1q4/2pP1n2/2P5/PP3PPP/R4RK1 w - - 2 19",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "fork",
      "hangingPiece",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1074,
    "solucion": [
      "c6e7",
      "g8h8",
      "e7d5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00761",
    "fen": "3r2k1/1b4bR/p2P2p1/3p2N1/2p5/2P2N2/PP6/2K5 w - - 0 29",
    "tipo": "ofensiva",
    "temas": [
      "attraction",
      "crushing",
      "endgame",
      "exposedKing",
      "fork",
      "long",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1474,
    "solucion": [
      "h7g7",
      "g8g7",
      "g5e6",
      "g7g8",
      "e6d8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000o3",
    "fen": "8/2p5/3k2p1/1p1P1p2/1P3P2/3K2Pp/7P/8 w - - 2 44",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "endgame",
      "pawnEndgame",
      "short",
      "zugzwang",
      "reclasificado-motor"
    ],
    "rating": 944,
    "solucion": [
      "d3d4",
      "g6g5",
      "f4g5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00G81",
    "fen": "3r4/5k2/p4Pp1/2K3Pp/2R5/P7/8/8 b - - 0 51",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "long",
      "rookEndgame",
      "reclasificado-motor"
    ],
    "rating": 1443,
    "solucion": [
      "d8c8",
      "c5d4",
      "c8c4",
      "d4c4",
      "h5h4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-efee0e6b5b1cf1ad",
    "fen": "rn1q1rk1/1p1b1p2/p2pp1p1/2pP2Np/2PnP3/2NB4/PP3PPP/R2QR1K1 w - - 0 13",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1307,
    "solucion": [
      "d1d2"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "f2f4",
      "d1c1"
    ]
  },
  {
    "id": "lichess-00Er4",
    "fen": "r3k2r/p1bN2pp/2p1Rp2/3p3b/3P1q2/2N4P/PPPQ1PP1/R5K1 b kq - 0 16",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "hangingPiece",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1295,
    "solucion": [
      "e8d7",
      "d2f4",
      "c7f4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-007en",
    "fen": "rn3rk1/4pp1p/3p2pB/2q4P/3QP1b1/Pp6/1P2B3/1K1R2NR b - - 0 20",
    "tipo": "ofensiva",
    "temas": [
      "long",
      "mate",
      "mateIn3",
      "middlegame",
      "queensideAttack",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1792,
    "solucion": [
      "c5c2",
      "b1a1",
      "a8a3",
      "b2a3",
      "c2a2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-000rO",
    "fen": "3R4/8/8/KB2b3/1p6/1P2k3/3p4/8 b - - 0 58",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "endgame",
      "fork",
      "master",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1110,
    "solucion": [
      "e5c7",
      "a5b4",
      "c7d8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00Gvr",
    "fen": "8/1b4p1/1k3pPp/4K2P/4PP2/8/8/8 w - - 0 47",
    "tipo": "defensa",
    "temas": [
      "advantage",
      "bishopEndgame",
      "defensiveMove",
      "endgame",
      "master",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1149,
    "solucion": [
      "e5e6",
      "b7e4",
      "e6f7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-7e1631ba20f17a9b",
    "fen": "r1bq1rk1/1pp2pp1/p1nb1n1p/8/8/P1N1PN2/1PP1BPPP/R1BQK2R w KQ - 0 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1475,
    "solucion": [
      "e1g1"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "h2h3",
      "b2b3",
      "b2b4",
      "e2d3",
      "f3d4",
      "d1d2",
      "a1b1",
      "d1d3",
      "c1d2",
      "f3d2"
    ]
  },
  {
    "id": "lichess-00HEx",
    "fen": "R7/5pk1/4pn1p/8/3NP3/5P2/6PP/2rB2K1 b - - 0 31",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "endgame",
      "fork",
      "hangingPiece",
      "master",
      "short",
      "reclasificado-motor"
    ],
    "rating": 920,
    "solucion": [
      "c1d1",
      "g1f2",
      "d1d4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-009FP",
    "fen": "r1b1k1nr/ppp2pbp/3p1qp1/4p3/2BnP3/N2P2QP/PPP2PP1/R1B1K2R w KQkq - 0 10",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "opening",
      "short",
      "trappedPiece",
      "reclasificado-motor"
    ],
    "rating": 1368,
    "solucion": [
      "c1g5",
      "f6g5",
      "g3g5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00143",
    "fen": "r4rk1/5ppp/1np2q2/p1b5/2p1B3/P7/1P3PPP/R1BQ1RK1 w - - 2 18",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1825,
    "solucion": [
      "d1h5",
      "h7h6",
      "h5c5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00HGG",
    "fen": "8/pp6/2p1kpp1/3p2P1/3P1P1p/1P3K2/P1P4P/8 b - - 0 31",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "long",
      "pawnEndgame",
      "reclasificado-motor"
    ],
    "rating": 1682,
    "solucion": [
      "f6g5",
      "f3g4",
      "g5f4",
      "g4f4",
      "e6f6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-51c6415e55759059",
    "fen": "r1bq1rk1/1p3pp1/p1p2n1p/4b3/8/P1N1PB2/1PPB1PPP/2RQ1RK1 w - - 0 13",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1475,
    "solucion": [
      "d1e2"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "g2g3",
      "f1e1",
      "g1h1",
      "e3e4",
      "b2b3",
      "f3e2",
      "c1b1",
      "d1e1",
      "c3a4",
      "b2b4",
      "d2e1",
      "h2h4",
      "h2h3",
      "a3a4",
      "c1a1"
    ]
  },
  {
    "id": "lichess-00LI0",
    "fen": "r2qk2r/pp1n1ppp/4pn2/3N2B1/1b1P4/4QN1P/PPb1BPP1/R4RK1 b kq - 0 12",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "hangingPiece",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1289,
    "solucion": [
      "f6d5",
      "g5d8",
      "d5e3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00AhO",
    "fen": "Q1b2rk1/2q2p1p/1p2pbp1/pP6/2P5/P2B1N2/5PPP/3R1RK1 b - - 0 20",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "clearance",
      "long",
      "master",
      "middlegame",
      "trappedPiece",
      "reclasificado-motor"
    ],
    "rating": 1233,
    "solucion": [
      "c8b7",
      "a8a7",
      "f8a8",
      "a7a8",
      "b7a8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-0017R",
    "fen": "r2qk2r/pp2ppbp/1n1p2p1/3P4/2n5/2NBBP1P/PP3P2/R2QK2R w KQkq - 0 13",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "fork",
      "long",
      "middlegame",
      "reclasificado-motor"
    ],
    "rating": 1522,
    "solucion": [
      "d3c4",
      "b6c4",
      "d1a4",
      "d8d7",
      "a4c4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00IF1",
    "fen": "1k6/p1p5/P2p4/3P4/1PK2r1p/4P3/8/4B3 w - - 0 58",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "hangingPiece",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1267,
    "solucion": [
      "e3f4",
      "h4h3",
      "e1g3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-050dfe28e7705519",
    "fen": "3q2k1/1p3p2/p1p1bp1p/8/4P3/P4B2/1PP1QPP1/7K w - - 0 25",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1475,
    "solucion": [
      "e2e3"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "f3g4",
      "c2c3",
      "g2g3",
      "f3h5",
      "b2b4",
      "h1h2",
      "h1g1",
      "e2d1",
      "e2e1",
      "b2b3",
      "a3a4",
      "g2g4"
    ]
  },
  {
    "id": "lichess-00MTn",
    "fen": "2rqk2r/3n4/1p2p3/p3N2R/Q1PP2p1/P2BP3/3K1Pb1/R7 b k - 0 22",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "hangingPiece",
      "long",
      "middlegame",
      "reclasificado-motor"
    ],
    "rating": 1336,
    "solucion": [
      "h8h5",
      "d3g6",
      "e8e7",
      "a4d7",
      "d8d7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00BM8",
    "fen": "3r1rk1/pp2bppp/2ppnn2/8/N1P1P3/q1P4P/P2N2PB/R2Q1R1K w - - 1 17",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "master",
      "middlegame",
      "short",
      "trappedPiece",
      "reclasificado-motor"
    ],
    "rating": 1583,
    "solucion": [
      "d2b1",
      "a3a4",
      "d1a4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-0018P",
    "fen": "5R2/1p6/p1p1k3/2P1r3/2K3p1/2P1p1P1/1P5P/8 w - - 2 45",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "endgame",
      "exposedKing",
      "rookEndgame",
      "veryLong",
      "reclasificado-motor"
    ],
    "rating": 1909,
    "solucion": [
      "f8e8",
      "e6f5",
      "e8e5",
      "f5e5",
      "c4d3",
      "e5d5",
      "d3e3",
      "a6a5",
      "e3f4",
      "d5c4",
      "f4g4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00InW",
    "fen": "8/2p5/pp1p4/3P1N2/PPP1Pp2/5n1p/5K1k/8 w - - 0 47",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "hangingPiece",
      "knightEndgame",
      "long",
      "reclasificado-motor"
    ],
    "rating": 1472,
    "solucion": [
      "f2f3",
      "h2g1",
      "f3f4",
      "h3h2",
      "f5g3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-2cb08d9f5dca690c",
    "fen": "6k1/1p3p2/p1p4p/2q2b2/8/P4B2/1P1Q1PP1/7K w - - 0 29",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1475,
    "solucion": [
      "b2b4"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "d2f4",
      "d2h6",
      "g2g4",
      "h1g1",
      "g2g3",
      "a3a4"
    ]
  },
  {
    "id": "lichess-00WzS",
    "fen": "r2qk2r/2pn1p1n/pp1p2Bp/3Pp1b1/PPP1P3/2N1B3/3N2PP/R2Q1RK1 b kq - 0 17",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "hangingPiece",
      "intermezzo",
      "middlegame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1463,
    "solucion": [
      "g5e3",
      "g1h1",
      "f7g6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00BrZ",
    "fen": "r6r/pp2kb2/3p1p2/1N1Pp3/3bP3/P2B2P1/1P1Q2PP/7K b - - 7 28",
    "tipo": "ofensiva",
    "temas": [
      "attraction",
      "kingsideAttack",
      "long",
      "mate",
      "mateIn3",
      "middlegame",
      "pillsburysMate",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1380,
    "solucion": [
      "h8h2",
      "h1h2",
      "a8h8",
      "d2h6",
      "h8h6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001Fg",
    "fen": "5r1k/pQR3pp/5rp1/3B4/q2n4/7P/P4PP1/5RK1 b - - 4 30",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "middlegame",
      "veryLong",
      "reclasificado-motor"
    ],
    "rating": 1474,
    "solucion": [
      "d4e2",
      "g1h2",
      "a4f4",
      "h2h1",
      "e2g3",
      "f2g3",
      "f4f1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00JzT",
    "fen": "8/7K/6p1/5p2/4p3/1k4P1/5P1P/8 b - - 0 44",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "pawnEndgame",
      "quietMove",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1638,
    "solucion": [
      "g6g5",
      "g3g4",
      "f5f4"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-8f304f71470ee768",
    "fen": "r3k2r/pp2pp2/2p3pb/6Np/bPpP1B2/2P4P/P4PP1/2R2RK1 w kq - 2 21",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1594,
    "solucion": [
      "h3h4"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "f1e1",
      "a2a3",
      "c1b1",
      "g1h2",
      "f2f3",
      "c1e1",
      "f4e3",
      "f4d2"
    ]
  },
  {
    "id": "lichess-00X1l",
    "fen": "5r1k/Q6p/1pb3p1/4q3/4p3/1BP4P/PP4p1/5RK1 w - - 0 31",
    "tipo": "genuina",
    "temas": [
      "endgame",
      "hangingPiece",
      "mate",
      "mateIn1",
      "oneMove",
      "reclasificado-motor"
    ],
    "rating": 848,
    "solucion": [
      "f1f8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00CXr",
    "fen": "r2k2nr/p3qBb1/1p1p3p/Q5p1/3n1B2/2N2R2/PPP3P1/R5K1 w - - 0 19",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "long",
      "middlegame",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1908,
    "solucion": [
      "a5d5",
      "d4f3",
      "g2f3",
      "a8c8",
      "f4d6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001Wz",
    "fen": "6k1/5ppp/r1p5/p1n1rP2/8/2P2N1P/2P3P1/3R2K1 w - - 0 22",
    "tipo": "envenenada",
    "temas": [
      "backRankMate",
      "endgame",
      "mate",
      "mateIn2",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1118,
    "solucion": [
      "d1d8",
      "e5e8",
      "d8e8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00Knu",
    "fen": "r2q1rk1/p3bpp1/2pp2b1/4p1Q1/4n3/1B3N1P/PPP3P1/R1B2RK1 w - - 1 19",
    "tipo": "defensa",
    "temas": [
      "advantage",
      "defensiveMove",
      "opening",
      "pin",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1873,
    "solucion": [
      "g5g6",
      "d8b6",
      "g1h2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-2e92072f1649aac8",
    "fen": "rnbq1rk1/ppp1b1pp/4p3/3pPp2/3P2Q1/2NB4/PPP2PPP/R3K1NR w KQ f6 0 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1856,
    "solucion": [
      "g4h3"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "g4g3",
      "g4e2",
      "g4h5",
      "g4f4",
      "e5f6",
      "g4d1"
    ]
  },
  {
    "id": "lichess-00ZAn",
    "fen": "rnbqk1nr/ppp1b1pp/3p4/4N3/2B1P3/8/PPPP2PP/RNBQK2R b KQkq - 0 6",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "hangingPiece",
      "long",
      "opening",
      "reclasificado-motor"
    ],
    "rating": 1794,
    "solucion": [
      "d6e5",
      "d1h5",
      "g7g6",
      "h5e5",
      "g8f6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00Cwz",
    "fen": "1r5r/5pk1/4p3/3p2PP/N1nP4/n1P5/P3B3/K1R4R b - - 0 34",
    "tipo": "ofensiva",
    "temas": [
      "mate",
      "mateIn2",
      "middlegame",
      "sacrifice",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1492,
    "solucion": [
      "b8b1",
      "c1b1",
      "a3c2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001cr",
    "fen": "8/3B2pp/p5k1/6P1/1ppp1K2/8/1P6/8 w - - 0 39",
    "tipo": "ofensiva",
    "temas": [
      "bishopEndgame",
      "endgame",
      "mate",
      "mateIn1",
      "oneMove",
      "reclasificado-motor"
    ],
    "rating": 1631,
    "solucion": [
      "d7e8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00O3h",
    "fen": "5k2/R3Rp2/6p1/1p5p/1P1r3K/2n5/7P/8 w - - 8 44",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "endgame",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1150,
    "solucion": [
      "h4g5",
      "c3e4",
      "g5h6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-c7fa28c2bbfb43d3",
    "fen": "r1b2rk1/ppppnpp1/1bn2q1p/4p3/1PB1P3/P1NP1N2/2P2PPP/R1BQ1RK1 w - - 4 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1734,
    "solucion": [
      "g1h1"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "a1b1",
      "c1e3",
      "c3e2",
      "c3a4",
      "c1d2",
      "a1a2",
      "h2h3",
      "b4b5",
      "d1e1",
      "c1b2",
      "c3d5",
      "f3e1",
      "f3d2",
      "c4a2",
      "d1e2",
      "c4b3"
    ]
  },
  {
    "id": "lichess-00dzT",
    "fen": "6k1/1Q4p1/p1p4p/3pP3/P3bq2/2N4P/1P4P1/5B1K b - - 2 26",
    "tipo": "genuina",
    "temas": [
      "endgame",
      "hangingPiece",
      "mate",
      "mateIn2",
      "short",
      "reclasificado-motor"
    ],
    "rating": 908,
    "solucion": [
      "f4f1",
      "h1h2",
      "f1g2"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00DdW",
    "fen": "5rk1/5ppp/4b3/1p1pPpPP/2pP4/b1P5/rqNQKP2/2RRN3 w - - 6 24",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "middlegame",
      "short",
      "trappedPiece",
      "reclasificado-motor"
    ],
    "rating": 1693,
    "solucion": [
      "c1b1",
      "b2b3",
      "b1b3"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001kG",
    "fen": "rnbq3r/1p3kpp/p4n2/2b5/2pNP3/2N5/PPP3PP/R1BQ1RK1 w - - 2 12",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "opening",
      "pin",
      "short",
      "reclasificado-motor"
    ],
    "rating": 1921,
    "solucion": [
      "d1h5",
      "f7g8",
      "h5c5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00R4l",
    "fen": "r1b5/R4pkp/3p2p1/2pPr3/2P5/1P1B4/5PPP/R5K1 b - - 0 24",
    "tipo": "defensa",
    "temas": [
      "advantage",
      "defensiveMove",
      "endgame",
      "long",
      "reclasificado-motor"
    ],
    "rating": 1563,
    "solucion": [
      "a8a7",
      "a1a7",
      "e5e1",
      "d3f1",
      "c8f5"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-ab9201234847b163",
    "fen": "r1b2rk1/1pppnpp1/pb4qp/4P3/1PBp4/P1NP1N2/2P2PPP/R2QR1K1 w - - 1 13",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1734,
    "solucion": [
      "f3h4"
    ],
    "fuente": "pipeline-tranquilas",
    "jugadasAceptables": [
      "c3e4",
      "c3e2",
      "c3d5",
      "c3a4"
    ]
  },
  {
    "id": "lichess-00hbV",
    "fen": "8/pk1r2R1/1p2b3/8/2P2N2/1P6/1K6/8 w - - 22 61",
    "tipo": "genuina",
    "temas": [
      "crushing",
      "endgame",
      "hangingPiece",
      "master",
      "short",
      "reclasificado-motor"
    ],
    "rating": 947,
    "solucion": [
      "f4e6",
      "d7g7",
      "e6g7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00F6y",
    "fen": "2k3r1/pppb1prp/1q6/8/Q7/2P1R1P1/P4P1P/4R1K1 w - - 4 24",
    "tipo": "ofensiva",
    "temas": [
      "long",
      "mate",
      "mateIn3",
      "middlegame",
      "queensideAttack",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 938,
    "solucion": [
      "e3e8",
      "d7e8",
      "e1e8",
      "g8e8",
      "a4e8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-001m3",
    "fen": "7r/6k1/2b1Rp2/8/P1N3p1/5nP1/5P2/Q4K2 b - - 0 38",
    "tipo": "ofensiva",
    "temas": [
      "advantage",
      "endgame",
      "short",
      "skewer",
      "reclasificado-motor"
    ],
    "rating": 1455,
    "solucion": [
      "h8h1",
      "f1e2",
      "h1a1"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00VNr",
    "fen": "5rk1/npp3p1/p3Rr1p/2b5/3N4/4B2P/PPP2PP1/R5K1 b - - 0 22",
    "tipo": "defensa",
    "temas": [
      "crushing",
      "defensiveMove",
      "long",
      "middlegame",
      "reclasificado-motor"
    ],
    "rating": 1950,
    "solucion": [
      "c5d4",
      "e6f6",
      "d4f6",
      "e3a7",
      "b7b6"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "quiet-746e85de890cf356",
    "fen": "r1bqkb1r/2pp1pp1/p1n3np/3Np3/1pP1P3/1B3N2/PP1P1PPP/R1BQK2R w KQkq - 0 9",
    "tipo": "tranquila",
    "temas": [
      "partida-real",
      "verificada-stockfish"
    ],
    "rating": 1471,
    "solucion": [
      "d2d4"
    ],
    "fuente": "pipeline-tranquilas"
  },
  {
    "id": "lichess-00hxr",
    "fen": "r4rk1/pp3pBp/4p3/3p2qB/Q1p5/2PbP3/PP1N1P1P/R3K2R b KQ - 0 15",
    "tipo": "genuina",
    "temas": [
      "advantage",
      "hangingPiece",
      "long",
      "middlegame",
      "reclasificado-motor"
    ],
    "rating": 1784,
    "solucion": [
      "g5h5",
      "a4d1",
      "h5d1",
      "a1d1",
      "g8g7"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "lichess-00GVf",
    "fen": "5k2/3b2q1/pn4p1/1rp2p2/8/8/1P2Q1P1/1K2R2R w - - 4 33",
    "tipo": "ofensiva",
    "temas": [
      "crushing",
      "exposedKing",
      "long",
      "middlegame",
      "sacrifice",
      "reclasificado-motor"
    ],
    "rating": 1559,
    "solucion": [
      "h1h8",
      "g7h8",
      "e2e7",
      "f8g8",
      "e7d8"
    ],
    "fuente": "lichess-cc0"
  },
  {
    "id": "dobsol-01",
    "fen": "2r1k2r/1q2bp1p/2p2np1/p1Pp1N2/8/4BQ2/PPP2PPP/R3K2R w KQk - 0 16",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "f5d6"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "f5e7"
    }
  },
  {
    "id": "dobsol-02",
    "fen": "rn1q1rk1/1bp1bppp/8/pB1pB3/1P1P4/P1N1Q1n1/2P2PPP/R4RK1 w - - 0 18",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "e3g3"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "e5g3"
    }
  },
  {
    "id": "dobsol-03",
    "fen": "rn1qr1k1/p4p1p/2p2p2/1p2N3/3Pp3/2P5/P1P2PPP/R2QR1K1 w - - 0 15",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "e5g4"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "d1g4"
    }
  },
  {
    "id": "dobsol-04",
    "fen": "rnb1r3/4kpp1/p1pb3p/1p1Bp3/4P3/4BN2/PPP2PPP/2KR3R w - - 0 15",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "d5f7"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "d5b3"
    }
  },
  {
    "id": "dobsol-05",
    "fen": "rnbr2k1/pp2qppp/2p5/8/2B1N3/8/PPP2PPP/R2QR1K1 w - - 5 15",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "d1h5"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "c4f7"
    }
  },
  {
    "id": "dobsol-06",
    "fen": "r1b1k2r/pp2q1pp/2pp1p2/4b3/8/P4Q2/BB1N2PP/R3R1K1 w kq - 0 17",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "d2c4"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "b2e5"
    }
  },
  {
    "id": "dobsol-07",
    "fen": "r3kb1r/ppp1nppp/2n5/4Pb2/2B1pB2/2N5/PPP2PPP/2KR2NR w - - 8 9",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "c3b5"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "g1e2"
    }
  },
  {
    "id": "dobsol-08",
    "fen": "N5kr/pp3pp1/2n5/2q4p/2Pp1nbP/P2B1P2/2PQ1KP1/R6R w - - 0 19",
    "tipo": "ofensiva",
    "temas": [
      "doble-solucion",
      "autojuego-verificado"
    ],
    "rating": 1500,
    "solucion": [
      "d2f4"
    ],
    "fuente": "pipeline-doble-solucion",
    "dobleSolucion": {
      "familiar": "f3g4"
    }
  }
];
