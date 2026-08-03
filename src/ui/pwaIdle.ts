// Cuándo se puede recargar la app sin robarle trabajo al usuario.
//
// El estado de una actividad vive en memoria (los stores no se persisten a
// mitad de camino), así que recargar durante una partida, un final, un análisis
// o un bloque de la sesión pierde lo que se estaba haciendo. Este módulo define
// "ocioso" como la conjunción de todas las actividades largas detenidas, y le
// avisa a `pwaUpdate` cada vez que alguna cambia de estado.
//
// El criterio es conservador a propósito: ante la duda, ocupado. Postergar una
// actualización no le cuesta nada al usuario —entra al cerrar y volver a
// abrir—; interrumpirlo a mitad de una sesión sí.
import { useSessionStore } from './state/sessionStore';
import { useDiagnosticoStore } from './state/diagnosticoStore';
import { useGameStore } from './state/gameStore';
import { useFinalesStore } from './state/finalesStore';
import { useAnalysisStore } from './state/analysisStore';
import { useMaiaStore } from './state/maiaStore';
import { useStoykoStore } from './state/stoykoStore';
import { useConversionStore } from './state/conversionStore';
import { useTransferStore } from './state/transferStore';
import { aplicarActualizacionPendiente, registrarActualizacionDiferida } from './pwaUpdate';

/** Fases en las que cada store NO tiene trabajo del usuario en el aire. */
function estaOcioso(): boolean {
  const sesion = useSessionStore.getState().phase;
  if (sesion !== 'sinEmpezar' && sesion !== 'fin') return false;
  if (useDiagnosticoStore.getState().phase !== 'inactivo') return false;
  const partida = useGameStore.getState().phase;
  if (partida !== 'setup' && partida !== 'ended') return false;
  if (useFinalesStore.getState().phase === 'jugando') return false;
  if (useConversionStore.getState().phase === 'jugando') return false;
  if (useAnalysisStore.getState().phase !== 'inactivo') return false;
  const maia = useMaiaStore.getState().phase;
  if (maia === 'desafiando' || maia === 'jugando') return false;
  const calculo = useStoykoStore.getState().phase;
  if (calculo === 'analizando' || calculo === 'confianza') return false;
  if (useTransferStore.getState().phase === 'jugando') return false;
  return true;
}

/**
 * Registra el service worker y aplica la versión nueva en cuanto la app queda
 * ociosa. Se llama una vez, al arrancar (main.tsx).
 */
export function observarOcioParaActualizar(): void {
  registrarActualizacionDiferida(estaOcioso);

  const revisar = (): void => {
    if (estaOcioso()) aplicarActualizacionPendiente();
  };
  // Cada store avisa cuando cambia: terminar una sesión o cerrar un análisis
  // es justo el momento en que conviene entrar.
  for (const store of [
    useSessionStore,
    useDiagnosticoStore,
    useGameStore,
    useFinalesStore,
    useAnalysisStore,
    useMaiaStore,
    useStoykoStore,
    useConversionStore,
    useTransferStore,
  ]) {
    store.subscribe(revisar);
  }
  // Y al irse de la pestaña: recargar mientras nadie mira no interrumpe nada.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') revisar();
  });
}
