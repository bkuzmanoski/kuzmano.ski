import { createWindowPlacer, createWindowResizer, defaultRect } from "./layout.ts";
import { isUnmeasured } from "./window.ts";

import type { Action, ManagerState, WindowGeometry, WindowId, WindowLayout, WindowRecord } from "./window.ts";

function updateGeometry(
  state: ManagerState,
  id: WindowId,
  patch: (target: WindowGeometry) => Partial<WindowGeometry>,
): ManagerState {
  const target = state.geometry[id];

  if (!target) {
    return state;
  }

  return { ...state, geometry: { ...state.geometry, [id]: { ...target, ...patch(target) } } };
}

function layOutWindows(layout: WindowLayout, state: ManagerState): WindowRecord<WindowGeometry> {
  const geometry: WindowRecord<WindowGeometry> = {};

  for (const windowId of state.order) {
    geometry[windowId] = { ...defaultRect(layout, state.surface, windowId), maximized: false };
  }

  return geometry;
}

function focusWindow(state: ManagerState, id: WindowId): ManagerState {
  if (!state.content[id]) {
    return state;
  }

  if (state.focused === id && state.order.at(-1) === id) {
    return state;
  }

  return { ...state, order: [...state.order.filter((open) => open !== id), id], focused: id };
}

function clearNotFoundAlert(state: ManagerState): ManagerState {
  return state.notFoundRoute === null ? state : { ...state, notFoundRoute: null };
}

export type WindowReducer = (state: ManagerState, action: Action) => ManagerState;

export function createWindowReducer(layout: WindowLayout): WindowReducer {
  const placeWindow = createWindowPlacer(layout);
  const resizeWindow = createWindowResizer(layout);

  return function reducer(state: ManagerState, action: Action): ManagerState {
    switch (action.type) {
      case "open": {
        const { id, route, title } = action;
        const current = state.content[id];
        const content = current?.route === route ? state.content : { ...state.content, [id]: { route, title } };

        if (current) {
          const raised = focusWindow(state, id);
          return clearNotFoundAlert(content === state.content ? raised : { ...raised, content });
        }

        return {
          ...state,
          content,
          geometry: {
            ...state.geometry,
            [id]: { ...defaultRect(layout, state.surface, id), maximized: false },
          },
          order: [...state.order, id],
          focused: id,
          notFoundRoute: null,
        };
      }

      case "close": {
        if (!state.content[action.id]) {
          return state;
        }

        const { [action.id]: _closedContent, ...content } = state.content;
        const { [action.id]: _closedGeometry, ...geometry } = state.geometry;
        const order = state.order.filter((open) => open !== action.id);
        const focused = state.focused === action.id ? (order.at(-1) ?? null) : state.focused;

        return { ...state, content, geometry, order, focused };
      }

      case "focus": {
        return focusWindow(state, action.id);
      }

      case "move": {
        return updateGeometry(state, action.id, (target) => {
          const { x, y } = placeWindow({ ...target, x: action.x, y: action.y }, state.surface);
          return { x, y };
        });
      }

      case "resize": {
        return updateGeometry(state, action.id, (target) =>
          resizeWindow(target, state.surface, { width: action.width, height: action.height }),
        );
      }

      case "zoom": {
        return updateGeometry(focusWindow(state, action.id), action.id, (target) => ({
          maximized: !target.maximized,
        }));
      }

      case "measure": {
        const { surface } = action;

        if (state.surface.width === surface.width && state.surface.height === surface.height) {
          return state;
        }

        const measured = { ...state, surface };
        const isFirstMeasurement = isUnmeasured(state.surface);

        return isFirstMeasurement ? { ...measured, geometry: layOutWindows(layout, measured) } : measured;
      }

      case "cycleWindows": {
        const next = state.focused === null ? state.order.at(-1) : state.order[0];
        return next ? focusWindow(state, next) : state;
      }

      case "focusDesktop": {
        return clearNotFoundAlert(state.focused === null ? state : { ...state, focused: null });
      }

      case "showNotFoundAlert": {
        return state.notFoundRoute === action.route ? state : { ...state, notFoundRoute: action.route };
      }

      case "dismissNotFoundAlert": {
        return clearNotFoundAlert(state);
      }
    }
  };
}
