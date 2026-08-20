import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { GameState } from '@/lib/types';
import { loadGame, saveGame } from '@/lib/storage';
import { createGame } from './defaults';
import { reducer, type Action } from './reducer';

interface Store {
  state: GameState;
  dispatch: (action: Action) => void;
}

const GameContext = createContext<Store | null>(null);

function init(): GameState {
  return loadGame() ?? createGame();
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const saveTimer = useRef<number | null>(null);

  // Autosave, debounced so typing in a field doesn't hit storage on every keystroke.
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveGame(state), 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  // A phone backgrounding the tab is the most likely way to lose the last edit.
  useEffect(() => {
    const flush = () => saveGame(state);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): Store {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}

export function useGameState(): GameState {
  return useGame().state;
}

export function useDispatch(): (action: Action) => void {
  const { dispatch } = useGame();
  return useCallback((action: Action) => dispatch(action), [dispatch]);
}
