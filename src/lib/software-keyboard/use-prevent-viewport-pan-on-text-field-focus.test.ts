import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { stubMatchMedia } from "#/test-utils/match-media.ts";

import { usePreventViewportPanOnTextFieldFocus } from "./use-prevent-viewport-pan-on-text-field-focus.ts";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { scrollIntoViewSilently }),
);

const IPHONE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const MAC_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

const stubUserAgent = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);

let viewport: EventTarget & { scale: number };
let textInput: HTMLInputElement;
let setIsTouchOnly: (matches: boolean) => void;

beforeEach(() => {
  vi.useFakeTimers();
  viewport = Object.assign(new EventTarget(), { scale: 1 });
  vi.stubGlobal("visualViewport", viewport);
  stubUserAgent(IPHONE_USER_AGENT);
  setIsTouchOnly = stubMatchMedia();
  setIsTouchOnly(true);
  textInput = document.createElement("input");
  textInput.id = "field";
  textInput.name = "field";
  textInput.className = "control";
  textInput.value = "Value";
  document.body.append(textInput);
});

afterEach(() => {
  vi.useRealTimers();
  scrollIntoViewSilently.mockClear();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("style");
  Reflect.deleteProperty(navigator, "maxTouchPoints");
});

const isFieldAway = () => textInput.style.transform === "translateY(-2000px)";
const standInElement = () => document.querySelector<HTMLInputElement>("input[inert]");
const resizeViewport = () => viewport.dispatchEvent(new Event("resize"));

describe("usePreventViewportPanOnTextFieldFocus", () => {
  test("moves a text field above the viewport as it gains the focus, and returns it in the animation frame after the visual viewport resizes", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(isFieldAway()).toBe(true);

    resizeViewport();

    expect(isFieldAway()).toBe(true);

    vi.advanceTimersToNextFrame();

    expect(isFieldAway()).toBe(false);
  });

  test("returns a text field after the software keyboard show timeout when the visual viewport does not resize", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    vi.advanceTimersByTime(599);

    expect(isFieldAway()).toBe(true);

    vi.advanceTimersByTime(1);

    expect(isFieldAway()).toBe(false);
  });

  test("returns a text field two animation frames after it gains the focus while the software keyboard is shown", () => {
    document.documentElement.style.setProperty("--viewport-height-above-software-keyboard", "500px");
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    vi.advanceTimersToNextFrame();

    expect(isFieldAway()).toBe(true);

    vi.advanceTimersToNextFrame();

    expect(isFieldAway()).toBe(false);
  });

  test("returns a text field when it receives a `beforeinput` event before the visual viewport resizes", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    textInput.dispatchEvent(new InputEvent("beforeinput"));

    expect(isFieldAway()).toBe(false);
  });

  test("returns a text field when it loses the focus before the visual viewport resizes", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    textInput.blur();

    expect(isFieldAway()).toBe(false);
  });

  test("places an inert stand-in element with the value and classes of a text field before the field while the field is above the viewport, and removes the stand-in element when the field returns", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(textInput.previousElementSibling).toBe(standInElement());
    expect(standInElement()).toMatchObject({ value: "Value", className: "control" });

    vi.advanceTimersByTime(600);

    expect(standInElement()).toBeNull();
  });

  test("omits the `id` and `name` attributes from the stand-in element", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(standInElement()?.hasAttribute("id")).toBe(false);
    expect(standInElement()?.hasAttribute("name")).toBe(false);
  });

  test("restores the `style` attribute of a text field with one when the field returns", () => {
    textInput.setAttribute("style", "color: red;");
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    vi.advanceTimersByTime(600);

    expect(textInput.getAttribute("style")).toBe("color: red;");
  });

  test("removes the `style` attribute from a text field without one when the field returns", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    vi.advanceTimersByTime(600);

    expect(textInput.hasAttribute("style")).toBe(false);
  });

  test("scrolls a text field into view once, in the animation frame after the field returns", () => {
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();
    resizeViewport();
    vi.advanceTimersToNextFrame();

    expect(scrollIntoViewSilently).not.toHaveBeenCalled();

    vi.advanceTimersToNextFrame();
    vi.advanceTimersByTime(600);

    expect(scrollIntoViewSilently).toHaveBeenCalledExactlyOnceWith(textInput);
  });

  test("moves a text field above the viewport as it gains the focus on an iPad that reports the user agent of a Mac", () => {
    stubUserAgent(MAC_USER_AGENT);
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(isFieldAway()).toBe(true);
  });

  test("leaves a text field in place as it gains the focus on a Mac", () => {
    stubUserAgent(MAC_USER_AGENT);
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(isFieldAway()).toBe(false);
  });

  test("leaves a text field in place as it gains the focus while the user has zoomed the page in", () => {
    viewport.scale = 2;
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(isFieldAway()).toBe(false);
  });

  test("leaves a text field in place as it gains the focus on a device with a pointer that can hover", () => {
    setIsTouchOnly(false);
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    textInput.focus();

    expect(isFieldAway()).toBe(false);
  });

  test("leaves a button in place as it gains the focus", () => {
    const button = document.createElement("button");

    document.body.append(button);
    renderHook(() => usePreventViewportPanOnTextFieldFocus());
    button.focus();

    expect(button.hasAttribute("style")).toBe(false);
  });
});
