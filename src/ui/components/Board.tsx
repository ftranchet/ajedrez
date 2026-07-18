// Envoltorio React de chessground (design system §5, componente Board).
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { Color } from '../../core/types';

export interface BoardProps {
  fen: string;
  orientation: Color;
  turn: Color;
  lastMove: [string, string] | null;
  check: boolean;
  dests: Map<string, string[]>;
  /** Color que puede mover; null = tablero de solo lectura. */
  movableColor: Color | null;
  onMove: (from: string, to: string) => void;
  /**
   * Modificador a ciegas progresivo del currículo (RF-6.5): 'fantasma' baja
   * la opacidad de las piezas, 'coordenadas' las oculta del todo. Las piezas
   * siguen ahí (arrastrables/clicables) — solo cambia lo que se ve.
   */
  blindMode?: 'normal' | 'fantasma' | 'coordenadas';
}

const toCgColor = (c: Color) => (c === 'w' ? 'white' : 'black');

export function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(props.onMove);

  useEffect(() => {
    onMoveRef.current = props.onMove;
  }, [props.onMove]);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      animation: { duration: 200 }, // §2.4: deslizamiento de piezas
      coordinates: true,
      events: {
        move: (from: Key, to: Key) => onMoveRef.current(from, to),
      },
    });
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.set({
      fen: props.fen,
      orientation: toCgColor(props.orientation),
      turnColor: toCgColor(props.turn),
      check: props.check,
      lastMove: (props.lastMove ?? undefined) as [Key, Key] | undefined,
      movable: {
        free: false,
        color: props.movableColor ? toCgColor(props.movableColor) : undefined,
        dests: props.dests as Map<Key, Key[]>,
        showDests: true,
      },
      draggable: { enabled: true },
      selectable: { enabled: true }, // toque-toque (RF-1.1)
    });
  }, [props.fen, props.orientation, props.turn, props.check, props.lastMove, props.dests, props.movableColor]);

  // 25% de opacidad para piezas fantasma, design system §3.4/§6.5.
  const blindClass =
    props.blindMode === 'coordenadas' ? '[&_piece]:opacity-0' : props.blindMode === 'fantasma' ? '[&_piece]:opacity-25' : '';

  return <div ref={el} className={`aspect-square h-full w-full ${blindClass}`} />;
}
