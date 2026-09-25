import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { ARROW_STEP_PX } from "#/components/scrollbar.tsx";
import type * as Scroll from "#/lib/audio/scroll.ts";
import { playClick, playScrollDetent } from "#/lib/audio/sounds.ts";
import type * as BootSequenceLifecycle from "#/lib/boot-sequence/lifecycle.ts";
import { isTouchOnly } from "#/lib/device.ts";
import { clamp } from "#/lib/math.ts";
import { useWindowKeyDown } from "#/lib/window-manager/use-window-key-down.ts";
import { descriptionTextOf } from "#/test-utils/accessibility.ts";
import { nextAnimationFrame } from "#/test-utils/timers.ts";

import { FOCUSED_WINDOW_CONTENT_ID, Window } from "./window.tsx";

import type { WindowDrag } from "./window.tsx";
import type { KeyboardEvent, ReactNode } from "react";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);
vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {
    stepScrollForPress: (await importOriginal<typeof Scroll>()).stepScrollForPress,
  }),
);
vi.mock("#/lib/boot-sequence/lifecycle.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof BootSequenceLifecycle>()),
  useIsBootSequenceComplete: () => true,
}));
vi.mock("#/lib/device.ts", () => ({ isTouchOnly: vi.fn() }));

const BASE_PANE_HEIGHT = 100;
const PAGE_SCROLL_DISTANCE_PX = BASE_PANE_HEIGHT - ARROW_STEP_PX; // A page overlaps the previous one by one arrow step.

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
  replaceElementProperty("scrollBy", {
    value(this: HTMLElement, { top = 0 }: ScrollToOptions = {}) {
      this.scrollTop = clamp(this.scrollTop + top, 0, Math.max(0, this.scrollHeight - this.clientHeight));
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

const INITIAL_SCROLL_TOP = 240;
const TALL_PANE_ELEMENT = <div data-height={BASE_PANE_HEIGHT * 8} />;
const SHORT_PANE_ELEMENT = <div data-height={BASE_PANE_HEIGHT / 4} />;
const BUTTON_ELEMENT = <button type="button">Button</button>;

const windowShowing = (
  contentKey: string,
  children: ReactNode,
  focused = true,
  handlers: {
    onFocus?: () => void;
    onMove?: (x: number, y: number) => void;
    onResize?: (width: number, height: number) => void;
    onDrag?: (drag: WindowDrag | null) => void;
  } = {},
) => (
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
    onFocus={handlers.onFocus ?? vi.fn()}
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
const windowTitleBar = () => screen.getByText("Window").parentElement!;
const scrollPane = () => document.getElementById(FOCUSED_WINDOW_CONTENT_ID)!;
const scrollArrows = () => [screen.getByLabelText("Scroll up"), screen.getByLabelText("Scroll down")];
const scrollArrowVisibilities = () => scrollArrows().map((arrow) => getComputedStyle(arrow).visibility);
const isScrollbarCollapsed = () => screen.getByRole("scrollbar").parentElement?.hasAttribute("data-collapsed");

function ContentClaimingKey({ claimedKey }: { claimedKey: string }) {
  useWindowKeyDown((event: KeyboardEvent) => {
    if (event.key === claimedKey) {
      event.preventDefault();
    }
  });

  return TALL_PANE_ELEMENT;
}

async function dragBy(handle: Element, ...steps: Array<[number, number]>) {
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, button: 0 });

  for (const [clientX, clientY] of steps) {
    fireEvent.pointerMove(handle, { clientX, clientY, buttons: 1 });
    await nextAnimationFrame();
  }

  const [lastX, lastY] = steps.at(-1) ?? [0, 0];

  fireEvent.pointerUp(handle, { clientX: lastX, clientY: lastY });
}

function switchAwayAndBack(rerender: (ui: ReactNode) => void, contentKey: string, children: ReactNode) {
  rerender(windowShowing(contentKey, children, false));
  (document.activeElement as HTMLElement).blur();
  rerender(windowShowing(contentKey, children));
}

test("the scrollbar arrows are not in the tab order, whether or not the content overflows", () => {
  const { rerender } = render(windowShowing("tall", TALL_PANE_ELEMENT));

  expect(scrollArrows().map((arrow) => arrow.tabIndex)).toEqual([-1, -1]);

  rerender(windowShowing("short", SHORT_PANE_ELEMENT));

  expect(scrollArrows().map((arrow) => arrow.tabIndex)).toEqual([-1, -1]);
});

test("the scrollbar arrows are hidden only while the window's current content fits without scrolling", () => {
  const { rerender } = render(windowShowing("tall", TALL_PANE_ELEMENT));

  expect(scrollArrowVisibilities()).toEqual(["visible", "visible"]);

  rerender(windowShowing("short", SHORT_PANE_ELEMENT));

  expect(scrollArrowVisibilities()).toEqual(["hidden", "hidden"]);
});

test("the scroll position resets when the content changes", () => {
  const { rerender } = render(windowShowing("tall", TALL_PANE_ELEMENT));

  scrollPane().scrollTop = 240;
  rerender(windowShowing("other", TALL_PANE_ELEMENT));

  expect(scrollPane().scrollTop).toBe(0);
});

test("the scroll position is maintained when the content does not change", () => {
  const { rerender } = render(windowShowing("tall", TALL_PANE_ELEMENT));

  scrollPane().scrollTop = 240;
  rerender(windowShowing("tall", TALL_PANE_ELEMENT));

  expect(scrollPane().scrollTop).toBe(240);
});

test.each([
  ["the Down arrow key", INITIAL_SCROLL_TOP + ARROW_STEP_PX, { key: "ArrowDown" }],
  ["the Up arrow key", INITIAL_SCROLL_TOP - ARROW_STEP_PX, { key: "ArrowUp" }],
  ["the Page Down key", INITIAL_SCROLL_TOP + PAGE_SCROLL_DISTANCE_PX, { key: "PageDown" }],
  ["the Page Up key", INITIAL_SCROLL_TOP - PAGE_SCROLL_DISTANCE_PX, { key: "PageUp" }],
  ["the Space key", INITIAL_SCROLL_TOP + PAGE_SCROLL_DISTANCE_PX, { key: " " }],
  ["the Space key with the Shift key", INITIAL_SCROLL_TOP - PAGE_SCROLL_DISTANCE_PX, { key: " ", shiftKey: true }],
  ["the Home key", 0, { key: "Home" }],
  ["the End key", 700, { key: "End" }],
])("pressing %s while the window itself has the focus scrolls its content to %i", (_label, expectedTop, init) => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));
  scrollPane().scrollTop = INITIAL_SCROLL_TOP;

  const isDefaultAllowed = fireEvent.keyDown(screen.getByRole("region"), init);

  expect(scrollPane().scrollTop).toBe(expectedTop);
  expect(isDefaultAllowed).toBe(false);
});

test.each([
  ["the Page Down key", INITIAL_SCROLL_TOP + ARROW_STEP_PX, "PageDown"],
  ["the Page Up key", INITIAL_SCROLL_TOP - ARROW_STEP_PX, "PageUp"],
])(
  "pressing %s while the window itself has the focus scrolls a viewport shorter than `ARROW_STEP_PX` to %i",
  (_label, expectedTop, key) => {
    render(windowShowing("tall", TALL_PANE_ELEMENT));
    Object.defineProperty(scrollPane(), "clientHeight", { configurable: true, get: () => ARROW_STEP_PX / 2 });
    scrollPane().scrollTop = INITIAL_SCROLL_TOP;

    fireEvent.keyDown(screen.getByRole("region"), { key });

    expect(scrollPane().scrollTop).toBe(expectedTop);
  },
);

test.each([
  ["the Down arrow key", "ArrowDown"],
  ["the Page Down key", "PageDown"],
  ["the End key", "End"],
])("a single press of %s while the window itself has the focus plays one scroll detent", (_label, key) => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));
  vi.mocked(playScrollDetent).mockClear();

  fireEvent.keyDown(screen.getByRole("region"), { key });

  expect(playScrollDetent).toHaveBeenCalledTimes(1);
  expect(playClick).not.toHaveBeenCalled();
});

test("each repeat of a held Down arrow key plays a scroll detent", () => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));
  vi.mocked(playScrollDetent).mockClear();

  fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown", repeat: true });
  fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown", repeat: true });

  expect(scrollPane().scrollTop).toBe(ARROW_STEP_PX * 3);
  expect(playScrollDetent).toHaveBeenCalledTimes(3);
});

test.each([
  ["the Down arrow key", "ArrowDown"],
  ["the Page Down key", "PageDown"],
  ["the End key", "End"],
])("a press of %s at the end of the content plays a click sound and does not play a scroll detent", (_label, key) => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));
  scrollPane().scrollTop = 700;
  vi.mocked(playClick).mockClear();
  vi.mocked(playScrollDetent).mockClear();

  fireEvent.keyDown(screen.getByRole("region"), { key });

  expect(scrollPane().scrollTop).toBe(700);
  expect(playClick).toHaveBeenCalledTimes(1);
  expect(playScrollDetent).not.toHaveBeenCalled();
});

test("a repeat of a held Down arrow key at the end of the content does not play a click sound", () => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));
  scrollPane().scrollTop = 700;
  vi.mocked(playClick).mockClear();

  fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown", repeat: true });

  expect(playClick).not.toHaveBeenCalled();
});

test("pressing a key claimed by a handler the window's content registered does not scroll the content or play a sound", () => {
  render(windowShowing("tall", <ContentClaimingKey claimedKey="ArrowDown" />));
  scrollPane().scrollTop = INITIAL_SCROLL_TOP;
  vi.mocked(playClick).mockClear();
  vi.mocked(playScrollDetent).mockClear();

  const isDefaultAllowed = fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown" });

  expect(isDefaultAllowed).toBe(false);
  expect(scrollPane().scrollTop).toBe(INITIAL_SCROLL_TOP);
  expect(playClick).not.toHaveBeenCalled();
  expect(playScrollDetent).not.toHaveBeenCalled();
});

test("pressing a key not claimed by a handler the window's content registered still scrolls the content", () => {
  render(windowShowing("tall", <ContentClaimingKey claimedKey="ArrowDown" />));
  scrollPane().scrollTop = INITIAL_SCROLL_TOP;

  fireEvent.keyDown(screen.getByRole("region"), { key: "PageDown" });

  expect(scrollPane().scrollTop).toBe(INITIAL_SCROLL_TOP + PAGE_SCROLL_DISTANCE_PX);
});

test("the window scrolls its content for a key again once the content whose handler claimed it is replaced", () => {
  const { rerender } = render(windowShowing("claiming", <ContentClaimingKey claimedKey="ArrowDown" />));

  rerender(windowShowing("tall", TALL_PANE_ELEMENT));
  fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown" });

  expect(scrollPane().scrollTop).toBe(ARROW_STEP_PX);
});

test("pressing a key that scrolls while an element in the window's content has the focus does not scroll the content or prevent the key's default action", () => {
  render(windowShowing("tall", BUTTON_ELEMENT));
  scrollPane().scrollTop = 0;

  const isDefaultAllowed = fireEvent.keyDown(screen.getByRole("button", { name: "Button" }), { key: "ArrowDown" });

  expect(scrollPane().scrollTop).toBe(0);
  expect(isDefaultAllowed).toBe(true);
});

test("pressing a key that scrolls with the Alt key does not scroll the window's content", () => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));
  scrollPane().scrollTop = INITIAL_SCROLL_TOP;

  fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowDown", altKey: true });

  expect(scrollPane().scrollTop).toBe(INITIAL_SCROLL_TOP);
});

test("the window restores focus to its last focused element when it is activated again", () => {
  const { rerender } = render(windowShowing("tall", BUTTON_ELEMENT));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  switchAwayAndBack(rerender, "tall", BUTTON_ELEMENT);

  expect(document.activeElement).toBe(focusableElement);
});

test("the window does not restore focus to its resize control", () => {
  const { rerender } = render(windowShowing("tall", BUTTON_ELEMENT));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();
  screen.getByRole("button", { name: "Resize" }).focus();
  switchAwayAndBack(rerender, "tall", BUTTON_ELEMENT);

  expect(document.activeElement).toBe(focusableElement);
});

test("an inactive window's title bar and content are inert, while the window itself remains a tab stop", () => {
  render(windowShowing("tall", BUTTON_ELEMENT, false));

  const windowElement = screen.getByRole("region", { name: "Window" });

  expect(windowTitleBar().closest("[inert]")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Button" }).closest("[inert]")).not.toBeNull();
  expect(windowElement.closest("[inert]")).toBeNull();
  expect(windowElement.tabIndex).toBe(0);
});

test("an inactive window is described as an inactive window, and an active window has no description", () => {
  const { rerender } = render(windowShowing("tall", BUTTON_ELEMENT, false));
  const windowElement = screen.getByRole("region", { name: "Window" });

  expect(descriptionTextOf(windowElement)).toBe("Inactive window");

  rerender(windowShowing("tall", BUTTON_ELEMENT));

  expect(windowElement.hasAttribute("aria-describedby")).toBe(false);
});

test("focusing an inactive window activates it, and its contents are no longer inert once it is active", () => {
  const onFocus = vi.fn();
  const { rerender } = render(windowShowing("tall", BUTTON_ELEMENT, false, { onFocus }));
  const windowElement = screen.getByRole("region", { name: "Window" });

  windowElement.focus();

  expect(onFocus).toHaveBeenCalledTimes(1);

  rerender(windowShowing("tall", BUTTON_ELEMENT, true, { onFocus }));

  expect(windowTitleBar().closest("[inert]")).toBeNull();
  expect(screen.getByRole("button", { name: "Button" }).closest("[inert]")).toBeNull();
  expect(document.activeElement).toBe(windowElement);
});

test("a press on an inactive window prevents the default focus behavior, while a press on an active window does not", () => {
  const { rerender } = render(windowShowing("tall", BUTTON_ELEMENT, false));
  const windowElement = screen.getByRole("region", { name: "Window" });

  fireEvent.pointerDown(windowElement);

  expect(fireEvent.mouseDown(windowElement)).toBe(false); // Activating the window restores its last focused element, so the press does not move the focus itself.

  rerender(windowShowing("tall", BUTTON_ELEMENT));
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
  const { rerender } = render(windowShowing("tall", BUTTON_ELEMENT));
  const focusableElement = screen.getByRole("button", { name: "Button" });

  focusableElement.focus();

  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Zoom" }))).toBe(false);
  expect(fireEvent.mouseDown(screen.getByRole("button", { name: "Resize" }))).toBe(false);
  expect(document.activeElement).toBe(focusableElement);

  switchAwayAndBack(rerender, "tall", BUTTON_ELEMENT);

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

  rerender(windowShowing("other", TALL_PANE_ELEMENT));

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Window" }));
});

test("a fixed-size window has neither a zoom control nor a resize control", () => {
  render(fixedSizeWindow("short", SHORT_PANE_ELEMENT));

  expect(screen.queryByRole("button", { name: "Zoom" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Resize" })).toBeNull();
});

test("the scrollbar of a fixed-size window collapses when its content does not overflow", () => {
  const { rerender } = render(fixedSizeWindow("short", SHORT_PANE_ELEMENT));

  expect(isScrollbarCollapsed()).toBe(true);

  rerender(fixedSizeWindow("tall", TALL_PANE_ELEMENT));

  expect(isScrollbarCollapsed()).toBe(false);
});

test("the scrollbar of a resizable window does not collapse when its content does not overflow", () => {
  render(windowShowing("short", SHORT_PANE_ELEMENT));

  expect(screen.queryByRole("button", { name: "Resize" })).not.toBeNull();
  expect(isScrollbarCollapsed()).toBe(false); // The scrollbar contains the resize control, so it stays open.
});

test("dragging the title bar reports the position being chosen and moves the window there once the drag ends", async () => {
  const onMove = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onMove, onDrag }));

  const titleBar = windowTitleBar();

  fireEvent.pointerDown(titleBar, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(titleBar, { clientX: 30, clientY: 10, buttons: 1 });
  await nextAnimationFrame();

  expect(onDrag).toHaveBeenLastCalledWith({ kind: "move", x: 70, y: 30 });
  expect(onMove).not.toHaveBeenCalled();

  fireEvent.pointerUp(titleBar, { clientX: 30, clientY: 10 });

  expect(onMove).toHaveBeenCalledExactlyOnceWith(70, 30);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("a secondary press on the title bar does not start a drag", async () => {
  // The browser opens its context menu instead.
  const onMove = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onMove }));

  const titleBar = windowTitleBar();

  fireEvent.pointerDown(titleBar, { clientX: 0, clientY: 0, button: 2 });
  fireEvent.pointerMove(titleBar, { clientX: 40, clientY: 40, buttons: 2 });
  await nextAnimationFrame();
  fireEvent.pointerUp(titleBar, { clientX: 40, clientY: 40 });

  expect(onMove).not.toHaveBeenCalled();
});

test("a press on the title bar that moves within the drag threshold does not report a move or move the window", async () => {
  const onMove = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onMove, onDrag }));

  await dragBy(windowTitleBar(), [2, 2]);

  expect(onDrag).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "move" }));
  expect(onMove).not.toHaveBeenCalled();
});

test("a drag that returns within the drag threshold still moves the window to the final pointer position", async () => {
  // Once past the threshold, moves inside it are still reported, so the outline stays with the pointer.
  const onMove = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onMove }));

  await dragBy(windowTitleBar(), [40, 0], [1, 0]);

  expect(onMove).toHaveBeenCalledExactlyOnceWith(41, 20);
});

test("dragging the resize control reports the size being chosen and applies it once the drag ends", async () => {
  const onResize = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onResize, onDrag }));

  const control = screen.getByRole("button", { name: "Resize" });

  fireEvent.pointerDown(control, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(control, { clientX: -50, clientY: 100, buttons: 1 });
  await nextAnimationFrame();

  expect(onDrag).toHaveBeenLastCalledWith({ kind: "resize", width: 750, height: 700 });
  expect(onResize).not.toHaveBeenCalled();

  fireEvent.pointerUp(control, { clientX: -50, clientY: 100 });

  expect(onResize).toHaveBeenCalledExactlyOnceWith(750, 700);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("the resize control clears its pressed state when the pointer moves outside it", async () => {
  render(windowShowing("tall", TALL_PANE_ELEMENT));

  const control = screen.getByRole("button", { name: "Resize" });

  vi.spyOn(control, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 16, 16));
  fireEvent.pointerDown(control, { clientX: 8, clientY: 8, button: 0 });

  expect(control.className).toContain("pressed");

  fireEvent.pointerMove(control, { clientX: 12, clientY: 12, buttons: 1 });
  await nextAnimationFrame();

  expect(control.className).toContain("pressed");

  fireEvent.pointerMove(control, { clientX: 80, clientY: 80, buttons: 1 });
  await nextAnimationFrame();

  expect(control.className).not.toContain("pressed");

  fireEvent.pointerMove(control, { clientX: 10, clientY: 10, buttons: 1 });
  await nextAnimationFrame();

  expect(control.className).not.toContain("pressed"); // Once cleared, the press state does not return even if the pointer returns to the control.

  fireEvent.pointerUp(control, { clientX: 10, clientY: 10 });

  expect(control.className).not.toContain("pressed");
});

test("a resize drag commits and clears its preview when `pointerup` is dispatched outside the control", async () => {
  const onResize = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onResize, onDrag }));

  const control = screen.getByRole("button", { name: "Resize" });

  fireEvent.pointerDown(control, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(control, { clientX: -50, clientY: 100, buttons: 1 });
  await nextAnimationFrame();

  // Pointer capture ends when the capturing element is removed from the document, so the release is
  // then dispatched to the element under the pointer rather than to the control.
  fireEvent.pointerUp(document.body, { clientX: -50, clientY: 100 });

  expect(onResize).toHaveBeenCalledExactlyOnceWith(750, 700);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("a resize drag commits and clears its preview on a `pointermove` without pressed buttons after a missed `pointerup`", async () => {
  const onResize = vi.fn();
  const onDrag = vi.fn();

  render(windowShowing("tall", TALL_PANE_ELEMENT, true, { onResize, onDrag }));

  const control = screen.getByRole("button", { name: "Resize" });

  fireEvent.pointerDown(control, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerMove(control, { clientX: -50, clientY: 100, buttons: 1 });
  await nextAnimationFrame();

  fireEvent.pointerMove(document.body, { clientX: 20, clientY: 20, buttons: 0 });

  expect(onResize).toHaveBeenCalledExactlyOnceWith(750, 700);
  expect(onDrag).toHaveBeenLastCalledWith(null);
});

test("a tap retargeted from the title bar to a control plays the press sound once", () => {
  render(windowShowing("press-sound", BUTTON_ELEMENT));

  vi.mocked(playClick).mockClear();

  fireEvent.pointerDown(windowTitleBar(), { clientX: 0, clientY: 0, button: 0 }); // The touch press.
  fireEvent.pointerUp(windowTitleBar(), { clientX: 0, clientY: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Close" }), { detail: 1 });

  // iOS can retarget a tap near a control to the control, but only the click event follows. The
  // touch pointer events stay with the element under the finger, which plays the press sound.
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a press on a title bar control plays the press sound once", () => {
  render(windowShowing("control-sound", BUTTON_ELEMENT));

  const close = screen.getByRole("button", { name: "Close" });

  vi.mocked(playClick).mockClear();

  fireEvent.pointerDown(close, { clientX: 0, clientY: 0, button: 0 });
  fireEvent.pointerUp(close, { clientX: 0, clientY: 0 });
  fireEvent.click(close, { detail: 1 });

  expect(playClick).toHaveBeenCalledTimes(1);
});
