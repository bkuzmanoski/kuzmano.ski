import { expect, test, vi } from "vitest";

import { createWindowKeyDownHandlers } from "./use-window-key-down.ts";

import type { KeyboardEvent } from "react";

function keyDown() {
  const event = {
    key: "ArrowDown",
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event as KeyboardEvent & typeof event;
}

test("`handle` runs the registered handlers in the order they were registered", () => {
  const handlers = createWindowKeyDownHandlers();
  const calls: Array<string> = [];

  handlers.register(() => calls.push("first"));
  handlers.register(() => calls.push("second"));
  handlers.handle(keyDown());

  expect(calls).toEqual(["first", "second"]);
});

test("`handle` does not run the handlers after one that claimed the key with `preventDefault`", () => {
  const handlers = createWindowKeyDownHandlers();
  const laterHandler = vi.fn();

  handlers.register((event) => event.preventDefault());
  handlers.register(laterHandler);
  handlers.handle(keyDown());

  expect(laterHandler).not.toHaveBeenCalled();
});

test("`handle` does not run a handler once the function returned by `register` has been called", () => {
  const handlers = createWindowKeyDownHandlers();
  const handler = vi.fn();

  handlers.register(handler)();
  handlers.handle(keyDown());

  expect(handler).not.toHaveBeenCalled();
});
