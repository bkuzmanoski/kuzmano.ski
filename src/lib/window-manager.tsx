import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

import type { ReactNode } from "react";

/**
 * Temporary window state that the URL does not hold. This state lives above
 * the router outlet so that a window keeps its position after navigation.
 */

interface Position {
  x: number;
  y: number;
}

const DEFAULT_WINDOW_POSITION: Position = { x: 72, y: 56 }; // TODO: Set the default position from the design specification.

interface WindowManagerState {
  positions: Record<string, Position>;
  order: Array<string>; // Focus order, back to front. The app focuses the last id and draws it on top.
}

type WindowAction = { type: "focus"; id: string } | { type: "move"; id: string; x: number; y: number };

interface WindowManagerValue extends WindowManagerState {
  dispatch: (action: WindowAction) => void;
}

const ManagerContext = createContext<WindowManagerValue | null>(null);

function reducer(state: WindowManagerState, action: WindowAction): WindowManagerState {
  switch (action.type) {
    case "focus": {
      if (state.order.at(-1) === action.id) {
        return state;
      }

      return { ...state, order: [...state.order.filter((id) => id !== action.id), action.id] };
    }
    case "move": {
      return { ...state, positions: { ...state.positions, [action.id]: { x: action.x, y: action.y } } };
    }
  }
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { positions: {}, order: [] });
  const value = useMemo(() => ({ ...state, dispatch }), [state]);

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export interface WindowHandle {
  x: number;
  y: number;
  z: number;
  focused: boolean;
  focus: () => void;
  move: (x: number, y: number) => void;
}

/**
 * Adds a window to the manager. The window takes the focus when it mounts.
 * A route brings its window to the front on the server and on the client.
 *
 * The window uses the same default position until the user drags it. This makes
 * the server render and the first client render identical to prevent a
 * hydration error.
 */
export function useWindow(id: string): WindowHandle {
  const manager = useContext(ManagerContext);

  if (!manager) {
    throw new Error("`useWindow` must be used within a `WindowManagerProvider`");
  }

  const { positions, order, dispatch } = manager;

  const focus = useCallback(() => dispatch({ type: "focus", id }), [dispatch, id]);
  const move = useCallback((x: number, y: number) => dispatch({ type: "move", id, x, y }), [dispatch, id]);

  useEffect(() => {
    focus();
  }, [focus]);

  const position = positions[id] ?? DEFAULT_WINDOW_POSITION;
  const index = order.indexOf(id);

  return {
    x: position.x,
    y: position.y,
    z: index < 0 ? 0 : index + 1,
    focused: order.at(-1) === id,
    focus,
    move,
  };
}
