import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { DESTINATIONS } from "#/config/navigation";
import { SITE_SOURCE_URL } from "#/config/site";
import { HIDE_DELAY_MS, STATE_DISPLAY_DURATION_MS, resetTooltipState } from "#/lib/tooltip";
import type { WindowId } from "#/lib/window-manager";

import { MenuBar } from "./menu-bar";

let focusedWindow: WindowId | null = null;

const open = vi.hoisted(() => vi.fn());
const playHover = vi.hoisted(() => vi.fn());

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager")).windowManagerMock({
    actions: { open, close: vi.fn() },
    focusedWindow: () => focusedWindow,
  }),
);

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playHover }),
);

beforeEach(() => {
  focusedWindow = null;
  open.mockClear();
  playHover.mockClear();
  resetTooltipState();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "elementFromPoint"); // Restores the default stub from the test setup.
});

const menuTitle = (label: string) => screen.getByText(label);
const isExpanded = (label: string) => menuTitle(label).getAttribute("aria-expanded") === "true";
const menu = () => document.querySelector('[role="menu"]');
const menuItem = (label: string) => screen.getByText(label).closest("[data-index]")!;
const highlightedMenuItem = () =>
  document.querySelector('[role="menuitem"][class*="active"]')?.querySelector("span")?.textContent;

function openWithPointer(label: string) {
  fireEvent.pointerDown(menuTitle(label));
  return fireEvent.mouseDown(menuTitle(label));
}

function openWithKeyboard(label: string) {
  menuTitle(label).focus();
  fireEvent.keyDown(menuTitle(label), { key: "Enter" });
}

// Releases the pointer over an item, which `Menu` hit-tests for from its document `pointerup`.
function releasePointerOver(element: Element, init: MouseEventInit = {}) {
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => element });
  fireEvent(document, new MouseEvent("pointerup", { bubbles: true, ...init }));
}

const runActivationFlash = () => void act(() => vi.advanceTimersByTime(1000)); // Long enough for an item's highlight to play out.

describe("navigating the menu bar", () => {
  test("the left and right keys move the focus between menu titles without opening their menus", () => {
    render(<MenuBar />);
    menuTitle("File").focus();
    fireEvent.keyDown(menuTitle("File"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(menuTitle("Go"));
    expect(menu()).toBeNull();
  });

  test("hovering across menu titles plays a hover sound when a menu is open", () => {
    render(<MenuBar />);
    fireEvent.pointerOver(menuTitle("Go"));

    expect(playHover).not.toHaveBeenCalled();

    openWithPointer("File");
    fireEvent.pointerOver(menuTitle("Go"), { buttons: 1 });

    expect(playHover).toHaveBeenCalledTimes(1);
  });

  test("navigating to menu title using the arrow keys plays hover sound when a menu is open", () => {
    render(<MenuBar />);
    menuTitle("File").focus();
    fireEvent.keyDown(menuTitle("File"), { key: "ArrowRight" });

    expect(playHover).not.toHaveBeenCalled();

    openWithKeyboard("Go");
    fireEvent.keyDown(menu()!, { key: "ArrowRight" });

    expect(isExpanded("Special")).toBe(true);
    expect(playHover).toHaveBeenCalledTimes(1);
  });
});

describe("holding the pointer across the menu bar", () => {
  test("moving the pointer over another title opens its menu in place", () => {
    render(<MenuBar />);
    openWithPointer("File");
    fireEvent.pointerOver(menuTitle("Go"), { buttons: 1 });

    expect(isExpanded("File")).toBe(false);
    expect(isExpanded("Go")).toBe(true);
  });

  test("a cancelled gesture ends the hold, leaving the menu open for the next press", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    fireEvent(document, new Event("pointercancel", { bubbles: true }));
    fireEvent(document, new MouseEvent("pointerup", { bubbles: true })); // The hold is over, so this release belongs to no gesture and must not close the menu.

    expect(menu()).not.toBeNull();

    fireEvent(document, new MouseEvent("pointerdown", { bubbles: true }));

    expect(menu()).toBeNull();
  });

  test("a press gives up the implicit capture that would keep a touch pointer on one title", () => {
    render(<MenuBar />);

    const anchor = menuTitle("File");

    vi.spyOn(anchor, "hasPointerCapture").mockReturnValue(true);

    const releasePointerCapture = vi.spyOn(anchor, "releasePointerCapture");

    fireEvent.pointerDown(anchor, { pointerId: 7, pointerType: "touch" });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });
});

describe("opening a menu", () => {
  test("the menu takes the focus when opened via mouse or keyboard", () => {
    render(<MenuBar />);
    openWithKeyboard("Go");

    expect(document.activeElement).toBe(menu());

    fireEvent.keyDown(menu()!, { key: "Escape" });
    openWithPointer("Go");

    expect(document.activeElement).toBe(menu());
  });

  test("a press does not let the browser focus the menu title", () => {
    render(<MenuBar />);
    expect(openWithPointer("Go")).toBe(false);
  });

  test("a press on another title opens its menu on that same press", () => {
    render(<MenuBar />);
    openWithPointer("File");
    fireEvent(menuTitle("File"), new MouseEvent("pointerup", { bubbles: true })); // Ends the hold, as a touch tap does.
    fireEvent.pointerDown(menuTitle("Go"));
    fireEvent(document, new MouseEvent("pointerdown", { bubbles: true }));

    expect(isExpanded("File")).toBe(false);
    expect(isExpanded("Go")).toBe(true);
  });

  test("a press that closes the menu leaves the focus on the menu title", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    openWithPointer("Go");

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(menuTitle("Go"));
  });

  test("a secondary press leaves the menu closed, as the browser opens its own over the page", () => {
    render(<MenuBar />);
    fireEvent.pointerDown(menuTitle("File"), { button: 2 });

    expect(isExpanded("File")).toBe(false);
    expect(menu()).toBeNull();
  });
});

describe("dismissing a menu", () => {
  test("a press elsewhere on the page closes it", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    fireEvent(menuTitle("Go"), new MouseEvent("pointerup", { bubbles: true })); // Ends the hold, leaving the menu open.
    fireEvent(document, new MouseEvent("pointerdown", { bubbles: true }));

    expect(menu()).toBeNull();
  });

  test("a hold released away from the menu and its title closes it", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    fireEvent(document, new MouseEvent("pointerup", { bubbles: true }));

    expect(menu()).toBeNull();
  });
});

describe("navigating an open menu", () => {
  test("the up and down keys cycle the menu items", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    fireEvent.keyDown(menu()!, { key: "ArrowDown" });

    expect(highlightedMenuItem()).toBe("About");

    fireEvent.keyDown(menu()!, { key: "ArrowDown" });

    expect(highlightedMenuItem()).not.toBe("About");

    fireEvent.keyDown(menu()!, { key: "ArrowUp" });

    expect(highlightedMenuItem()).toBe("About");
  });

  test("the up key enters a freshly opened menu at its last item", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    fireEvent.keyDown(menu()!, { key: "ArrowUp" });

    expect(highlightedMenuItem()).toBe("Contact");
  });

  test("the left and right keys walk the menu bar, wrapping around", () => {
    render(<MenuBar />);
    openWithKeyboard("File");
    fireEvent.keyDown(menu()!, { key: "ArrowRight" });

    expect(isExpanded("File")).toBe(false);
    expect(isExpanded("Go")).toBe(true);

    fireEvent.keyDown(menu()!, { key: "ArrowRight" });

    expect(isExpanded("Special")).toBe(true);

    fireEvent.keyDown(menu()!, { key: "ArrowRight" });

    expect(isExpanded("File")).toBe(true);

    fireEvent.keyDown(menu()!, { key: "ArrowLeft" });

    expect(isExpanded("Special")).toBe(true);
  });

  test("the menu walked to is itself navigable", () => {
    render(<MenuBar />);
    openWithKeyboard("File");
    fireEvent.keyDown(menu()!, { key: "ArrowRight" });

    expect(document.activeElement).toBe(menu());

    fireEvent.keyDown(menu()!, { key: "ArrowDown" });

    expect(highlightedMenuItem()).toBe("About");
  });

  test("the escape key closes the menu and returns the focus to its title", () => {
    render(<MenuBar />);
    openWithKeyboard("Go");
    fireEvent.keyDown(menu()!, { key: "Escape" });

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(menuTitle("Go"));
  });

  test("reports the highlighted item to assistive technology", () => {
    render(<MenuBar />);
    openWithKeyboard("Go");

    const openMenu = menu()!;

    expect(openMenu.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(openMenu, { key: "ArrowDown" });

    const activeItemId = openMenu.getAttribute("aria-activedescendant");

    expect(activeItemId).not.toBeNull();
    expect(document.getElementById(activeItemId!)?.getAttribute("role")).toBe("menuitem");
    expect(document.getElementById(activeItemId!)?.textContent).toContain("About");

    fireEvent.keyDown(openMenu, { key: "ArrowUp" });

    expect(document.getElementById(openMenu.getAttribute("aria-activedescendant")!)?.textContent).toContain("Contact");
  });
});

describe("disabled items", () => {
  test("do not become highlighted on hover", () => {
    render(<MenuBar />);
    openWithKeyboard("File");

    const disabledItem = screen.getByRole("menuitem");
    const initialClassName = disabledItem.className;

    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => disabledItem });
    fireEvent(document, new MouseEvent("pointermove", { bubbles: true }));

    expect(disabledItem.getAttribute("aria-disabled")).toBe("true");
    expect(disabledItem.className).toBe(initialClassName);
  });
});

describe("items that open a destination", () => {
  test("an item with a destination is an anchor that keeps its menu item role and is not a tab stop", () => {
    render(<MenuBar />);
    openWithPointer("Go");

    const about = menuItem("About");

    expect(about.tagName).toBe("A");
    expect(about.getAttribute("role")).toBe("menuitem");
    expect(about.getAttribute("href")).toBe(DESTINATIONS.about.route);
    expect(about.getAttribute("tabindex")).toBe("-1");
  });

  test("an item without a destination is not an anchor", () => {
    render(<MenuBar />);
    openWithPointer("Special");

    expect(menuItem("Restart").tagName).toBe("DIV");
    expect(menuItem("Restart").hasAttribute("href")).toBe(false);
  });

  test("a plain click opens the destination in the page instead of following the link", () => {
    vi.useFakeTimers();
    render(<MenuBar />);
    openWithPointer("Go");

    const about = menuItem("About");

    releasePointerOver(about);

    expect(fireEvent.click(about)).toBe(false); // The default was prevented.

    runActivationFlash();

    expect(open).toHaveBeenCalledWith(DESTINATIONS.about.route);
  });

  test.each([
    ["meta", { metaKey: true }],
    ["ctrl", { ctrlKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
  ] as const)("%s-clicking an item is left for the browser to handle, and the menu stays open", (_modifier, init) => {
    render(<MenuBar />);
    openWithPointer("Go");

    const about = menuItem("About");

    releasePointerOver(about, init);

    expect(fireEvent.click(about, init)).toBe(true); // The default was not prevented.
    expect(open).not.toHaveBeenCalled();
    expect(menu()).not.toBeNull();
  });

  test("a secondary pointer up event does not activate the menu item", () => {
    vi.useFakeTimers();
    focusedWindow = "entry";
    render(<MenuBar />);
    openWithPointer("File");
    releasePointerOver(menuItem("Close"), { button: 2 });
    runActivationFlash();

    expect(menu()).not.toBeNull(); // An item that was chosen would have run and closed the menu behind it.
  });

  test("a middle click is left for the browser to handle, and the menu stays open", () => {
    render(<MenuBar />);
    openWithPointer("Go");
    releasePointerOver(menuItem("About"), { button: 1 });

    expect(open).not.toHaveBeenCalled();
    expect(menu()).not.toBeNull();
  });

  test("the enter key follows a menu item link once its activation flash is complete", () => {
    vi.useFakeTimers();
    render(<MenuBar />);
    openWithKeyboard("Special");

    const follow = vi.spyOn(menuItem("View Source") as HTMLAnchorElement, "click").mockReturnValue(undefined);

    fireEvent.keyDown(menu()!, { key: "ArrowDown" });
    fireEvent.keyDown(menu()!, { key: "Enter" });

    expect(follow).not.toHaveBeenCalled(); // The highlight runs first.

    runActivationFlash();

    expect(follow).toHaveBeenCalled();
  });

  test('the "View Source" menu item opens a new tab', () => {
    render(<MenuBar />);
    openWithPointer("Special");

    const viewSource = menuItem("View Source");

    expect(viewSource.getAttribute("href")).toBe(SITE_SOURCE_URL);
    expect(viewSource.getAttribute("target")).toBe("_blank");
  });
});

describe("status controls", () => {
  const appearanceControl = () => screen.getByRole("button", { name: /^Appearance:/ });
  const appearanceLabel = () => appearanceControl().getAttribute("aria-label");
  const tooltip = () => screen.queryByRole("tooltip");

  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  beforeEach(() => vi.useFakeTimers());

  test("a press shows the tooltip without a pointer over the control", () => {
    render(<MenuBar />);

    const before = appearanceLabel();

    fireEvent.click(appearanceControl());

    expect(appearanceLabel()).not.toBe(before);
    expect(tooltip()?.textContent).toBe(appearanceLabel());
  });

  test("the tooltip is hidden after the display duration", () => {
    render(<MenuBar />);

    fireEvent.click(appearanceControl());
    advance(STATE_DISPLAY_DURATION_MS - 1);

    expect(tooltip()?.textContent).toBe(appearanceLabel());

    advance(1);

    expect(tooltip()).toBeNull();
  });

  test("pressing again extends the tooltip display duration", () => {
    render(<MenuBar />);

    fireEvent.click(appearanceControl());
    advance(STATE_DISPLAY_DURATION_MS - 100);
    fireEvent.click(appearanceControl());
    advance(STATE_DISPLAY_DURATION_MS - 100);

    expect(tooltip()?.textContent).toBe(appearanceLabel());

    advance(100);

    expect(tooltip()).toBeNull();
  });

  test("pressing a second control hides the tooltip the first was showing", () => {
    render(<MenuBar />);

    const soundControl = screen.getByRole("button", { name: /^Sound:/ });

    fireEvent.click(appearanceControl());
    fireEvent.click(soundControl);

    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(tooltip()?.textContent).toBe(soundControl.getAttribute("aria-label"));
  });

  test("a pointer leaving hides the tooltip before the duration is up", () => {
    render(<MenuBar />);

    const wrapper = appearanceControl().parentElement!;

    fireEvent.pointerEnter(wrapper, { pointerType: "mouse" });
    fireEvent.click(appearanceControl());

    expect(tooltip()?.textContent).toBe(appearanceLabel());

    fireEvent.pointerLeave(wrapper, { pointerType: "mouse" });
    advance(HIDE_DELAY_MS);

    expect(tooltip()).toBeNull();
  });
});
