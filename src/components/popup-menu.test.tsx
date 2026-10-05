import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playClickSound, playHoverSound } from "#/lib/audio/sounds.ts";
import { movePointerOver, releasePointerOver, runActivationFlash } from "#/test-utils/menu.ts";

import { PopupMenu } from "./popup-menu.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  Reflect.deleteProperty(document, "elementFromPoint");
});

const OPTIONS = [
  { value: "first", label: "First" },
  { value: "second", label: "Second" },
  { value: "third", label: "Third" },
] as const;
const PRESS_ORIGIN = { clientX: 10, clientY: 10 };
const POINT_PAST_DRAG_THRESHOLD = { clientX: 100, clientY: 100 }; // Past the drag threshold from `PRESS_ORIGIN`.

const button = () => screen.getByRole("button", { name: /^A menu / });
const listbox = () => screen.queryByRole("listbox", { name: "A menu" });
const optionNamed = (name: string) => screen.getByRole("option", { name });

function renderPopupMenu(onChange: (value: string) => void = () => undefined) {
  render(<PopupMenu value="second" options={OPTIONS} aria-label="A menu" onChange={onChange} />);
}

function pressButton(pointerType = "mouse") {
  fireEvent.pointerDown(button(), { pointerType, button: 0, isPrimary: true, ...PRESS_ORIGIN });
  fireEvent.mouseDown(button(), { button: 0 });
}

test("a pop-up menu renders a collapsed button with a `listbox` popup, named by its `aria-label` prop followed by the chosen option", () => {
  renderPopupMenu();

  expect(screen.getByRole("button", { name: "A menu Second" }).getAttribute("aria-haspopup")).toBe("listbox");
  expect(button().getAttribute("aria-expanded")).toBe("false");
  expect(listbox()).toBeNull();
});

test("pressing the button plays the click sound and opens a listbox of the options, named by its `aria-label` prop, with the chosen option selected and focused", () => {
  renderPopupMenu();
  pressButton();

  const options = listbox()!;

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(button().getAttribute("aria-expanded")).toBe("true");
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["First", "Second", "Third"]);
  expect(optionNamed("Second").getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(options);
  expect(options.getAttribute("aria-activedescendant")).toBe(optionNamed("Second").id);
});

test("a pop-up menu sets the `--popup-menu-chosen-option-index` and `--popup-menu-option-count` custom properties of its listbox to the index of the chosen option and the number of options", () => {
  renderPopupMenu();
  pressButton();

  const { style } = listbox()!;

  expect(style.getPropertyValue("--popup-menu-chosen-option-index")).toBe("1");
  expect(style.getPropertyValue("--popup-menu-option-count")).toBe("3");
});

test("releasing the press that opened the options without moving leaves them open, even over an option", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  pressButton();
  releasePointerOver(optionNamed("First"), PRESS_ORIGIN);
  runActivationFlash();

  expect(listbox()).not.toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test("releasing a press held from the button over another option plays the click sound, and calls `onChange` once its activation flash is complete", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  pressButton();
  vi.mocked(playClickSound).mockClear();
  releasePointerOver(optionNamed("Third"), POINT_PAST_DRAG_THRESHOLD);

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();

  runActivationFlash();

  expect(onChange).toHaveBeenCalledWith("third");
});

test("choosing an option closes the options and focuses the button", () => {
  renderPopupMenu();
  pressButton();
  releasePointerOver(optionNamed("Third"), POINT_PAST_DRAG_THRESHOLD);
  runActivationFlash();

  expect(listbox()).toBeNull();
  expect(document.activeElement).toBe(button());
});

test("releasing a touch press held from the button over another option chooses it", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  pressButton("touch");
  releasePointerOver(optionNamed("First"), POINT_PAST_DRAG_THRESHOLD);
  runActivationFlash();

  expect(onChange).toHaveBeenCalledWith("first");
});

test("a touch press releases the implicit pointer capture on the button", () => {
  renderPopupMenu();

  vi.spyOn(button(), "hasPointerCapture").mockReturnValue(true);

  const releasePointerCapture = vi.spyOn(button(), "releasePointerCapture");

  fireEvent.pointerDown(button(), { pointerId: 7, pointerType: "touch", button: 0, isPrimary: true });

  expect(releasePointerCapture).toHaveBeenCalledWith(7);
});

test("the option under the pointer is focused only once the press that opened the options moves past the drag threshold", () => {
  renderPopupMenu();
  pressButton();
  movePointerOver(optionNamed("First"), PRESS_ORIGIN);

  expect(listbox()!.getAttribute("aria-activedescendant")).toBe(optionNamed("Second").id);

  movePointerOver(optionNamed("First"), POINT_PAST_DRAG_THRESHOLD);

  expect(listbox()!.getAttribute("aria-activedescendant")).toBe(optionNamed("First").id);
});

test("releasing the pointer over the listbox but not over an option leaves the options open", () => {
  renderPopupMenu();
  fireEvent.click(button());
  releasePointerOver(listbox()!, POINT_PAST_DRAG_THRESHOLD);
  runActivationFlash();

  expect(listbox()).not.toBeNull();
});

test("a click on the button without a preceding press opens the options", () => {
  renderPopupMenu();
  fireEvent.click(button()); // The keyboard, assistive technology, and a tap that iOS retargets to the button each click it without a press.

  expect(listbox()).not.toBeNull();
});

test("pressing and releasing an option chooses it once the options are open", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  fireEvent.click(button());
  fireEvent.pointerDown(optionNamed("First"), { button: 0 });
  releasePointerOver(optionNamed("First"), PRESS_ORIGIN);
  runActivationFlash();

  expect(onChange).toHaveBeenCalledWith("first");
});

test("choosing the option already chosen closes the options without calling `onChange`", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  fireEvent.click(button());
  fireEvent.keyDown(listbox()!, { key: "Enter" });
  runActivationFlash();

  expect(listbox()).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

test.each([
  ["Down", "ArrowDown"],
  ["Up", "ArrowUp"],
])("pressing the %s arrow key on the button plays the click sound and opens the options", (_direction, key) => {
  renderPopupMenu();
  fireEvent.keyDown(button(), { key });

  expect(playClickSound).toHaveBeenCalledOnce();
  expect(listbox()).not.toBeNull();
});

test("the Down arrow key moves the focus to the next option, playing the hover sound, and the Enter key chooses the focused option", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  fireEvent.click(button());
  fireEvent.keyDown(listbox()!, { key: "ArrowDown" });

  expect(listbox()!.getAttribute("aria-activedescendant")).toBe(optionNamed("Third").id);
  expect(playHoverSound).toHaveBeenCalledOnce();

  fireEvent.keyDown(listbox()!, { key: "Enter" });
  runActivationFlash();

  expect(onChange).toHaveBeenCalledWith("third");
});

test("a click on an option without a pointer press, as an assistive technology sends, chooses it", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  fireEvent.click(button());
  fireEvent.click(optionNamed("Third"));
  runActivationFlash();

  expect(onChange).toHaveBeenCalledWith("third");
});

test.each([
  ["Home", "First"],
  ["End", "Third"],
])("the %s key focuses the option at that end of the options", (key, expectedOption) => {
  renderPopupMenu();
  fireEvent.click(button());
  fireEvent.keyDown(listbox()!, { key });

  expect(listbox()!.getAttribute("aria-activedescendant")).toBe(optionNamed(expectedOption).id);
});

test("typing a letter focuses the next option that starts with it", () => {
  renderPopupMenu();
  fireEvent.click(button());
  fireEvent.keyDown(listbox()!, { key: "f" });

  expect(listbox()!.getAttribute("aria-activedescendant")).toBe(optionNamed("First").id);
});

test("the Escape key closes the options without calling `onChange`, and focuses the button", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  fireEvent.click(button());
  fireEvent.keyDown(listbox()!, { key: "Escape" });

  expect(listbox()).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(button());
});

test("the Tab key closes the options without calling `onChange`, and focuses the button", () => {
  const onChange = vi.fn();

  renderPopupMenu(onChange);
  fireEvent.click(button());
  fireEvent.keyDown(listbox()!, { key: "Tab" });

  expect(listbox()).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(button());
});

test("a press outside the open options closes them", () => {
  renderPopupMenu();
  fireEvent.click(button());
  fireEvent.pointerDown(document.body);

  expect(listbox()).toBeNull();
});

test("a scroll anywhere on the page closes the options", () => {
  renderPopupMenu();
  fireEvent.click(button());
  fireEvent.scroll(document);

  expect(listbox()).toBeNull();
});
