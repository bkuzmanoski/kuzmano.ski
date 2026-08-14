import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { FOCUSED_WINDOW_CONTENT_ID, Window } from "./window";

import type { ReactNode } from "react";

vi.mock("#/lib/audio/ui", () => ({
  playClick: vi.fn(),
  playScroll: vi.fn(),
  playScrollStep: vi.fn(),
  skipScrollAt: vi.fn(),
}));
vi.mock("#/lib/boot-sequence/use-is-boot-sequence-complete", () => ({ useIsBootSequenceComplete: () => true }));

const PANE_HEIGHT = 100;

const scrollTops = new WeakMap<Element, number>();
const replacedProperties: Array<[string, PropertyDescriptor | undefined]> = [];

function replaceElementProperty(property: string, descriptor: PropertyDescriptor) {
  replacedProperties.push([property, Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)]);
  Object.defineProperty(HTMLElement.prototype, property, { configurable: true, ...descriptor });
}

beforeAll(() => {
  replaceElementProperty("clientHeight", { get: () => PANE_HEIGHT });
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

const windowShowing = (contentKey: string, children: ReactNode) => (
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
    onZoom={vi.fn()}
    onFocus={vi.fn()}
    onMove={vi.fn()}
    onResize={vi.fn()}
  >
    {children}
  </Window>
);

const tallPane = <div data-height={PANE_HEIGHT * 8} />;
const shortPane = <div data-height={PANE_HEIGHT / 5} />;

const pane = () => document.getElementById(FOCUSED_WINDOW_CONTENT_ID)!;
const hasScrollableContent = () => screen.getByRole("button", { name: "Scroll up" }).tabIndex === 0; // An arrow is out of the tab order while the pane has nothing to scroll to.

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

test("the window restores focus to itself when its content is replaced", () => {
  const { rerender } = render(windowShowing("/tall", <button type="button">Button</button>));

  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  expect(document.activeElement).toBe(focusableElement);

  rerender(windowShowing("/other", tallPane));

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Window" }));
});
