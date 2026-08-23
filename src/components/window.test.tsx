import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { isTouchOnly } from "#/lib/device";

import { FOCUSED_WINDOW_CONTENT_ID, Window } from "./window";

import type { ReactNode } from "react";

vi.mock("#/lib/audio/sounds", () => ({ playClick: vi.fn() }));
vi.mock("#/lib/audio/scroll", () => ({
  skipScrollAt: vi.fn(),
  stepScroll: vi.fn(),
  playScroll: vi.fn(),
}));
vi.mock("#/lib/boot-sequence/use-is-boot-sequence-complete", () => ({ useIsBootSequenceComplete: () => true }));
vi.mock("#/lib/device", () => ({ isTouchOnly: vi.fn() }));

const BASE_PANE_HEIGHT = 100;

const scrollTops = new WeakMap<Element, number>();
const replacedProperties: Array<[string, PropertyDescriptor | undefined]> = [];

function replaceElementProperty(property: string, descriptor: PropertyDescriptor) {
  replacedProperties.push([property, Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)]);
  Object.defineProperty(HTMLElement.prototype, property, { configurable: true, ...descriptor });
}

beforeAll(() => {
  replaceElementProperty("clientHeight", { get: () => BASE_PANE_HEIGHT });
  replaceElementProperty("scrollHeight", {
    get(this: HTMLElement) {
      return [...this.children].reduce((total, child) => total + Number((child as HTMLElement).dataset.height ?? 0), 0);
    },
  });
  replaceElementProperty("scrollTop", {
    get(this: HTMLElement) {
      return scrollTops.get(this) ?? 0;
    },
    set(this: HTMLElement, top: number) {
      scrollTops.set(this, top);
    },
  });
});

afterAll(() => {
  for (const [property, descriptor] of replacedProperties) {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, property, descriptor);
    }
  }
});

const windowShowing = (contentKey: string, children: ReactNode, focused = true) => (
  <Window
    contentKey={contentKey}
    title="Window"
    x={0}
    y={0}
    width={800}
    height={600}
    z={1}
    focused={focused}
    maximized={false}
    hidden={false}
    unplaced={false}
    onClose={vi.fn()}
    onZoom={vi.fn()}
    onFocus={vi.fn()}
    onMove={vi.fn()}
    onResize={vi.fn()}
  >
    {children}
  </Window>
);

const tallPane = <div data-height={BASE_PANE_HEIGHT * 8} />;
const shortPane = <div data-height={BASE_PANE_HEIGHT / 4} />;
const button = <button type="button">Button</button>;

const pane = () => document.getElementById(FOCUSED_WINDOW_CONTENT_ID)!;
const hasScrollableContent = () => screen.getByRole("button", { name: "Scroll up" }).tabIndex === 0; // An arrow is out of the tab order while the pane has nothing to scroll to.

function switchAwayAndBack(rerender: (ui: ReactNode) => void, contentKey: string, children: ReactNode) {
  rerender(windowShowing(contentKey, children, false));
  (document.activeElement as HTMLElement).blur();
  rerender(windowShowing(contentKey, children));
}

test("the scrollbar describes the current content rendered by the window", () => {
  const { rerender } = render(windowShowing("/tall", tallPane));

  expect(hasScrollableContent()).toBe(true);

  rerender(windowShowing("/short", shortPane));

  expect(hasScrollableContent()).toBe(false);
});

test("the scroll position resets when the content changes", () => {
  const { rerender } = render(windowShowing("/tall", tallPane));

  pane().scrollTop = 240;
  rerender(windowShowing("/other", tallPane));

  expect(pane().scrollTop).toBe(0);
});

test("the scroll position is maintained when the content does not change", () => {
  const { rerender } = render(windowShowing("/tall", tallPane));

  pane().scrollTop = 240;
  rerender(windowShowing("/tall", tallPane));

  expect(pane().scrollTop).toBe(240);
});

test("the window restores the focus it last held when it is activated again", () => {
  const { rerender } = render(windowShowing("/tall", button));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  switchAwayAndBack(rerender, "/tall", button);

  expect(document.activeElement).toBe(focusableElement);
});

test("the window does not restore focus to its resize control", () => {
  const { rerender } = render(windowShowing("/tall", button));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  screen.getByRole("button", { name: "Resize" }).focus();
  switchAwayAndBack(rerender, "/tall", button);

  expect(document.activeElement).toBe(focusableElement);
});

test("a press on an inactive window leaves the focus to the restore that follows it", () => {
  const { rerender } = render(windowShowing("/tall", button, false));
  const windowElement = screen.getByRole("region", { name: "Window" });

  fireEvent.pointerDown(windowElement);

  expect(fireEvent.mouseDown(windowElement)).toBe(false);

  rerender(windowShowing("/tall", button));
  fireEvent.pointerDown(windowElement);

  expect(fireEvent.mouseDown(windowElement)).toBe(true);
});

test("a press on an inactive window is not passed on to what it lands over", () => {
  const onClick = vi.fn();
  const { rerender } = render(
    windowShowing(
      "/tall",
      <button type="button" onClick={onClick}>
        Button
      </button>,
      false,
    ),
  );

  const target = screen.getByRole("button", { name: "Button" });

  // The press activates the window, so the click that ends it is dispatched
  // to the content the scrim was covering (see `swallowNextPress`).
  fireEvent.pointerDown(screen.getByRole("region", { name: "Window" }));
  rerender(
    windowShowing(
      "/tall",
      <button type="button" onClick={onClick}>
        Button
      </button>,
    ),
  );

  expect(fireEvent.click(target)).toBe(false);
  expect(onClick).not.toHaveBeenCalled();
  expect(fireEvent.click(target)).toBe(true);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("a press on the chrome of a window leaves the focus within it unchanged", () => {
  const { rerender } = render(windowShowing("/tall", button));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();

  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Zoom" }))).toBe(false);
  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Resize" }))).toBe(false);
  expect(document.activeElement).toBe(focusableElement);

  switchAwayAndBack(rerender, "/tall", button);

  expect(document.activeElement).toBe(focusableElement);
});

test("a touch device is not returned to a field, which would reopen its software keyboard", () => {
  vi.mocked(isTouchOnly).mockReturnValue(true);

  const field = <input aria-label="Field" />;
  const { rerender } = render(windowShowing("/tall", field));

  screen.getByRole("textbox", { name: "Field" }).focus();
  switchAwayAndBack(rerender, "/tall", field);

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Window" }));
});

test("the window restores focus to itself when its content is replaced", () => {
  const { rerender } = render(windowShowing("/tall", <button type="button">Button</button>));

  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  expect(document.activeElement).toBe(focusableElement);

  rerender(windowShowing("/other", tallPane));

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Window" }));
});

const fixedSizeWindow = (contentKey: string, children: ReactNode) => (
  <Window
    contentKey={contentKey}
    title="Window"
    x={0}
    y={0}
    width={800}
    height={600}
    z={1}
    focused
    maximized={false}
    hidden={false}
    unplaced={false}
    onClose={vi.fn()}
    onZoom={null}
    onFocus={vi.fn()}
    onMove={vi.fn()}
    onResize={null}
  >
    {children}
  </Window>
);

const isScrollbarCollapsed = () => screen.getByRole("scrollbar").parentElement?.hasAttribute("data-collapsed");

test("a fixed-size window has neither a zoom control nor a resize control", () => {
  render(fixedSizeWindow("/short", shortPane));

  expect(screen.queryByRole("button", { name: "Zoom" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Resize" })).toBeNull();
});

test("the scrollbar of a fixed-size window collapses when its content does not overflow", () => {
  const { rerender } = render(fixedSizeWindow("/short", shortPane));

  expect(isScrollbarCollapsed()).toBe(true);

  rerender(fixedSizeWindow("/tall", tallPane));

  expect(isScrollbarCollapsed()).toBe(false);
});

test("the scrollbar of a window that can be resized stays open to carry the resize control", () => {
  render(windowShowing("/short", shortPane));

  expect(screen.queryByRole("button", { name: "Resize" })).not.toBeNull();
  expect(isScrollbarCollapsed()).toBe(false);
});
