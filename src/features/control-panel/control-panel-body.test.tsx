import { fireEvent, render, screen } from "@testing-library/react";
import { THEME_DEFAULTS } from "virtual:theme-defaults";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { resetThemeTint, setAppearance, setSoundEffects } from "#/lib/settings/settings.ts";
import { releasePointerOver, runActivationFlash } from "#/test-utils/menu.ts";

import { ControlPanelBody } from "./control-panel-body.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => vi.mocked(playClickSound).mockClear());

afterEach(() => {
  vi.useRealTimers();
  setAppearance("system");
  resetThemeTint();
  setSoundEffects("on");
  localStorage.clear();
  root.removeAttribute("style");
  Reflect.deleteProperty(document, "elementFromPoint");
});

const root = document.documentElement;

const themeColorButton = () => screen.getByRole("button", { name: /^Theme colour/ });
const saturationSlider = () => screen.getByRole("slider", { name: "Saturation" });

function chooseThemeColor(label: string) {
  vi.useFakeTimers();
  fireEvent.click(themeColorButton());
  releasePointerOver(screen.getByRole("option", { name: label }));
  runActivationFlash();
}

test("choosing an appearance applies and stores it", () => {
  render(<ControlPanelBody />);
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

  expect(screen.getByRole("radio", { name: "Dark", checked: true })).toBeTruthy();
  expect(root.getAttribute("data-appearance")).toBe("dark");
  expect(localStorage.getItem("appearance")).toBe("dark");
});

test("choosing a theme color applies and stores it", () => {
  render(<ControlPanelBody />);
  chooseThemeColor("Green");

  expect(screen.getByRole("button", { name: "Theme colour: Green" })).toBeTruthy();
  expect(root.getAttribute("data-theme-color")).toBe("green");
  expect(localStorage.getItem("theme-color")).toBe("green");
});

test("moving the `Saturation` slider applies and stores the theme chroma scale", () => {
  render(<ControlPanelBody />);
  fireEvent.change(saturationSlider(), { target: { value: "1.5" } });

  expect(saturationSlider().getAttribute("aria-valuetext")).toBe("150%");
  expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("1.5");
  expect(localStorage.getItem("theme-chroma-scale")).toBe("1.5");
});

test("pressing the `Use Defaults` button returns every setting to its default and removes the stored values", () => {
  render(<ControlPanelBody />);
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  chooseThemeColor("Green");
  fireEvent.change(saturationSlider(), { target: { value: "1.5" } });
  fireEvent.click(screen.getByRole("radio", { name: "Off" }));
  fireEvent.click(screen.getByRole("button", { name: "Use Defaults" }));

  expect(screen.getByRole("radio", { name: "System", checked: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Theme colour: Purple" })).toBeTruthy();
  expect(saturationSlider().getAttribute("value")).toBe(String(THEME_DEFAULTS.chromaScale));
  expect(screen.getByRole("radio", { name: "On", checked: true })).toBeTruthy();
  expect(root.hasAttribute("data-appearance")).toBe(false);
  expect(root.hasAttribute("data-theme-color")).toBe(false);
  expect(root.style.getPropertyValue("--theme-chroma-scale")).toBe("");
  expect(localStorage.length).toBe(0);
});

test("pressing the `Use Defaults` button while sound effects are off plays the click sound once it turns them on", () => {
  setSoundEffects("off");
  render(<ControlPanelBody />);
  fireEvent.click(screen.getByRole("button", { name: "Use Defaults" }));

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("choosing the `Off` sound effects radio button turns sound effects off without playing the click sound", () => {
  render(<ControlPanelBody />);
  fireEvent.click(screen.getByRole("radio", { name: "Off" }));

  expect(screen.getByRole("radio", { name: "Off", checked: true })).toBeTruthy();
  expect(localStorage.getItem("sound")).toBe("off");
  expect(playClickSound).not.toHaveBeenCalled();
});

test("choosing the `On` sound effects radio button turns sound effects on and plays the click sound", () => {
  setSoundEffects("off");
  render(<ControlPanelBody />);
  fireEvent.click(screen.getByRole("radio", { name: "On" }));

  expect(screen.getByRole("radio", { name: "On", checked: true })).toBeTruthy();
  expect(playClickSound).toHaveBeenCalledOnce();
});
