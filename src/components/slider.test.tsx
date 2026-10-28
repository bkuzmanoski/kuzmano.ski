import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClickSound, playSliderStepSound } from "#/lib/audio/sounds.ts";

import { Slider } from "./slider.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => {
  vi.mocked(playClickSound).mockClear();
  vi.mocked(playSliderStepSound).mockClear();
});

const renderSlider = (props: Partial<Parameters<typeof Slider>[0]> = {}) =>
  render(
    <>
      <label htmlFor="slider">A label</label>
      <Slider id="slider" value={20} min={0} max={100} step={10} onChange={() => undefined} {...props} />
    </>,
  );

test("a slider renders a native range input named by its label, with its value, range, and step", () => {
  renderSlider();

  const slider = screen.getByRole("slider", { name: "A label" });

  expect(slider.getAttribute("value")).toBe("20");
  expect(slider.getAttribute("min")).toBe("0");
  expect(slider.getAttribute("max")).toBe("100");
  expect(slider.getAttribute("step")).toBe("10");
});

test("a slider renders a tick mark for each step, including both ends", () => {
  const { container } = renderSlider();
  expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(11);
});

test("changing the value calls `onChange` with the new value as a number and plays the slider step sound", () => {
  const onChange = vi.fn();

  renderSlider({ onChange });
  fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });

  expect(onChange).toHaveBeenCalledWith(30);
  expect(playSliderStepSound).toHaveBeenCalledOnce();
});

test("pressing a slider with the mouse plays the click sound", () => {
  renderSlider();
  fireEvent.pointerDown(screen.getByRole("slider"), { pointerType: "mouse", button: 0, isPrimary: true });

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a slider sets the `aria-valuetext` attribute to the text `valueTextOf` returns for its value", () => {
  renderSlider({ valueTextOf: (value) => `${value} units` });
  expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("20 units");
});

test("a slider sets the `--slider-value-fraction` custom property to the position of its value as a fraction of its range", () => {
  const { container } = renderSlider();
  const slider = container.querySelector<HTMLElement>("[style]")!;

  expect(slider.style.getPropertyValue("--slider-value-fraction")).toBe("0.2");
});

test("a slider with the `disabled` prop renders a disabled native range input", () => {
  renderSlider({ disabled: true });
  expect(screen.getByRole("slider").hasAttribute("disabled")).toBe(true);
});
