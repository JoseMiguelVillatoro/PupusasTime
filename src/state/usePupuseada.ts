import { useCallback, useEffect, useReducer } from 'react';
import { reducer, initialState, type Action, type PupuseadaState } from './pupuseada';
import { archive, loadCurrent, saveCurrent } from './storage';

/**
 * Estado de la pupuseada con guardado automático en el teléfono: si se recarga
 * la página o se cierra el navegador, se retoma donde iba.
 */
export function usePupuseada() {
  const [state, rawDispatch] = useReducer(reducer, undefined, () => loadCurrent() ?? initialState());

  useEffect(() => {
    saveCurrent(state);
  }, [state]);

  useEffect(() => {
    // Cada cambio de pantalla arranca arriba, como una navegación normal.
    window.scrollTo({ top: 0 });
  }, [state.screen, state.currentPersonId]);

  const dispatch = useCallback((action: Action) => rawDispatch(action), []);

  /** Termina la pupuseada: la guarda en el historial y vuelve al inicio. */
  const finish = useCallback(
    (current: PupuseadaState) => {
      archive(current);
      rawDispatch({ type: 'RESET' });
    },
    []
  );

  return { state, dispatch, finish };
}
