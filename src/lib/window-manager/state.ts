import { cascadeSlot, createWindowPlacer, createWindowResizer } from "./layout";
import { WINDOW_DOM_ORDER, isUnmeasured } from "./window";

import type { Rect } from "../geometry";
import type { Action, ManagerState, WindowGeometry, WindowId, WindowLayout, WindowRecord } from "./window";

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

function openSlot(layout: WindowLayout, state: ManagerState, id: WindowId): Rect {
  const slotAt = (step: number) => cascadeSlot(layout, state.surface, id, step);

  if (layout.windows[id].openAt === "center") {
    return slotAt(0);
  }

  const openWindows = Object.values(state.geometry);

  for (let step = 0; step < WINDOW_DOM_ORDER.length; step++) {
    const slot = slotAt(step);

    if (!openWindows.some((window) => window.x === slot.x && window.y === slot.y)) {
      return slot;
    }
  }

  return slotAt(0);
}

function cascadeWindows(layout: WindowLayout, state: ManagerState): WindowRecord<WindowGeometry> {
  const geometry: WindowRecord<WindowGeometry> = {};

  state.order.forEach((id, step) => {
    const target = state.geometry[id];

    if (target) {
      const slot = cascadeSlot(layout, state.surface, id, step);
      geometry[id] = {
        ...slot,
        width: Math.min(target.width, slot.width),
        height: Math.min(target.height, slot.height),
        maximized: false,
      };
    }
  });

  return geometry;
}

function clearNotFound(state: ManagerState): ManagerState {
  return state.notFoundRoute === null ? state : { ...state, notFoundRoute: null };
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
          return clearNotFound(content === state.content ? raised : { ...raised, content });
        }

        return {
          ...state,
          content,
          geometry: {
            ...state.geometry,
            [id]: { ...openSlot(layout, state, id), maximized: false },
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

        return isFirstMeasurement ? { ...measured, geometry: cascadeWindows(layout, measured) } : measured;
      }

      case "cycleWindows": {
        const next = state.focused === null ? state.order.at(-1) : state.order[0];
        return next ? focusWindow(state, next) : state;
      }

      case "focusDesktop": {
        return clearNotFound(state.focused === null ? state : { ...state, focused: null });
      }

      case "notFound": {
        return state.notFoundRoute === action.route ? state : { ...state, notFoundRoute: action.route };
      }

      case "dismissNotFound": {
        return clearNotFound(state);
      }
    }
  };
}
