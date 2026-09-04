import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useGlobalShortcuts } from "./use-global-shortcuts.ts";

import type { KeyboardShortcut } from "./use-global-shortcuts.ts";

const run = vi.fn();

beforeEach(() => {
  run.mockClear();
});

function Target({ shortcuts }: { shortcuts: Array<KeyboardShortcut> }) {
  useGlobalShortcuts(shortcuts);
  return <input data-testid="field" />;
}

const press = (target: Element | Document, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { code: "KeyW", altKey: true, ...init });

describe("matching a shortcut", () => {
  test("runs the shortcut whose key code was pressed with the option key held", () => {
    render(<Target shortcuts={[{ code: "KeyW", run }]} />);

    expect(press(document)).toBe(false); // The default was prevented.
    expect(run).toHaveBeenCalledOnce();
  });

  test.each([
    ["without the option key", { altKey: false }],
    ["with another modifier held", { metaKey: true }],
    ["on another key", { code: "KeyQ" }],
    ["when disabled", {}],
  ])("does not run %s", (label, init) => {
    render(<Target shortcuts={[{ code: "KeyW", run, enabled: label !== "when disabled" }]} />);
    press(document, init);

    expect(run).not.toHaveBeenCalled();
  });
});

describe("an input holding the focus", () => {
  test("does not run a shortcut, leaving the keystroke to the input", () => {
    render(<Target shortcuts={[{ code: "KeyW", run }]} />);

    expect(press(screen.getByTestId("field"))).toBe(true); // The default was not prevented.
    expect(run).not.toHaveBeenCalled();
  });

  test("runs a shortcut marked as runs while editing", () => {
    render(<Target shortcuts={[{ code: "KeyW", run, runsWhileEditing: true }]} />);

    expect(press(screen.getByTestId("field"))).toBe(false);
    expect(run).toHaveBeenCalledOnce();
  });

  test("a shortcut that does not run while editing does not shadow a later one on the same key", () => {
    render(
      <Target
        shortcuts={[
          { code: "KeyW", run: vi.fn() },
          { code: "KeyW", run, runsWhileEditing: true },
        ]}
      />,
    );
    press(screen.getByTestId("field"));

    expect(run).toHaveBeenCalledOnce();
  });
});
