import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";

import { RadioGroup } from "./radio-group.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => vi.mocked(playClickSound).mockClear());

const OPTIONS = [
  { value: "first", label: "First" },
  { value: "second", label: "Second" },
] as const;

const renderRadioGroup = (props: Partial<Parameters<typeof RadioGroup<"first" | "second">>[0]> = {}) =>
  render(
    <>
      <span id="label">A label</span>
      <RadioGroup value="first" options={OPTIONS} onChange={() => undefined} aria-labelledby="label" {...props} />
    </>,
  );

function renderRadioGroupOfWidth(radioGroupWidth: number) {
  const getBoundingClientRect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return new DOMRect(0, 0, this.getAttribute("role") === "radiogroup" ? radioGroupWidth : 100, 30); // Renders the group with two 100-pixel radio buttons and a 16-pixel gap, which make a 216-pixel row.
  });
  const getComputedStyle = vi
    .spyOn(window, "getComputedStyle")
    .mockReturnValue({ columnGap: "16px" } as CSSStyleDeclaration);

  renderRadioGroup();
  getBoundingClientRect.mockRestore();
  getComputedStyle.mockRestore();
}

test("a radio group renders a native radio button for each option, named by its label, and checks the one for its `value` prop", () => {
  renderRadioGroup();

  expect(screen.getByRole("radiogroup", { name: "A label" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "First", checked: true })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Second", checked: false })).toBeTruthy();
});

test("clicking an unchecked radio button calls `onChange` with its option's value", () => {
  const onChange = vi.fn();

  renderRadioGroup({ onChange });
  fireEvent.click(screen.getByRole("radio", { name: "Second" }));

  expect(onChange).toHaveBeenCalledWith("second");
});

test("pressing a radio button with the mouse plays the click sound", () => {
  renderRadioGroup();
  fireEvent.pointerDown(screen.getByRole("radio", { name: "Second" }), {
    pointerType: "mouse",
    button: 0,
    isPrimary: true,
  });

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("pressing a radio button with the mouse does not play the click sound when its option's `isSilent` is `true`", () => {
  renderRadioGroup({ options: [OPTIONS[0], { ...OPTIONS[1], isSilent: true }] });
  fireEvent.pointerDown(screen.getByRole("radio", { name: "Second" }), {
    pointerType: "mouse",
    button: 0,
    isPrimary: true,
  });
  fireEvent.click(screen.getByRole("radio", { name: "Second" }));

  expect(playClickSound).not.toHaveBeenCalled();
});

test("selecting an option with the arrow keys plays the click sound", () => {
  renderRadioGroup();
  fireEvent.keyDown(screen.getByRole("radio", { name: "First" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("radio", { name: "Second" })); // The browser selects the next radio button.

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("selecting an option with the arrow keys does not play the click sound when its `isSilent` is `true`", () => {
  renderRadioGroup({ options: [OPTIONS[0], { ...OPTIONS[1], isSilent: true }] });
  fireEvent.keyDown(screen.getByRole("radio", { name: "First" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("radio", { name: "Second" })); // The browser selects the next radio button.

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a radio group gives each of its radio buttons the same `name` attribute", () => {
  renderRadioGroup();

  const [first, second] = screen.getAllByRole<HTMLInputElement>("radio");

  expect(first!.name).not.toBe("");
  expect(first!.name).toBe(second!.name);
});

test("a radio group with the `disabled` prop renders disabled native radio buttons", () => {
  renderRadioGroup({ disabled: true });
  expect(screen.getAllByRole("radio").every((radio) => radio.hasAttribute("disabled"))).toBe(true);
});

test("a radio group as wide as its row of radio buttons omits the `data-stacked` attribute", () => {
  renderRadioGroupOfWidth(216);
  expect(screen.getByRole("radiogroup").hasAttribute("data-stacked")).toBe(false);
});

test("a radio group narrower than its row of radio buttons sets the `data-stacked` attribute", () => {
  renderRadioGroupOfWidth(215);
  expect(screen.getByRole("radiogroup").hasAttribute("data-stacked")).toBe(true);
});
