import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { playError, playSuccess } from "#/lib/audio/sounds";

import { Alert } from "./alert";

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

const CONTENT = {
  heading: { text: "Discard this message?" },
  message: "Your message will be lost.",
};
const PRIMARY_ACTION = { label: "OK", onAction: () => undefined };

const stubDialogBox = (rect: { x: number; y: number; width: number; height: number }) =>
  vi.spyOn(screen.getByRole("dialog"), "getBoundingClientRect").mockReturnValue(rect as DOMRect);

const escape = () => fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));

test("a closed modal alert has no reachable content", () => {
  render(
    <Alert
      {...CONTENT}
      open={false}
      primaryAction={{ label: "Discard", onAction: vi.fn<() => void>() }}
      secondaryAction={{ label: "Cancel", onAction: vi.fn<() => void>() }}
    />,
  );

  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
  expect(screen.queryAllByRole("button", { hidden: true })).toHaveLength(0);
});

test("a page-level alert is rendered open without JavaScript", () => {
  render(<Alert message="There was a problem." modal={false} primaryAction={{ label: "Go Home", onAction: "/" }} />);
  expect(screen.getByRole("dialog")).toBeDefined();
});

test("a page-level alert renders its message", () => {
  render(
    <Alert message="This page doesn’t exist." modal={false} primaryAction={{ label: "Go Home", onAction: "/" }} />,
  );
  expect(screen.getByText("This page doesn’t exist.")).toBeDefined();
});

test("an open alert renders the actions it was given", () => {
  render(
    <Alert message="There was a problem." open primaryAction={{ label: "Reload", onAction: vi.fn<() => void>() }} />,
  );
  expect(screen.getByRole("button", { name: "Reload" })).toBeDefined();
});

test("the primary action receives focus when the alert opens", () => {
  render(
    <Alert
      {...CONTENT}
      open
      primaryAction={{ label: "Discard", onAction: vi.fn<() => void>() }}
      secondaryAction={{ label: "Cancel", onAction: vi.fn<() => void>() }}
    />,
  );
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Discard" }));
});

test("the secondary action is rendered before the primary action", () => {
  render(
    <Alert
      {...CONTENT}
      open
      primaryAction={{ label: "Discard", onAction: vi.fn<() => void>() }}
      secondaryAction={{ label: "Cancel", onAction: vi.fn<() => void>() }}
    />,
  );
  expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Discard"]);
});

test("an alert without a secondary action has one action", () => {
  render(
    <Alert message="Your message is on its way." open primaryAction={{ label: "OK", onAction: vi.fn<() => void>() }} />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(1);
});

test("a navigation action is rendered as a link", () => {
  render(<Alert message="There was a problem." modal={false} primaryAction={{ label: "Go Home", onAction: "/" }} />);

  expect(screen.getByRole("link", { name: "Go Home" }).getAttribute("href")).toBe("/");
  expect(screen.queryByRole("button", { name: "Go Home" })).toBeNull();
});

test("clicking an action runs that action", () => {
  const onPrimary = vi.fn<() => void>();
  const onSecondary = vi.fn<() => void>();

  render(
    <Alert
      {...CONTENT}
      open
      primaryAction={{ label: "Discard", onAction: onPrimary }}
      secondaryAction={{ label: "Cancel", onAction: onSecondary }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Discard" }));

  expect(onPrimary).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onSecondary).toHaveBeenCalledOnce();
});

test("the Escape key runs the secondary action without closing the dialog", () => {
  const onPrimary = vi.fn<() => void>();
  const onSecondary = vi.fn<() => void>();

  render(
    <Alert
      {...CONTENT}
      open
      primaryAction={{ label: "Discard", onAction: onPrimary }}
      secondaryAction={{ label: "Cancel", onAction: onSecondary }}
    />,
  );
  escape();

  expect(onSecondary).toHaveBeenCalledOnce();
  expect(onPrimary).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeDefined();
});

test("the Escape key runs the primary action when there is no secondary action", () => {
  const onPrimary = vi.fn<() => void>();

  render(<Alert message="Your message is on its way." open primaryAction={{ label: "OK", onAction: onPrimary }} />);
  escape();

  expect(onPrimary).toHaveBeenCalledOnce();
});

test("pressing outside a modal alert plays the error tone", () => {
  render(
    <Alert
      {...CONTENT}
      open
      primaryAction={{ label: "Discard", onAction: vi.fn<() => void>() }}
      secondaryAction={{ label: "Cancel", onAction: vi.fn<() => void>() }}
    />,
  );
  stubDialogBox({ x: 100, y: 100, width: 400, height: 200 });
  vi.mocked(playError).mockClear();
  fireEvent.pointerDown(screen.getByRole("dialog"), { clientX: 40, clientY: 320 });

  expect(playError).toHaveBeenCalledOnce();
});

test("pressing within the alert, including its padding, does not play the error tone", () => {
  render(
    <Alert
      {...CONTENT}
      open
      primaryAction={{ label: "Discard", onAction: vi.fn<() => void>() }}
      secondaryAction={{ label: "Cancel", onAction: vi.fn<() => void>() }}
    />,
  );
  stubDialogBox({ x: 100, y: 100, width: 400, height: 200 });
  vi.mocked(playError).mockClear();
  fireEvent.pointerDown(screen.getByRole("dialog"), { clientX: 110, clientY: 110 });

  expect(playError).not.toHaveBeenCalled();
});

test("a modal alert plays an error sound when it opens", () => {
  const { rerender } = render(<Alert {...CONTENT} open={false} primaryAction={PRIMARY_ACTION} />);

  vi.mocked(playError).mockClear();
  rerender(<Alert {...CONTENT} open primaryAction={PRIMARY_ACTION} />);

  expect(playError).toHaveBeenCalledOnce();
});

test("an alert with a success sound plays it when it opens", () => {
  const { rerender } = render(<Alert {...CONTENT} sound="success" open={false} primaryAction={PRIMARY_ACTION} />);

  vi.mocked(playSuccess).mockClear();
  rerender(<Alert {...CONTENT} sound="success" open primaryAction={PRIMARY_ACTION} />);

  expect(playSuccess).toHaveBeenCalledOnce();
});

test("a silenced or page-level alert opens without playing a sound", () => {
  const { rerender } = render(<Alert {...CONTENT} sound="none" open={false} primaryAction={PRIMARY_ACTION} />);

  vi.mocked(playError).mockClear();
  rerender(<Alert {...CONTENT} sound="none" open primaryAction={PRIMARY_ACTION} />);
  render(<Alert {...CONTENT} modal={false} primaryAction={PRIMARY_ACTION} />);

  expect(playError).not.toHaveBeenCalled();
});
