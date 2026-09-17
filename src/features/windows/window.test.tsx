import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { playClick } from "#/lib/audio/sounds.ts";
import type * as BootSequenceLifecycle from "#/lib/boot-sequence/lifecycle.ts";
import { isTouchOnly } from "#/lib/device.ts";

import { FOCUSED_WINDOW_CONTENT_ID, Window } from "./window.tsx";

import type { WindowDrag } from "./window.tsx";
import type { ReactNode } from "react";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);
vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);
vi.mock("#/lib/boot-sequence/lifecycle.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BootSequenceLifecycle>()),
  useIsBootSequenceComplete: () => true,
}));
vi.mock("#/lib/device.ts", () => ({ isTouchOnly: vi.fn() }));

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

interface DragHandlers {
  onMove?: (x: number, y: number) => void;
  onResize?: (width: number, height: number) => void;
  onDrag?: (drag: WindowDrag | null) => void;
}

const windowShowing = (contentKey: string, children: ReactNode, focused = true, handlers: DragHandlers = {}) => (
  <Window
    contentKey={contentKey}
    title="Window"
    x={40}
    y={20}
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
    onMove={handlers.onMove ?? vi.fn()}
    onResize={handlers.onResize ?? vi.fn()}
    onDrag={handlers.onDrag ?? vi.fn()}
  >
    {children}
  </Window>
);

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
    onDrag={vi.fn()}
  >
    {children}
  </Window>
);

const tallPane = <div data-height={BASE_PANE_HEIGHT * 8} />;
const shortPane = <div data-height={BASE_PANE_HEIGHT / 4} />;
const button = <button type="button">Button</button>;

const windowTitleBar = () => screen.getByText("Window").parentElement!;
const scrollPane = () => document.getElementById(FOCUSED_WINDOW_CONTENT_ID)!;
const hasScrollableContent = () => screen.getByRole("button", { name: "Scroll up" }).tabIndex === 0; // An arrow is out of the tab order while the pane content fits without scrolling.
const isScrollbarCollapsed = () => screen.getByRole("scrollbar").parentElement?.hasAttribute("data-collapsed");

// `usePointerDrag` reports a move on the frame that follows it, so the outline
// is redrawn once per frame however often the pointer is sampled.
const settleFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

async function dragBy(handle: Element, ...steps: Array<[number, number]>) {
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, button: 0 });

  for (const [clientX, clientY] of steps) {
    fireEvent.pointerMove(handle, { clientX, clientY, buttons: 1 });
    await settleFrame();
  }

  const [lastX, lastY] = steps.at(-1) ?? [0, 0];

  fireEvent.pointerUp(handle, { clientX: lastX, clientY: lastY });
}

function switchAwayAndBack(rerender: (ui: ReactNode) => void, contentKey: string, children: ReactNode) {
  rerender(windowShowing(contentKey, children, false));
  (document.activeElement as HTMLElement).blur();
  rerender(windowShowing(contentKey, children));
}

test("the scrollbar arrows are in the tab order only while the window's current content overflows", () => {
  const { rerender } = render(windowShowing("tall", tallPane));

  expect(hasScrollableContent()).toBe(true);

  rerender(windowShowing("short", shortPane));

  expect(hasScrollableContent()).toBe(false);
});

test("the scroll position resets when the content changes", () => {
  const { rerender } = render(windowShowing("tall", tallPane));

  scrollPane().scrollTop = 240;
  rerender(windowShowing("other", tallPane));

  expect(scrollPane().scrollTop).toBe(0);
});

test("the scroll position is maintained when the content does not change", () => {
  const { rerender } = render(windowShowing("tall", tallPane));

  scrollPane().scrollTop = 240;
  rerender(windowShowing("tall", tallPane));

  expect(scrollPane().scrollTop).toBe(240);
});

test("the window restores focus to its last focused element when it is activated again", () => {
  const { rerender } = render(windowShowing("tall", button));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  switchAwayAndBack(rerender, "tall", button);

  expect(document.activeElement).toBe(focusableElement);
});

test("the window does not restore focus to its resize control", () => {
  const { rerender } = render(windowShowing("tall", button));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  screen.getByRole("button", { name: "Resize" }).focus();
  switchAwayAndBack(rerender, "tall", button);

  expect(document.activeElement).toBe(focusableElement);
});

test("a press on an inactive window prevents the browser's default focus change, and a press on an active window does not", () => {
  const { rerender } = render(windowShowing("tall", button, false));
  const windowElement = screen.getByRole("region", { name: "Window" });

  fireEvent.pointerDown(windowElement);

  // Activating the window restores its last focused element, so the press does not move the focus itself.
  expect(fireEvent.mouseDown(windowElement)).toBe(false);

  rerender(windowShowing("tall", button));
  fireEvent.pointerDown(windowElement);

  expect(fireEvent.mouseDown(windowElement)).toBe(true);
});

test("a press on an inactive window does not trigger a click on the content under it, and the next click does", () => {
  const onClick = vi.fn();
  const { rerender } = render(
    windowShowing(
      "tall",
      <button type="button" onClick={onClick}>
        Button
      </button>,
      false,
    ),
  );

  const target = screen.getByRole("button", { name: "Button" });

  // The press activates the window, so the click that ends it is dispatched to the
  // content the scrim was covering (see `swallowNextPress` in `/src/lib/press.ts`).
  fireEvent.pointerDown(screen.getByRole("region", { name: "Window" }));
  rerender(
    windowShowing(
      "tall",
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

test("a press on the chrome of a window keeps the focus within it unchanged", () => {
  const { rerender } = render(windowShowing("tall", button));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();

  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Zoom" }))).toBe(false);
  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Resize" }))).toBe(false);
  expect(document.activeElement).toBe(focusableElement);

  switchAwayAndBack(rerender, "tall", button);

  expect(document.activeElement).toBe(focusableElement);
});

test("the window restores focus to itself instead of a text field on a touch-only device", () => {
  vi.mocked(isTouchOnly).mockReturnValue(true);

  const field = <input aria-label="Message" />;
  const { rerender } = render(windowShowing("tall", field));

  screen.getByRole("textbox", { name: "Message" }).focus();
  switchAwayAndBack(rerender, "tall", field);

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Window" })); // Focusing a text field on a touch-only device would reopen its software keyboard.
});

test("the window restores focus to itself when its content is replaced", () => {
  const { rerender } = render(windowShowing("tall", <button type="button">Button</button>));

  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  expect(document.activeElement).toBe(focusableElement);

  rerender(windowShowing("other", tallPane));

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Window" }));
});

test("a fixed-size window has neither a zoom control nor a resize control", () => {
  render(fixedSizeWindow("short", shortPane));

  expect(screen.queryByRole("button", { name: "Zoom" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Resize" })).toBeNull();
});

test("the scrollbar of a fixed-size window collapses when its content does not overflow", () => {
  const { rerender } = render(fixedSizeWindow("short", shortPane));

  expect(isScrollbarCollapsed()).toBe(true);

  rerender(fixedSizeWindow("tall", tallPane));

  expect(isScrollbarCollapsed()).toBe(false);
});

test("the scrollbar of a resizable window does not collapse when its content does not overflow", () => {
  render(windowShowing("short", shortPane));

  expect(screen.queryByRole("button", { name: "Resize" })).not.toBeNull();
  expect(isScrollbarCollapsed()).toBe(false); // The scrollbar contains the resize control, so it stays open.
});

test("dragging the title bar reports the position being chosen and moves the window there once the drag ends", async () => {
  const onMove = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", tallPane, true, { onMove, onDrag }));

  const titleBar = windowTitleBar();

  fireEvent.pointerDown(titleBar, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(titleBar, { clientX: 30, clientY: 10, buttons: 1 });
  await settleFrame();

  expect(onDrag).toHaveBeenLastCalledWith({ kind: "move", x: 70, y: 30 });
  expect(onMove).not.toHaveBeenCalled();

  fireEvent.pointerUp(titleBar, { clientX: 30, clientY: 10 });

  expect(onMove).toHaveBeenCalledExactlyOnceWith(70, 30);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("a secondary press on the title bar does not start a drag", async () => {
  // The browser opens its context menu instead.
  const onMove = vi.fn();

  render(windowShowing("tall", tallPane, true, { onMove }));

  const titleBar = windowTitleBar();

  fireEvent.pointerDown(titleBar, { clientX: 0, clientY: 0, button: 2 });
  fireEvent.pointerMove(titleBar, { clientX: 40, clientY: 40, buttons: 2 });
  await settleFrame();
  fireEvent.pointerUp(titleBar, { clientX: 40, clientY: 40 });

  expect(onMove).not.toHaveBeenCalled();
});

test("a press on the title bar that moves within the drag threshold does not report a move or move the window", async () => {
  const onMove = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", tallPane, true, { onMove, onDrag }));

  await dragBy(windowTitleBar(), [2, 2]);

  expect(onDrag).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "move" }));
  expect(onMove).not.toHaveBeenCalled();
});

test("a drag that returns within the drag threshold still moves the window to the final pointer position", async () => {
  // Once past the threshold, moves inside it are still reported, so the outline stays with the pointer.
  const onMove = vi.fn();

  render(windowShowing("tall", tallPane, true, { onMove }));

  await dragBy(windowTitleBar(), [40, 0], [1, 0]);

  expect(onMove).toHaveBeenCalledExactlyOnceWith(41, 20);
});

test("dragging the resize control reports the size being chosen and applies it once the drag ends", async () => {
  const onResize = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", tallPane, true, { onResize, onDrag }));

  const control = screen.getByRole("button", { name: "Resize" });

  fireEvent.pointerDown(control, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(control, { clientX: -50, clientY: 100, buttons: 1 });
  await settleFrame();

  expect(onDrag).toHaveBeenLastCalledWith({ kind: "resize", width: 750, height: 700 });
  expect(onResize).not.toHaveBeenCalled();

  fireEvent.pointerUp(control, { clientX: -50, clientY: 100 });

  expect(onResize).toHaveBeenCalledExactlyOnceWith(750, 700);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("the resize control clears its pressed state when the pointer moves outside it", async () => {
  render(windowShowing("tall", tallPane));

  const control = screen.getByRole("button", { name: "Resize" });

  vi.spyOn(control, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 16, 16));
  fireEvent.pointerDown(control, { clientX: 8, clientY: 8, button: 0 });

  expect(control.className).toContain("pressed");

  fireEvent.pointerMove(control, { clientX: 12, clientY: 12, buttons: 1 });
  await settleFrame();

  expect(control.className).toContain("pressed");

  fireEvent.pointerMove(control, { clientX: 80, clientY: 80, buttons: 1 });
  await settleFrame();

  expect(control.className).not.toContain("pressed");

  fireEvent.pointerMove(control, { clientX: 10, clientY: 10, buttons: 1 });
  await settleFrame();

  expect(control.className).not.toContain("pressed"); // Once cleared, the press state does not return even if the pointer returns to the control.

  fireEvent.pointerUp(control, { clientX: 10, clientY: 10 });

  expect(control.className).not.toContain("pressed");
});

test("a resize drag commits and clears its preview when `pointerup` is dispatched outside the control", async () => {
  const onResize = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", tallPane, true, { onResize, onDrag }));

  const control = screen.getByRole("button", { name: "Resize" });

  fireEvent.pointerDown(control, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(control, { clientX: -50, clientY: 100, buttons: 1 });
  await settleFrame();

  // Pointer capture ends when the capturing element is removed from the document, so the release is
  // then dispatched to the element under the pointer rather than to the control.
  fireEvent.pointerUp(document.body, { clientX: -50, clientY: 100 });

  expect(onResize).toHaveBeenCalledExactlyOnceWith(750, 700);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("a resize drag commits and clears its preview on a `pointermove` without pressed buttons after a missed `pointerup`", async () => {
  const onResize = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", tallPane, true, { onResize, onDrag }));

  const control = screen.getByRole("button", { name: "Resize" });

  fireEvent.pointerDown(control, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(control, { clientX: -50, clientY: 100, buttons: 1 });
  await settleFrame();

  fireEvent.pointerMove(document.body, { clientX: 20, clientY: 20, buttons: 0 });

  expect(onResize).toHaveBeenCalledExactlyOnceWith(750, 700);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("a tap retargeted from the title bar to a control plays the press sound once", () => {
  render(windowShowing("press-sound", button));

  vi.mocked(playClick).mockClear();

  fireEvent.pointerDown(windowTitleBar(), { clientX: 0, clientY: 0, button: 0 }); // The touch press.
  fireEvent.pointerUp(windowTitleBar(), { clientX: 0, clientY: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Close" }), { detail: 1 });

  // iOS can retarget a tap near a control to the control, but only the click event follows. The
  // touch pointer events stay with the element under the finger, which plays the press sound.
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a press on a title bar control plays the press sound once", () => {
  render(windowShowing("control-sound", button));

  const close = screen.getByRole("button", { name: "Close" });

  vi.mocked(playClick).mockClear();

  fireEvent.pointerDown(close, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerUp(close, { clientX: 0, clientY: 0 });
  fireEvent.click(close, { detail: 1 });

  expect(playClick).toHaveBeenCalledTimes(1);
});
