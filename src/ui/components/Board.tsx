// Envoltorio React de chessground (design system §5, componente Board).
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { Color } from '../../core/types';
import type { RevisionDelError } from '../../core/revision';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type BoardFeedback =
  | { kind: 'success'; move: [string, string] | null }
  /**
   * Error: además del velo rojo bajo el rey, el tablero vuelve a la posición
   * en la que se decidió y muestra con flechas lo que se jugó y lo que había
   * que jugar (RF-5.3). Sin `revision` —un bloque sin jugada correcta que
   * mostrar, como el criterio de cálculo— se comporta como antes.
   */
  | { kind: 'error'; move: null; revision?: RevisionDelError | null }
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
    // La flecha de la jugada correcta usa el mismo verde que un acierto: es la
    // jugada que había que hacer, no otro tipo de señal. La del usuario va en
    // rojo y más fina, para que la lectura sea "esto jugaste, esto era".
    api.current.state.drawable.brushes.feedbackCorrecta = {
      key: 'feedback-correcta',
      color: 'var(--color-success)',
      opacity: 1,
      lineWidth: 8,
    };
    api.current.state.drawable.brushes.feedbackFallida = {
      key: 'feedback-fallida',
      color: 'var(--color-error)',
      opacity: 1,
      lineWidth: 6,
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
    // Al revelar un error el tablero rebobina hasta la posición en la que se
    // decidió: una flecha que sale de la casilla que la pieza ya dejó no
    // enseña nada. La jugada equivocada se sigue viendo, pero como flecha.
    const revision = props.feedback?.kind === 'error' ? props.feedback.revision ?? null : null;
    const fen = revision?.fen ?? props.fen;
    const lastMove = revision ? undefined : ((props.lastMove ?? undefined) as [Key, Key] | undefined);
    const errorSquare = props.feedback?.kind === 'error'
      ? kingSquareFromFen(fen, props.orientation) ?? (props.lastMove?.[1] as Key | undefined)
      : undefined;
    const customHighlights = new Map<Key, string>();
    if (errorSquare) customHighlights.set(errorSquare, 'feedback-error');

    api.current?.set({
      fen,
      orientation: toCgColor(props.orientation),
      turnColor: toCgColor(props.turn),
      check: revision ? revision.jaque : props.check,
      lastMove,
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
    // Una sola flecha limpia por jugada: el halo de contraste lo da un filtro
    // CSS (board.css), no una segunda flecha superpuesta —que dibujaba una
    // segunda punta y se veía mal (bug reportado)—.
    const successMove = props.feedback?.kind === 'success' ? props.feedback.move : null;
    if (successMove) {
      api.current?.setAutoShapes([{ orig: successMove[0] as Key, dest: successMove[1] as Key, brush: 'feedbackSuccess' }]);
    } else if (revision) {
      api.current?.setAutoShapes([
        ...(revision.jugada
          ? [{ orig: revision.jugada[0] as Key, dest: revision.jugada[1] as Key, brush: 'feedbackFallida' }]
          : []),
        { orig: revision.correcta[0] as Key, dest: revision.correcta[1] as Key, brush: 'feedbackCorrecta' },
      ]);
    } else {
      api.current?.setAutoShapes([]);
    }
  }, [props.fen, props.orientation, props.turn, props.check, props.lastMove, props.dests, props.movableColor, props.feedback]);

  // 40% de opacidad para piezas fantasma, design system §3.4/§6.5. El marco
  // externo reserva la franja de coordenadas (§3.2) sin que chessground la
  // confunda con espacio de tablero al medir.
  // `data-feedback-correcta` expone qué jugada señala la flecha verde de un
  // error: es lo que verifican los tests de punta a punta, que no pueden leer
  // el <svg> que dibuja chessground.
  return (
    <div className="board-frame">
      <div
        ref={el}
        data-blind-mode={props.blindMode ?? 'normal'}
        data-feedback={props.feedback?.kind ?? 'none'}
        data-feedback-move={props.feedback?.kind === 'success' && props.feedback.move
          ? `${props.feedback.move[0]}-${props.feedback.move[1]}`
          : undefined}
        data-feedback-correcta={props.feedback?.kind === 'error' && props.feedback.revision
          ? `${props.feedback.revision.correcta[0]}-${props.feedback.revision.correcta[1]}`
          : undefined}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        className="cg-wrap aspect-square w-full"
      />
    </div>
  );
}
