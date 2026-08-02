// Envoltorio React de chessground (design system §5, componente Board).
import { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { Color } from '../../core/types';
import type { RevisionDelError } from '../../core/revision';
import { COLORES_ANOTACION, alternarAnotacion, type Anotacion, type ColorAnotacion } from '../../core/anotaciones';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { usePunteroGrueso } from '../hooks/usePunteroGrueso';
import { t } from '../i18n/es';

export type BoardFeedback =
  | { kind: 'success'; move: [string, string] | null }
  /**
   * Error: el tablero vuelve a la posición en la que se decidió y muestra con
   * flechas lo que se jugó y lo que había que jugar (RF-5.3). Sin `revision`
   * —un bloque sin jugada correcta que mostrar, como el criterio de cálculo—
   * el tablero no marca nada y el fallo lo dice el panel.
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
  /**
   * Anotaciones del usuario: flechas y círculos para pensar sobre el tablero
   * (RF-5.10). Activadas por defecto — marcar es útil en cualquier ejercicio—;
   * se apagan solo donde el tablero es decorativo.
   */
  anotaciones?: boolean;
}

const toCgColor = (c: Color) => (c === 'w' ? 'white' : 'black');

export function Board(props: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(props.onMove);
  const reducedMotion = useReducedMotion();
  const initialReducedMotion = useRef(reducedMotion);
  const anotacionesActivas = props.anotaciones !== false;
  const punteroGrueso = usePunteroGrueso();
  // Modo dibujo del camino táctil. Solo existe con el dedo: con mouse el botón
  // derecho ya alcanza y un botón de más sería ruido en la pantalla. No hace
  // falta apagarlo cuando dejan de darse esas condiciones — `dibujando` las
  // exige todas, y los controles ni se montan—, así que no hay efecto que lo
  // resetee.
  const [modoDibujo, setModoDibujo] = useState(false);
  const [colorAnotacion, setColorAnotacion] = useState<ColorAnotacion>('green');
  const origenTactil = useRef<Key | null>(null);
  const fenPrevio = useRef(props.fen);
  const dibujando = anotacionesActivas && punteroGrueso && modoDibujo;

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
      // Botón derecho (y shift+arrastrar) para dibujar flechas y círculos, como
      // en Lichess y chess.com: es el gesto que ya tiene en los dedos cualquiera
      // que haya analizado en una pantalla. chessground lo trae resuelto,
      // incluido suprimir el menú contextual del navegador. El camino táctil no
      // lo cubre —solo escucha el mouse— y se agrega abajo.
      drawable: { enabled: true, visible: true },
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
    api.current?.set({ drawable: { enabled: anotacionesActivas } });
  }, [anotacionesActivas]);

  useEffect(() => {
    // Al revelar un error el tablero rebobina hasta la posición en la que se
    // decidió: una flecha que sale de la casilla que la pieza ya dejó no
    // enseña nada. La jugada equivocada se sigue viendo, pero como flecha.
    const revision = props.feedback?.kind === 'error' ? props.feedback.revision ?? null : null;
    const fen = revision?.fen ?? props.fen;
    const lastMove = revision ? undefined : ((props.lastMove ?? undefined) as [Key, Key] | undefined);

    // El fallo no pinta ninguna casilla: el error no tiene casilla propia, y el
    // velo rojo que se usaba (bajo el rey del lado que resolvía) era el mismo
    // rojo que el aro de jaque y sobre la misma casilla, así que se leía como
    // un jaque inexistente. Lo que se jugó y lo que había que jugar ya lo dicen
    // las dos flechas; el resto lo dice el panel (RF-5.3, RNF-6).
    api.current?.set({
      fen,
      orientation: toCgColor(props.orientation),
      turnColor: toCgColor(props.turn),
      check: revision ? revision.jaque : props.check,
      lastMove,
      movable: {
        free: false,
        color: props.movableColor ? toCgColor(props.movableColor) : undefined,
        dests: props.dests as Map<Key, Key[]>,
        showDests: true,
      },
      // En modo dibujo el dedo dibuja en vez de mover: si no, cada trazo
      // arrastraría la pieza de la casilla de origen. Con mouse esto nunca se
      // apaga, porque dibujar va por el botón derecho y mover por el izquierdo.
      draggable: { enabled: !dibujando },
      selectable: { enabled: !dibujando }, // toque-toque (RF-1.1)
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

    // Las marcas del usuario valen para **esta** posición: arrastrarlas a la
    // siguiente dejaría flechas que ya no significan nada sobre un tablero
    // distinto. Se limpian cuando cambia la posición, no en cada render, para
    // que revelar el feedback no borre lo que el usuario dibujó mientras
    // pensaba —que es justo cuando quiere compararlo con la respuesta—.
    if (fenPrevio.current !== props.fen) {
      fenPrevio.current = props.fen;
      api.current?.setShapes([]);
    }
  }, [props.fen, props.orientation, props.turn, props.check, props.lastMove, props.dests, props.movableColor, props.feedback, dibujando]);

  /** Casilla bajo el dedo, o null si el toque cayó fuera del tablero. */
  function casillaEn(e: React.PointerEvent): Key | null {
    return api.current?.getKeyAtDomPos([e.clientX, e.clientY]) ?? null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!dibujando) return;
    origenTactil.current = casillaEn(e);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dibujando || !api.current) return;
    const orig = origenTactil.current;
    origenTactil.current = null;
    if (!orig) return;
    const destino = casillaEn(e);
    if (!destino) return;
    // Mismo origen y destino: es un círculo sobre la casilla. Distinto: flecha.
    const nueva: Anotacion = destino === orig
      ? { orig, brush: colorAnotacion }
      : { orig, dest: destino, brush: colorAnotacion };
    // La fuente de verdad son las marcas que ya tiene chessground, para que el
    // camino táctil y el del botón derecho se pisen bien entre sí.
    const previas = api.current.state.drawable.shapes as Anotacion[];
    api.current.setShapes(alternarAnotacion(previas, nueva) as never);
  }

  function borrarAnotaciones() {
    api.current?.setShapes([]);
  }

  // 40% de opacidad para piezas fantasma, design system §3.4/§6.5. El marco
  // externo reserva la franja de coordenadas (§3.2) sin que chessground la
  // confunda con espacio de tablero al medir.
  // `data-feedback-correcta` expone qué jugada señala la flecha verde de un
  // error: es lo que verifican los tests de punta a punta, que no pueden leer
  // el <svg> que dibuja chessground.
  return (
    <div className="board-frame">
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { origenTactil.current = null; }}
        // En modo dibujo el navegador no debe interpretar el arrastre como
        // scroll de la página: sin esto, el trazo mueve la pantalla.
        style={dibujando ? { touchAction: 'none' } : undefined}
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
      {anotacionesActivas && punteroGrueso && (
        <ControlesAnotacion
          activo={modoDibujo}
          color={colorAnotacion}
          onToggle={() => setModoDibujo((v) => !v)}
          onColor={setColorAnotacion}
          onBorrar={borrarAnotaciones}
        />
      )}
    </div>
  );
}

/**
 * Controles del camino táctil (RF-5.10). chessground dibuja con el botón
 * derecho, que en una pantalla táctil no existe: los reemplazos habituales
 * —mantener apretado, dos dedos— compiten con el arrastre de piezas y con el
 * scroll de la página, y fallan de maneras que el usuario no puede diagnosticar.
 * Un interruptor explícito es más aburrido y siempre funciona.
 *
 * El selector de color aparece solo con el modo activo, y existe porque sin
 * teclado no hay modificadores: sin él, en el celular todas las marcas serían
 * verdes, que es perder la mitad de para qué sirven —distinguir tu plan de la
 * respuesta del rival—.
 */
function ControlesAnotacion(props: {
  activo: boolean;
  color: ColorAnotacion;
  onToggle: () => void;
  onColor: (c: ColorAnotacion) => void;
  onBorrar: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={props.onToggle}
        aria-pressed={props.activo}
        className={props.activo ? 'btn-primary min-h-11 px-3 text-sm' : 'btn-secondary min-h-11 px-3 text-sm'}
      >
        {props.activo ? t.tablero.dibujarActivo : t.tablero.dibujar}
      </button>

      {props.activo && (
        <>
          <fieldset className="m-0 flex items-center gap-1.5 border-0 p-0">
            <legend className="sr-only">{t.tablero.colorAnotacion}</legend>
            {COLORES_ANOTACION.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => props.onColor(color)}
                aria-pressed={props.color === color}
                aria-label={t.tablero.colores[color]}
                title={t.tablero.colores[color]}
                className={`size-9 rounded-full border-2 ${
                  props.color === color ? 'border-primary' : 'border-transparent'
                }`}
                style={{ backgroundColor: `var(--anotacion-${color})` }}
              />
            ))}
          </fieldset>
          <button type="button" onClick={props.onBorrar} className="btn-secondary min-h-11 px-3 text-sm">
            {t.tablero.borrarAnotaciones}
          </button>
        </>
      )}
    </div>
  );
}
