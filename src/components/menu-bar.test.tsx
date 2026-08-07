import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { MenuBar } from "./menu-bar";

let focusedWindow: string | null = null;

vi.mock("#/lib/window-manager", () => ({
  useWindowActions: () => ({ open: () => {}, close: () => {} }),
  useFocusedWindow: () => focusedWindow,
}));

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

  test("a press that closes the menu leaves the focus on the menu title", () => {
    render(<MenuBar />);

    openWithPointer("Go");
    openWithPointer("Go");

    expect(openMenu()).toBeNull();
    expect(document.activeElement).toBe(title("Go"));
  });
});

describe("navigating an open menu", () => {
  test("up and down keys cycle the menu items", () => {
    render(<MenuBar />);

    openWithPointer("Go");

    fireEvent.keyDown(openMenu()!, { key: "ArrowDown" });
    expect(highlightedItem()).toBe("About");

    fireEvent.keyDown(openMenu()!, { key: "ArrowDown" });
    expect(highlightedItem()).not.toBe("About");

    fireEvent.keyDown(openMenu()!, { key: "ArrowUp" });
    expect(highlightedItem()).toBe("About");
  });

  test("left and right keys walk the menu bar, wrapping around", () => {
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

  test("escape closes the menu and returns the focus to its title", () => {
    render(<MenuBar />);

    openWithKeyboard("Go");
    fireEvent.keyDown(openMenu()!, { key: "Escape" });

    expect(openMenu()).toBeNull();
    expect(document.activeElement).toBe(title("Go"));
  });
});

describe("navigating the closed menu bar", () => {
  test("left and right keys move the focus between menu titles without opening their menus", () => {
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
