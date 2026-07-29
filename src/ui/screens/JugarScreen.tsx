// Pantalla Jugar: partida local contra el motor (RF-1.1, RF-1.2, RF-1.3).
import { useEffect, useState } from 'react';
import type { Square } from 'chess.js';
import { Board } from '../components/Board';
import { Chip } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { PromotionDialog } from '../components/PromotionDialog';
import { ENGINE_LEVELS, useGameStore } from '../state/gameStore';
import { useFinalesStore } from '../state/finalesStore';
import { useConversionStore } from '../state/conversionStore';
import { useMaiaStore } from '../state/maiaStore';
import { BOTS_MAIA, botParaBanda } from '../../core/maia';
import { readLichessToken } from '../lichessToken';
import { useSessionStore } from '../state/sessionStore';
import { useDiagnosticoStore } from '../state/diagnosticoStore';
import type { Color, CurriculumItem, CurriculumProgress } from '../../core/types';
import { isAutomatizado } from '../../core/curriculum';
import { FINAL_DRAW_HOLD_MOVES, objetivoDeFinal } from '../../core/finales';
import { isDue } from '../../core/scheduler';
import { formatDecimal } from '../format';
import { t } from '../i18n/es';

// La sub-ruta #/jugar/finales entra directo al modo finales (deep-link desde
// Hoy), y elegir un modo actualiza el hash para que el botón "atrás" funcione.
type ModoJugar = 'partida' | 'maia' | 'finales' | 'conversion';

function modoDesdeHash(): ModoJugar {
  if (window.location.hash.includes('/finales')) return 'finales';
  if (window.location.hash.includes('/conversion')) return 'conversion';
  if (window.location.hash.includes('/maia')) return 'maia';
  return 'partida';
}

const RUTA_POR_MODO: Record<ModoJugar, string> = {
  partida: '#/jugar',
  maia: '#/jugar/maia',
  finales: '#/jugar/finales',
  conversion: '#/jugar/conversion',
};

function ModoPicker({ modo }: { modo: ModoJugar }) {
  return (
    <SegmentedControl
      label={t.finales.modosLabel}
      value={modo}
      options={[
        { value: 'partida', label: t.finales.modoPartida },
        { value: 'maia', label: t.maia.modo },
        { value: 'finales', label: t.finales.modoFinales },
        { value: 'conversion', label: t.conversion.modo },
      ]}
      onChange={(value) => {
        const destino = RUTA_POR_MODO[value as ModoJugar];
        if (window.location.hash !== destino) {
          window.history.pushState(null, '', destino);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }}
    />
  );
}

export function JugarScreen() {
  const diagnosticoPhase = useDiagnosticoStore((state) => state.phase);
  const [modo, setModo] = useState<ModoJugar>(modoDesdeHash);

  useEffect(() => {
    const onNavigate = () => setModo(modoDesdeHash());
    window.addEventListener('hashchange', onNavigate);
    window.addEventListener('popstate', onNavigate);
    return () => {
      window.removeEventListener('hashchange', onNavigate);
      window.removeEventListener('popstate', onNavigate);
    };
  }, []);

  if (diagnosticoPhase !== 'inactivo' && diagnosticoPhase !== 'resultado') return <DiagnosticoEnCurso />;
  if (modo === 'maia') return <MaiaScreen />;
  if (modo === 'finales') return <FinalesScreen />;
  if (modo === 'conversion') return <ConversionScreen />;
  return <PartidaScreen />;
}

function DiagnosticoEnCurso() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="m-0 font-display text-3xl font-medium">{t.jugar.titulo}</h1>
      <section className="flex flex-col gap-3 rounded-lg border border-accent/45 bg-surface p-5">
        <p className="m-0 font-display text-xl font-medium">{t.jugar.diagnosticoEnCursoTitulo}</p>
        <p className="m-0 text-sm text-secondary">{t.jugar.diagnosticoEnCursoTexto}</p>
        <a href="#/hoy" className="btn-primary text-center no-underline">{t.jugar.volverDiagnostico}</a>
      </section>
    </div>
  );
}

function PartidaScreen() {
  const s = useGameStore();

  if (s.phase === 'setup' || s.phase === 'loading') return <Setup />;

  const statusText =
    s.phase === 'ended'
      ? resultText(s)
      : s.thinking
        ? t.jugar.pensando
        : `${t.jugar.teToca}${s.check ? ` — ${t.jugar.jaque}` : ''}`;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-start">
      {/* El tablero manda (§1): elemento dominante, mínimo 320 px */}
      <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={s.fen}
          orientation={s.playerColor}
          turn={s.turn}
          lastMove={s.lastMove}
          check={s.check}
          dests={s.dests}
          movableColor={s.phase === 'playing' && !s.thinking ? s.playerColor : null}
          onMove={(from, to) => void s.userMove(from as Square, to as Square)}
        />
        {s.pendingPromotion && (
          <PromotionDialog
            color={s.playerColor}
            onPick={(p) => void s.userMove(s.pendingPromotion!.from, s.pendingPromotion!.to, p)}
            onCancel={() => s.cancelPromotion()}
          />
        )}
      </div>

      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-display text-xl">{statusText}</p>
          {s.phase === 'ended' && s.saved && (
            <p className="mt-1 mb-0 text-sm text-success">{t.jugar.partidaGuardada}</p>
          )}
        </div>

        {/* Fallo del motor durante la partida: antes solo se veía en la pantalla
            de configuración, así que en juego el usuario quedaba sin turno del
            motor y sin explicación. */}
        {s.engineError && s.phase === 'playing' && (
          <div className="flex flex-col gap-2 rounded-lg border border-error/35 bg-error-subtle p-3">
            <p className="m-0 text-sm text-primary">{t.jugar.errorMotorEnJuego}</p>
            <button onClick={() => s.reset()} className="btn-secondary">
              {t.jugar.nuevaPartida}
            </button>
          </div>
        )}

        <MoveList moves={s.sanMoves} />

        {s.phase === 'playing' && !s.engineError && (
          <>
            <ResignButton />
            {/* Rendirse guarda una derrota real, así que no puede ser la única
                forma de salir: entrar a probar el motor y arrepentirse dejaba
                una derrota en el historial y —al ser una partida sin reloj—
                daba por cumplido el compromiso semanal de partida lenta.
                Abandonar descarta la partida sin guardarla. */}
            <AbandonButton />
          </>
        )}
        {s.phase === 'ended' && (
          <button onClick={() => s.reset()} className="btn-primary">
            {t.jugar.nuevaPartida}
          </button>
        )}
      </aside>
    </div>
  );
}

function resultText(s: ReturnType<typeof useGameStore.getState>): string {
  const r = t.jugar.resultado;
  const motivo =
    s.endReason === 'mate'
      ? r.porMate
      : s.endReason === 'abandono'
        ? r.porAbandono
        : s.endReason === 'ahogado'
          ? r.porAhogado
          : r.porRegla;
  if (s.resultado === '1/2-1/2') return `${r.tablas} ${motivo}`;
  const playerWon = (s.resultado === '1-0' && s.playerColor === 'w') || (s.resultado === '0-1' && s.playerColor === 'b');
  return `${playerWon ? r.ganaste : r.perdiste} ${motivo}`;
}

function MoveList({ moves }: { moves: string[] }) {
  const rows: Array<[number, string, string | undefined]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push([i / 2 + 1, moves[i], moves[i + 1]]);
  }
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-subtle bg-surface p-3 font-mono text-sm sm:max-h-80">
      <p className="m-0 mb-1 text-xs tracking-wider text-tertiary uppercase">{t.jugar.jugadas}</p>
      {rows.length === 0 ? (
        <span className="text-tertiary">—</span>
      ) : (
        <ol className="m-0 list-none columns-2 p-0">
          {rows.map(([n, w, b]) => (
            <li key={n} className="text-secondary">
              <span className="text-tertiary">{n}.</span> {w} {b ?? ''}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResignButton() {
  const resign = useGameStore((st) => st.resign);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-secondary">
        {t.jugar.rendirse}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-3">
      <p className="m-0 text-sm">{t.jugar.confirmarRendirse}</p>
      <div className="flex gap-2">
        <button onClick={() => void resign()} className="btn-danger flex-1">
          {t.jugar.confirmarSi}
        </button>
        <button onClick={() => setConfirming(false)} className="btn-secondary flex-1">
          {t.jugar.confirmarNo}
        </button>
      </div>
    </div>
  );
}

function AbandonButton() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-secondary">
        {t.jugar.abandonar}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface p-3">
      <p className="m-0 text-sm">{t.jugar.confirmarAbandonar}</p>
      <div className="flex gap-2">
        <button onClick={() => useGameStore.getState().reset()} className="btn-danger flex-1">
          {t.jugar.confirmarSi}
        </button>
        <button onClick={() => setConfirming(false)} className="btn-secondary flex-1">
          {t.jugar.confirmarNo}
        </button>
      </div>
    </div>
  );
}

function Setup() {
  const s = useGameStore();
  const [levelId, setLevelId] = useState(ENGINE_LEVELS[0].id);
  const [color, setColor] = useState<Color | 'random'>('w');

  // El título encabeza la pantalla y recién después viene el selector de modo,
  // igual que en el Panel: al revés, las pestañas aparecían sobre el <h1> y
  // cada pantalla ordenaba su encabezado distinto.
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <header>
        <h1 className="m-0 font-display text-3xl font-medium">{t.jugar.titulo}</h1>
        <p className="mt-1 mb-0 text-secondary">{t.jugar.subtitulo}</p>
      </header>

      <ModoPicker modo="partida" />
      <div>
        <section className="flex flex-col gap-4">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 p-0 text-sm text-secondary">{t.jugar.nivel}</legend>
            <div className="flex flex-col gap-2">
              {ENGINE_LEVELS.map((l) => (
                <Chip key={l.id} selected={levelId === l.id} onClick={() => setLevelId(l.id)}>
                  {t.jugar.niveles[l.id] ?? l.id}
                  {l.eloAproximado !== undefined && (
                    <span className="ml-2 font-mono text-xs text-tertiary">
                      {t.jugar.nivelElo.replace('{elo}', String(l.eloAproximado))}
                    </span>
                  )}
                </Chip>
              ))}
            </div>
            <p className="m-0 mt-2 text-xs text-tertiary">{t.jugar.nivelesAyuda}</p>
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 p-0 text-sm text-secondary">{t.jugar.color}</legend>
            <div className="flex gap-2">
              <Chip selected={color === 'w'} onClick={() => setColor('w')}>{t.jugar.blancas}</Chip>
              <Chip selected={color === 'b'} onClick={() => setColor('b')}>{t.jugar.negras}</Chip>
              <Chip selected={color === 'random'} onClick={() => setColor('random')}>{t.jugar.aleatorio}</Chip>
            </div>
          </fieldset>

          {s.engineError && (
            <p className="m-0 rounded-md border border-error/35 bg-error-subtle p-3 text-sm text-primary">
              {t.jugar.errorMotor}
            </p>
          )}

          <button
            onClick={() => void s.start(levelId, color)}
            disabled={s.phase === 'loading'}
            className="btn-primary"
          >
            {s.phase === 'loading' ? t.jugar.cargandoMotor : t.jugar.empezar}
          </button>

          {/* La tarjeta "Configuración elegida" que iba acá repetía el nivel y
              el color que ya se ven seleccionados unos centímetros más arriba.
              Se conserva solo la nota sobre el motor, que sí agrega algo. */}
          <p className="m-0 text-sm text-tertiary">{t.jugar.notaMotor}</p>
        </section>
      </div>
    </div>
  );
}

/** Qué se le pide al usuario en este final, en los mismos términos con los que
 * `core/finales.ts` juzga la demostración. */
function objetivoTexto(item: CurriculumItem): string {
  if (item.resultadoEsperado !== 'gana') return t.finales.objetivoTablas;
  return objetivoDeFinal(item) === 'mate' ? t.finales.objetivoMate : t.finales.objetivoCoronar;
}

/**
 * Una técnica de final en la lista. Los tres estados posibles son distintos y
 * conviene que se vean distintos: vencida (la que toca hoy y suma a la racha),
 * programada (ya demostrada; se puede repetir, pero como práctica que no
 * acumula) y automatizada (RF-6.3: tres demostraciones limpias espaciadas, deja
 * de aparecer).
 */
function FinalRow({ item, progress }: { item: CurriculumItem; progress: CurriculumProgress | undefined }) {
  const automatizado = progress !== undefined && isAutomatizado(progress);
  const vencido = !automatizado && (progress === undefined || isDue(progress.fsrs));
  const proxima = progress ? new Date(progress.fsrs.due) : null;

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface p-3">
      <div className="min-w-0">
        <p className="m-0 text-primary">{item.nombre}</p>
        <p className="m-0 mt-1 text-xs text-tertiary">
          {automatizado
            ? t.finales.automatizado
            : vencido
              ? t.finales.progreso.replace('{n}', String(progress?.demostracionesLimpias ?? 0))
              : t.finales.programado
                  .replace('{n}', String(progress?.demostracionesLimpias ?? 0))
                  .replace('{fecha}', proxima ? proxima.toLocaleDateString('es-AR') : '')}
        </p>
      </div>
      {vencido ? (
        <button className="btn-secondary shrink-0" onClick={() => void useFinalesStore.getState().start(item.id)}>
          {t.finales.empezar}
        </button>
      ) : (
        <button
          className="min-h-11 shrink-0 px-2 text-sm font-semibold text-secondary underline-offset-4 hover:text-primary hover:underline"
          onClick={() => void useFinalesStore.getState().start(item.id, true)}
        >
          {t.finales.practicar}
        </button>
      )}
    </li>
  );
}

function FinalesScreen() {
  const s = useFinalesStore();
  const itemCount = s.items.length;
  const load = s.load;

  useEffect(() => {
    if (itemCount === 0) void load();
  }, [itemCount, load]);

  if (s.phase === 'lista' || s.phase === 'cargando') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header>
          <h1 className="m-0 font-display text-3xl font-medium">{t.finales.titulo}</h1>
          <p className="mt-1 mb-0 text-secondary">{t.finales.subtitulo}</p>
        </header>

        <ModoPicker modo="finales" />
        {s.engineError && (
          <div className="flex flex-col gap-2 rounded-md border border-error/35 bg-error-subtle p-3">
            <p className="m-0 text-sm">{t.finales.errorMotor}</p>
            <button className="btn-secondary" onClick={() => s.volver()}>{t.finales.volver}</button>
          </div>
        )}
        {s.phase === 'cargando' ? (
          <p className="m-0 text-secondary">{t.finales.cargando}</p>
        ) : (
          <>
            <p className="m-0 text-sm text-secondary">{t.finales.espaciadoAyuda}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {s.items.map((item) => (
                <FinalRow key={item.id} item={item} progress={s.progressById.get(item.id)} />
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  const item = s.item!;
  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={s.fen}
          orientation={s.playerColor}
          turn={s.turn}
          lastMove={s.lastMove}
          check={s.check}
          dests={s.dests}
          movableColor={s.phase === 'jugando' && !s.thinking && s.turn === s.playerColor ? s.playerColor : null}
          onMove={(from, to) => void s.userMove(from as Square, to as Square)}
          feedback={
            s.phase === 'feedback' && s.limpia === false
              ? { kind: 'error', move: null, revision: s.revision }
              : null
          }
        />
        {s.pendingPromotion && (
          <PromotionDialog
            color={s.playerColor}
            onPick={(piece) => void s.userMove(s.pendingPromotion!.from, s.pendingPromotion!.to, piece)}
            onCancel={() => s.cancelPromotion()}
          />
        )}
      </div>
      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-display text-xl">{item.nombre}</p>
          {/* El objetivo se dice tal como se juzga (RF-6.2): en un mate
              elemental hay que dar el mate, y en uno de peón hay que coronar
              sin tirar la ventaja. Antes decía "coronar o ganar" para todos, y
              la app cerraba el ejercicio con otro criterio. */}
          <p className="m-0 mt-2 text-sm text-secondary">{objetivoTexto(item)}</p>
          {/* Cuánto falta de la defensa: sostener doce jugadas propias es el
              criterio real, y sin contador no había forma de saber dónde
              estabas parado. */}
          {item.resultadoEsperado === 'tablas' && s.phase === 'jugando' && (
            <p className="m-0 mt-2 font-mono text-xs text-tertiary">
              {t.finales.sostenidas
                .replace('{n}', String(Math.min(s.userMoves, FINAL_DRAW_HOLD_MOVES)))
                .replace('{total}', String(FINAL_DRAW_HOLD_MOVES))}
            </p>
          )}
        </div>
        {s.engineError && (
          <div className="flex flex-col gap-2 rounded-md border border-error/35 bg-error-subtle p-3">
            <p className="m-0 text-sm">{t.finales.errorMotor}</p>
            <button className="btn-secondary" onClick={() => s.volver()}>{t.finales.volver}</button>
          </div>
        )}
        {s.phase === 'jugando' && (
          <>
            <p className="m-0 text-secondary">{s.thinking ? t.finales.pensando : t.finales.teToca}</p>
            {/* Antes no había ninguna salida hasta terminar la técnica: entrar
                a un final era quedar atrapado. Dejarlo a mitad no cuenta como
                demostración fallida —no se llama a finish()—, así que no
                rompe la racha hacia la automatización (RF-6.3). */}
            <button className="btn-secondary" onClick={() => s.volver()}>{t.finales.dejar}</button>
          </>
        )}
        {s.phase === 'feedback' && (
          <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-surface p-4">
            <h2 className="m-0 font-display text-2xl">{s.limpia ? t.finales.demostrado : t.finales.perdido}</h2>
            <p className="m-0 text-secondary">
              {s.practica
                ? s.limpia ? t.finales.demostradoPractica : t.finales.perdidoPractica
                : s.limpia ? t.finales.demostradoTexto : t.finales.perdidoTexto}
            </p>
            {/* El punto crítico, dicho y mostrado: el tablero vuelve a esa
                posición con la flecha de lo que el motor prefería. */}
            {s.jugadaCorrecta && (
              <p className="m-0 font-mono text-xs text-secondary">
                {t.radar.jugadaCorrecta}: {s.jugadaCorrecta}
              </p>
            )}
            <button className="btn-primary" onClick={() => s.volver()}>{t.finales.volver}</button>
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * Conversión de ventajas (E8, RF-8.1/8.3). El material sale del análisis de las
 * partidas propias, que la app ya produce: no dependía de la red, y la épica
 * figuraba bloqueada porque RF-8.1 pide Maia como defensor. RF-8.3 autoriza el
 * motor local siempre que la limitación se diga, y acá se dice.
 */
function ConversionScreen() {
  const s = useConversionStore();
  const cargar = s.cargar;

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (s.phase === 'lista' || s.phase === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header>
          <h1 className="m-0 font-display text-3xl font-medium">{t.conversion.titulo}</h1>
          <p className="mt-1 mb-0 text-secondary">{t.conversion.subtitulo}</p>
        </header>

        <ModoPicker modo="conversion" />

        <p className="m-0 rounded-lg border border-info/40 bg-surface p-3 text-sm text-secondary">{t.conversion.porQue}</p>
        <p className="m-0 text-xs text-tertiary">{t.conversion.limitacion}</p>

        {s.phase === 'error' && (
          <div role="alert" className="rounded-md border border-error/35 bg-error-subtle p-3 text-sm">{t.conversion.errorMotor}</div>
        )}

        {s.ventajas.length === 0 ? (
          <p className="m-0 rounded-lg border border-subtle bg-surface p-4 text-secondary">{t.conversion.sinVentajas}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {s.ventajas.map((ventaja) => (
              <li key={ventaja.gameId} className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-surface p-3">
                <div className="min-w-0">
                  <p className="m-0 text-primary tabular-nums">
                    {t.conversion.listaVentaja
                      .replace('{ventaja}', formatDecimal(ventaja.ventajaCp / 100, 1))
                      .replace('{jugada}', String(Math.floor(ventaja.ply / 2) + 1))}
                  </p>
                  <p className="m-0 mt-1 text-xs text-tertiary">
                    {t.conversion.listaResultado.replace('{resultado}', ventaja.resultado)}
                    {' · '}
                    {new Date(ventaja.fecha).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <button className="btn-secondary shrink-0" onClick={() => void s.empezar(ventaja.gameId)}>
                  {t.conversion.empezar}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (s.phase === 'cargando') return <p className="m-0 text-secondary">{t.conversion.cargando}</p>;

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={s.fen}
          orientation={s.playerColor}
          turn={s.turn}
          lastMove={s.lastMove}
          check={s.check}
          dests={s.dests}
          movableColor={s.phase === 'jugando' && !s.thinking && s.turn === s.playerColor ? s.playerColor : null}
          onMove={(from, to) => void s.userMove(from as Square, to as Square)}
        />
        {s.pendingPromotion && (
          <PromotionDialog
            color={s.playerColor}
            onPick={(piece) => void s.userMove(s.pendingPromotion!.from, s.pendingPromotion!.to, piece)}
            onCancel={() => s.cancelPromotion()}
          />
        )}
      </div>
      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-display text-xl">{t.conversion.titulo}</p>
          {s.ventaja && (
            <p className="m-0 mt-2 text-sm text-secondary tabular-nums">
              {t.conversion.listaVentaja
                .replace('{ventaja}', formatDecimal(s.ventaja.ventajaCp / 100, 1))
                .replace('{jugada}', String(Math.floor(s.ventaja.ply / 2) + 1))}
            </p>
          )}
        </div>
        {s.engineError && (
          <div role="alert" className="flex flex-col gap-2 rounded-md border border-error/35 bg-error-subtle p-3">
            <p className="m-0 text-sm">{t.conversion.errorMotor}</p>
            <button className="btn-secondary" onClick={() => s.volver()}>{t.conversion.volver}</button>
          </div>
        )}
        {s.phase === 'jugando' && !s.engineError && (
          <>
            <p className="m-0 text-secondary">{s.thinking ? t.conversion.pensando : t.conversion.teToca}</p>
            <button className="btn-secondary" onClick={() => s.volver()}>{t.conversion.dejar}</button>
          </>
        )}
        {s.phase === 'feedback' && (
          <div
            className={`flex flex-col gap-3 rounded-lg border p-4 ${
              s.resultado === 'convertida' ? 'border-success/35 bg-success-subtle' : 'border-error/35 bg-error-subtle'
            }`}
          >
            <h2 className="m-0 font-display text-2xl">
              {s.resultado === 'convertida' ? t.conversion.convertida : t.conversion.perdida}
            </h2>
            <p className="m-0 text-secondary">
              {s.resultado === 'convertida' ? t.conversion.convertidaTexto : t.conversion.perdidaTexto}
            </p>
            <p className="m-0 text-xs text-tertiary">{t.conversion.limitacion}</p>
            <button className="btn-primary" onClick={() => s.volver()}>{t.conversion.volver}</button>
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * Partida contra un bot Maia (RF-1.4, ADR-0004). Es el rival que el PRD quiere
 * para el ciclo jugar → analizar: sus errores son humano-plausibles, a
 * diferencia de Stockfish capado, que juega perfecto y de golpe regala.
 *
 * Todo lo que puede salir mal acá depende de un servidor ajeno, así que los
 * estados de fallo se nombran uno por uno: "no se pudo" a secas dejaría al
 * usuario sin saber si el problema es su token, el bot o su conexión. Y que un
 * bot esté ocupado es un desenlace normal, no un error de la app — por eso la
 * salida siempre ofrece el motor local, cuyos niveles ahora están medidos.
 */
function MaiaScreen() {
  const s = useMaiaStore();
  const banda = useSessionStore((state) => state.profile.bandaElo);
  const sugerido = botParaBanda(banda);
  const [bot, setBot] = useState(sugerido.usuario);
  // Lectura sincrónica de localStorage: no necesita efecto.
  const [token] = useState<string | null>(() => readLichessToken());

  const encabezado = (
    <header>
      <h1 className="m-0 font-display text-3xl font-medium">{t.maia.titulo}</h1>
      <p className="mt-1 mb-0 text-secondary">{t.maia.subtitulo}</p>
    </header>
  );

  if (s.phase === 'inactivo' || s.phase === 'error') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {encabezado}
        <ModoPicker modo="maia" />
        <p className="m-0 rounded-lg border border-info/40 bg-surface p-3 text-sm text-secondary">{t.maia.porQue}</p>
        {/* La incoherencia con el juego sin reloj (E9) es de la plataforma, y se
            declara siempre: describe qué es este modo, no el desafío puntual. */}
        <p className="m-0 text-xs text-tertiary">{t.maia.reloj}</p>

        {s.phase === 'error' && s.fallo && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-error/35 bg-error-subtle p-4">
            <p className="m-0 text-sm text-primary">{t.maia.fallos[s.fallo]}</p>
            <p className="m-0 text-xs text-secondary">{t.maia.caidaTexto}</p>
            <a href="#/jugar" className="btn-secondary text-center no-underline">{t.maia.caidaIr}</a>
          </div>
        )}

        {token === null ? (
          <section className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
            <p className="m-0 text-sm text-primary">{t.maia.tokenFalta}</p>
            <a href="#/ajustes" className="btn-primary text-center no-underline">{t.maia.tokenIr}</a>
          </section>
        ) : (
          <>
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm text-secondary">{t.maia.elegirBot}</legend>
              <div className="flex flex-col gap-2">
                {BOTS_MAIA.map((candidato) => (
                  <Chip key={candidato.usuario} selected={bot === candidato.usuario} onClick={() => setBot(candidato.usuario)}>
                    {candidato.usuario}
                    <span className="ml-2 font-mono text-xs text-tertiary">
                      {t.maia.botElo.replace('{elo}', String(candidato.elo))}
                    </span>
                    {candidato.usuario === sugerido.usuario && (
                      <span className="ml-2 text-xs text-accent">{t.maia.sugerido}</span>
                    )}
                  </Chip>
                ))}
              </div>
              {/* Maia 1100 es el modelo más flojo que el proyecto Maia entrenó:
                  no hay una perilla para bajarlo. Decirlo, y señalar dónde SÍ
                  hay algo más fácil, es más útil que dejar al usuario buscando
                  una opción que no existe. */}
              <p className="m-0 mt-2 text-xs text-tertiary">{t.maia.botPiso}</p>
            </fieldset>
            <button onClick={() => void s.empezar(token, bot)} className="btn-primary">
              {t.maia.empezar.replace('{bot}', bot)}
            </button>
          </>
        )}
      </div>
    );
  }

  if (s.phase === 'desafiando') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 text-center">
        {encabezado}
        <p className="m-0 font-display text-xl">{t.maia.desafiando.replace('{bot}', s.bot)}</p>
        <p className="m-0 text-sm text-secondary">{t.maia.desafiandoDetalle}</p>
        <button onClick={() => s.volver()} className="btn-secondary">{t.maia.cancelar}</button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-start">
      <div className="board-stage relative mx-auto w-full min-w-[320px] max-w-[640px] sm:mx-0 sm:w-[60%]">
        <Board
          fen={s.fen}
          orientation={s.playerColor}
          turn={s.turn}
          lastMove={s.lastMove}
          check={s.check}
          dests={s.dests}
          movableColor={s.phase === 'jugando' && !s.enviando && s.turn === s.playerColor ? s.playerColor : null}
          onMove={(from, to) => void s.userMove(from as Square, to as Square)}
        />
      </div>
      <aside className="flex w-full flex-col gap-3 sm:w-[40%] sm:max-w-xs">
        <div className="rounded-lg border border-subtle bg-surface p-4">
          <p className="m-0 font-display text-xl">
            {s.phase === 'terminada'
              ? t.maia.terminada
              : s.enviando
                ? t.maia.enviando
                : s.turn === s.playerColor
                  ? t.maia.teToca
                  : t.maia.esperando.replace('{rival}', s.rival || s.bot)}
          </p>
        </div>

        <MoveList moves={s.sanMoves} />

        {s.phase === 'jugando' && (
          <button onClick={() => void s.abandonar(readLichessToken() ?? '')} className="btn-secondary">
            {t.maia.abandonar}
          </button>
        )}

        {s.phase === 'terminada' && (
          <div className={`flex flex-col gap-3 rounded-lg border p-4 ${s.guardada ? 'border-success/35 bg-success-subtle' : 'border-info/40 bg-surface'}`}>
            <p className="m-0 text-sm text-primary">{s.guardada ? t.maia.guardada : t.maia.noGuardada}</p>
            {s.guardada && (
              <a href="#/panel/partidas" className="btn-primary text-center no-underline">{t.maia.analizar}</a>
            )}
            <button onClick={() => s.volver()} className="btn-secondary">{t.maia.volver}</button>
          </div>
        )}
      </aside>
    </div>
  );
}
