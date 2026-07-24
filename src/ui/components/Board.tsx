// Envoltorio React de chessground (design system §5, componente Board).
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { Color } from '../../core/types';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type BoardFeedback =
  | { kind: 'success'; move: [string, string] | null }
  | { kind: 'error'; move: null }
  | null;

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
  /** Revelación post-respuesta. Nunca se pasa durante la fase de confianza. */
  feedback?: BoardFeedback;
}

const toCgColor = (c: Color) => (c === 'w' ? 'white' : 'black');

function kingSquareFromFen(fen: string, color: Color): Key | null {
  const target = color === 'w' ? 'K' : 'k';
  const ranks = fen.split(' ')[0]?.split('/');
  if (!ranks || ranks.length !== 8) return null;
  const files = 'abcdefgh';
  for (let rankIndex = 0; rankIndex < ranks.length; rankIndex += 1) {
    let fileIndex = 0;
    for (const symbol of ranks[rankIndex]) {
      if (/\d/.test(symbol)) fileIndex += Number(symbol);
      else {
        if (symbol === target && fileIndex < 8) return `${files[fileIndex]}${8 - rankIndex}` as Key;
        fileIndex += 1;
      }
    }
  }
  return null;
}

export function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(props.onMove);
  const reducedMotion = useReducedMotion();
  const initialReducedMotion = useRef(reducedMotion);

  useEffect(() => {
    onMoveRef.current = props.onMove;
  }, [props.onMove]);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      animation: {
        enabled: !initialReducedMotion.current,
        duration: initialReducedMotion.current ? 0 : 200,
      }, // §2.4: deslizamiento de piezas, salvo preferencia del sistema
      coordinates: true,
      drawable: { enabled: false, visible: true },
      events: {
        move: (from: Key, to: Key) => onMoveRef.current(from, to),
      },
    });
    api.current.state.drawable.brushes.feedbackSuccess = {
      key: 'feedback-success',
      color: 'var(--color-success)',
      opacity: 1,
      lineWidth: 8,
    };
    return () => {
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.set({
      animation: { enabled: !reducedMotion, duration: reducedMotion ? 0 : 200 },
    });
  }, [reducedMotion]);

  useEffect(() => {
    const errorSquare = props.feedback?.kind === 'error'
      ? kingSquareFromFen(props.fen, props.orientation) ?? (props.lastMove?.[1] as Key | undefined)
      : undefined;
    const customHighlights = new Map<Key, string>();
    if (errorSquare) customHighlights.set(errorSquare, 'feedback-error');

    api.current?.set({
      fen: props.fen,
      orientation: toCgColor(props.orientation),
      turnColor: toCgColor(props.turn),
      check: props.check,
      lastMove: (props.lastMove ?? undefined) as [Key, Key] | undefined,
      highlight: { custom: customHighlights },
      movable: {
        free: false,
        color: props.movableColor ? toCgColor(props.movableColor) : undefined,
        dests: props.dests as Map<Key, Key[]>,
        showDests: true,
      },
      draggable: { enabled: true },
      selectable: { enabled: true }, // toque-toque (RF-1.1)
    });
    // Una sola flecha limpia: el halo de contraste lo da un filtro CSS
    // (board.css), no una segunda flecha superpuesta —que dibujaba una segunda
    // punta y se veía mal (bug reportado)—.
    const successMove = props.feedback?.kind === 'success' ? props.feedback.move : null;
    api.current?.setAutoShapes(successMove
      ? [{ orig: successMove[0] as Key, dest: successMove[1] as Key, brush: 'feedbackSuccess' }]
      : []);
  }, [props.fen, props.orientation, props.turn, props.check, props.lastMove, props.dests, props.movableColor, props.feedback]);

  // 25% de opacidad para piezas fantasma, design system §3.4/§6.5.
  return (
    <div
      ref={el}
      data-blind-mode={props.blindMode ?? 'normal'}
      data-feedback={props.feedback?.kind ?? 'none'}
      data-feedback-move={props.feedback?.kind === 'success' && props.feedback.move
        ? `${props.feedback.move[0]}-${props.feedback.move[1]}`
        : undefined}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="cg-wrap aspect-square h-full w-full"
    />
  );
}
