import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useGlobalShortcuts } from "./use-global-shortcuts.ts";

import type { KeyboardShortcut } from "./use-global-shortcuts.ts";

const invokeShortcut = vi.fn();

beforeEach(() => {
  invokeShortcut.mockClear();
});

function Target({ shortcuts }: { shortcuts: Array<KeyboardShortcut> }) {
  useGlobalShortcuts(shortcuts);
  return <input data-testid="field" />;
}

const press = (target: Element | Document, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { code: "KeyW", altKey: true, ...init });

describe("matching a shortcut", () => {
  test("invokes the shortcut whose key code was pressed with the Option key held", () => {
    render(<Target shortcuts={[{ code: "KeyW", run: invokeShortcut }]} />);

    expect(press(document)).toBe(false); // The default was prevented.
    expect(invokeShortcut).toHaveBeenCalledOnce();
  });

  test.each([
    ["without the Option key", { altKey: false }],
    ["with another modifier held", { metaKey: true }],
    ["for another key", { code: "KeyQ" }],
    ["when disabled", {}],
  ])("does not invoke a shortcut %s", (label, init) => {
    render(<Target shortcuts={[{ code: "KeyW", run: invokeShortcut, enabled: label !== "when disabled" }]} />);
    press(document, init);

    expect(invokeShortcut).not.toHaveBeenCalled();
  });
});

describe("a key press targeting an input", () => {
  test("does not invoke the shortcut or prevent the default action of the key press", () => {
    render(<Target shortcuts={[{ code: "KeyW", run: invokeShortcut }]} />);

    expect(press(screen.getByTestId("field"))).toBe(true); // The default was not prevented.
    expect(invokeShortcut).not.toHaveBeenCalled();
  });

  test("invokes the shortcut and prevents the default action when it allows invocation while editing", () => {
    render(<Target shortcuts={[{ code: "KeyW", run: invokeShortcut, invokesWhileEditing: true }]} />);

    expect(press(screen.getByTestId("field"))).toBe(false);
    expect(invokeShortcut).toHaveBeenCalledOnce();
  });

  test("invokes the shortcut when a later shortcut on the same key allows invocation while editing", () => {
    render(
      <Target
        shortcuts={[
          { code: "KeyW", run: vi.fn() },
          { code: "KeyW", run: invokeShortcut, invokesWhileEditing: true },
        ]}
      />,
    );
    press(screen.getByTestId("field"));

    expect(invokeShortcut).toHaveBeenCalledOnce();
  });
});
