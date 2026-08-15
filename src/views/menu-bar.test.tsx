import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { WindowId } from "#/lib/window-manager";

import { MenuBar } from "./menu-bar";

let focusedWindow: WindowId | null = null;

vi.mock("#/lib/window-manager", async () =>
  (await import("#/test-utils/window-manager-mock")).windowManagerMock({
    actions: { open: vi.fn(), close: vi.fn() },
    focusedWindow: () => focusedWindow,
  }),
);

beforeEach(() => {
  focusedWindow = null;
});

const openMenu = () => document.querySelector('[role="menu"]');
const highlightedItem = () =>
  document.querySelector('[role="menuitem"][class*="active"]')?.querySelector("span")?.textContent;
const title = (label: string) => screen.getByText(label);
const isExpanded = (label: string) => title(label).getAttribute("aria-expanded") === "true";

function openWithPointer(label: string) {
  fireEvent.pointerDown(title(label));
  return fireEvent.mouseDown(title(label));
}

function openWithKeyboard(label: string) {
  title(label).focus();
  fireEvent.keyDown(title(label), { key: "Enter" });
}

describe("opening a menu", () => {
  test("the menu takes the focus when opened via mouse or keyboard", () => {
    render(<MenuBar />);
    openWithKeyboard("Go");
    expect(document.activeElement).toBe(openMenu());

    fireEvent.keyDown(openMenu()!, { key: "Escape" });
    openWithPointer("Go");
    expect(document.activeElement).toBe(openMenu());
  });

  test("a press does not let the browser focus the menu title", () => {
    render(<MenuBar />);
    expect(openWithPointer("Go")).toBe(false);
  });

  test("a press on another title opens its menu on that same press", () => {
    render(<MenuBar />);

    openWithPointer("File");
    fireEvent(title("File"), new MouseEvent("pointerup", { bubbles: true })); // Ends the hold, as a touch tap does.
    fireEvent.pointerDown(title("Go"));
    fireEvent(document, new MouseEvent("pointerdown", { bubbles: true }));

    expect(isExpanded("File")).toBe(false);
    expect(isExpanded("Go")).toBe(true);
  });

  test("a press that closes the menu leaves the focus on the menu title", () => {
    render(<MenuBar />);

    openWithPointer("Go");
    openWithPointer("Go");

    expect(openMenu()).toBeNull();
    expect(document.activeElement).toBe(title("Go"));
  });
});

describe("holding the pointer across the menu bar", () => {
  test("moving onto another title opens its menu in place", () => {
    render(<MenuBar />);

    openWithPointer("File");
    fireEvent.pointerOver(title("Go"), { buttons: 1 });

    expect(isExpanded("File")).toBe(false);
    expect(isExpanded("Go")).toBe(true);
  });

  test("a cancelled gesture ends the hold, leaving the menu open for the next press", () => {
    render(<MenuBar />);

    openWithPointer("Go");
    fireEvent(document, new Event("pointercancel", { bubbles: true }));

    // The hold is over, so this release belongs to no gesture and must not close the menu.
    fireEvent(document, new MouseEvent("pointerup", { bubbles: true }));
    expect(openMenu()).not.toBeNull();

    fireEvent(document, new MouseEvent("pointerdown", { bubbles: true }));
    expect(openMenu()).toBeNull();
  });

  test("a press gives up the implicit capture that would keep a touch pointer on one title", () => {
    render(<MenuBar />);

    const anchor = title("File");

    vi.spyOn(anchor, "hasPointerCapture").mockReturnValue(true);
    const releasePointerCapture = vi.spyOn(anchor, "releasePointerCapture");

    fireEvent.pointerDown(anchor, { pointerId: 7, pointerType: "touch" });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });
});

describe("dismissing a menu", () => {
  test("a press elsewhere on the page closes it", () => {
    render(<MenuBar />);

    openWithPointer("Go");
    fireEvent(title("Go"), new MouseEvent("pointerup", { bubbles: true })); // Ends the hold, leaving the menu open.
    fireEvent(document, new MouseEvent("pointerdown", { bubbles: true }));

    expect(openMenu()).toBeNull();
  });

  test("a hold released away from the menu and its title closes it", () => {
    render(<MenuBar />);

    openWithPointer("Go");
    fireEvent(document, new MouseEvent("pointerup", { bubbles: true }));

    expect(openMenu()).toBeNull();
  });
});

describe("navigating an open menu", () => {
  test("the up and down keys cycle the menu items", () => {
    render(<MenuBar />);

    openWithPointer("Go");

    fireEvent.keyDown(openMenu()!, { key: "ArrowDown" });
    expect(highlightedItem()).toBe("About");

    fireEvent.keyDown(openMenu()!, { key: "ArrowDown" });
    expect(highlightedItem()).not.toBe("About");

    fireEvent.keyDown(openMenu()!, { key: "ArrowUp" });
    expect(highlightedItem()).toBe("About");
  });

  test("the up key enters a freshly opened menu at its last item", () => {
    render(<MenuBar />);

    openWithPointer("Go");

    fireEvent.keyDown(openMenu()!, { key: "ArrowUp" });
    expect(highlightedItem()).toBe("Contact");
  });

  test("the left and right keys walk the menu bar, wrapping around", () => {
    render(<MenuBar />);

    openWithKeyboard("File");

    fireEvent.keyDown(openMenu()!, { key: "ArrowRight" });
    expect(isExpanded("File")).toBe(false);
    expect(isExpanded("Go")).toBe(true);

    fireEvent.keyDown(openMenu()!, { key: "ArrowRight" });
    expect(isExpanded("Special")).toBe(true);

    fireEvent.keyDown(openMenu()!, { key: "ArrowRight" });
    expect(isExpanded("File")).toBe(true);

    fireEvent.keyDown(openMenu()!, { key: "ArrowLeft" });
    expect(isExpanded("Special")).toBe(true);
  });

  test("the menu walked to is itself navigable", () => {
    render(<MenuBar />);

    openWithKeyboard("File");
    fireEvent.keyDown(openMenu()!, { key: "ArrowRight" });

    expect(document.activeElement).toBe(openMenu());

    fireEvent.keyDown(openMenu()!, { key: "ArrowDown" });
    expect(highlightedItem()).toBe("About");
  });

  test("the escape key closes the menu and returns the focus to its title", () => {
    render(<MenuBar />);

    openWithKeyboard("Go");
    fireEvent.keyDown(openMenu()!, { key: "Escape" });

    expect(openMenu()).toBeNull();
    expect(document.activeElement).toBe(title("Go"));
  });

  test("reports the highlighted item to assistive technology", () => {
    render(<MenuBar />);

    openWithKeyboard("Go");

    const menu = openMenu()!;
    expect(menu.getAttribute("aria-activedescendant")).toBeNull();

    fireEvent.keyDown(menu, { key: "ArrowDown" });

    const activeItemId = menu.getAttribute("aria-activedescendant");
    expect(activeItemId).not.toBeNull();
    expect(document.getElementById(activeItemId!)?.getAttribute("role")).toBe("menuitem");
    expect(document.getElementById(activeItemId!)?.textContent).toContain("About");

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.getElementById(menu.getAttribute("aria-activedescendant")!)?.textContent).toContain("Contact");
  });
});

describe("navigating the closed menu bar", () => {
  test("the left and right keys move the focus between menu titles without opening their menus", () => {
    render(<MenuBar />);

    title("File").focus();
    fireEvent.keyDown(title("File"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(title("Go"));
    expect(openMenu()).toBeNull();
  });
});

describe("disabled items", () => {
  test("do not take the highlight on hover", () => {
    render(<MenuBar />);

    openWithKeyboard("File");

    const menuItem = screen.getByRole("menuitem");
    const initialClassName = menuItem.className;

    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => menuItem });
    fireEvent(document, new MouseEvent("pointermove", { bubbles: true }));

    expect(menuItem.getAttribute("aria-disabled")).toBe("true");
    expect(menuItem.className).toBe(initialClassName);
  });
});
