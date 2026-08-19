import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { DismissContext } from "#/lib/hooks/use-dismiss-window";

import { DialogBody } from "./dialog-body";

test("the default close button dismisses the window the dialog renders in", () => {
  const dismiss = vi.fn();

  render(
    <DismissContext value={dismiss}>
      <DialogBody message="" />
    </DismissContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(dismiss).toHaveBeenCalledOnce();
});

test("supplied actions replace the default close button", () => {
  const dismiss = vi.fn();

  render(
    <DismissContext value={dismiss}>
      <DialogBody message="" actions={<button type="button">Try Again</button>} />
    </DismissContext>,
  );

  expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
  expect(screen.getByRole("button", { name: "Try Again" })).toBeDefined();
});

test("the title renders at heading level two by default, and at the specified level", () => {
  render(<DialogBody title="Page not found" message="" />);
  expect(screen.getByRole("heading", { name: "Page not found", level: 2 })).toBeDefined();

  render(<DialogBody title="Error" headingLevel={1} message="" />);
  expect(screen.getByRole("heading", { name: "Error", level: 1 })).toBeDefined();
});

test("no close button is rendered if no actions are supplied and the dialog is not in a window", () => {
  render(<DialogBody message="" />);
  expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
});
