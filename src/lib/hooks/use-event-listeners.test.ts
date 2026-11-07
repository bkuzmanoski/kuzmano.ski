import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { useEventListeners } from "./use-event-listeners.ts";

import type { EventListenerOptions } from "./use-event-listeners.ts";

const renderKeyDownListener = (onKeyDown: (event: KeyboardEvent) => void, options?: EventListenerOptions) =>
  renderHook(({ handler, listenerOptions }) => useEventListeners("document", { keydown: handler }, listenerOptions), {
    initialProps: { handler: onKeyDown, listenerOptions: options },
  });

const pressKey = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

test("calls the handler for each event of its type on the target", () => {
  const onKeyDown = vi.fn();

  renderKeyDownListener(onKeyDown);
  pressKey();

  expect(onKeyDown).toHaveBeenCalledTimes(1);
  expect(onKeyDown.mock.calls[0]?.[0]).toBeInstanceOf(KeyboardEvent);
});

test("calls the handler from the latest render without adding the listener again", () => {
  const addEventListener = vi.spyOn(document, "addEventListener");
  const firstHandler = vi.fn();
  const latestHandler = vi.fn();
  const { rerender } = renderKeyDownListener(firstHandler);

  rerender({ handler: latestHandler, listenerOptions: undefined });
  pressKey();

  expect(firstHandler).not.toHaveBeenCalled();
  expect(latestHandler).toHaveBeenCalledTimes(1);
  expect(addEventListener.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
});

test("removes the listener when the component unmounts", () => {
  const onKeyDown = vi.fn();
  const { unmount } = renderKeyDownListener(onKeyDown);

  unmount();
  pressKey();

  expect(onKeyDown).not.toHaveBeenCalled();
});

test("does not listen while `enabled` is `false`, and listens once it becomes `true`", () => {
  const onKeyDown = vi.fn();
  const { rerender } = renderKeyDownListener(onKeyDown, { enabled: false });

  pressKey();

  expect(onKeyDown).not.toHaveBeenCalled();

  rerender({ handler: onKeyDown, listenerOptions: { enabled: true } });
  pressKey();

  expect(onKeyDown).toHaveBeenCalledTimes(1);
});

test("listens in the capture phase when `capture` is `true`", () => {
  const callOrder: Array<string> = [];
  const target = document.body.appendChild(document.createElement("div"));

  target.addEventListener("keydown", () => callOrder.push("target"));
  renderKeyDownListener(() => callOrder.push("document"), { capture: true });
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
  target.remove();

  expect(callOrder).toEqual(["document", "target"]);
});
