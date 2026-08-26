import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClick } from "#/lib/audio/sounds";

import { Button } from "./button";

import type { RefObject } from "react";

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => vi.mocked(playClick).mockClear());

const MOUSE = { pointerType: "mouse" };
const CLICK = { detail: 1 };

test("forwards native disabled, autofocus, and accessibility props", () => {
  render(
    <>
      <Button disabled aria-describedby="disabled-description">
        Disabled
      </Button>
      <Button autoFocus aria-describedby="focused-description">
        Focused
      </Button>
    </>,
  );

  const disabledButton = screen.getByRole("button", { name: "Disabled" });

  expect(disabledButton.getAttribute("type")).toBe("button");
  expect(disabledButton.hasAttribute("disabled")).toBe(true);
  expect(disabledButton.getAttribute("aria-describedby")).toBe("disabled-description");

  const focusedButton = screen.getByRole("button", { name: "Focused" });

  expect(focusedButton.getAttribute("type")).toBe("button");
  expect(focusedButton.hasAttribute("disabled")).toBe(false);
  expect(focusedButton.getAttribute("aria-describedby")).toBe("focused-description");
  expect(document.activeElement).toBe(focusedButton);
});

test("an href renders an anchor, which still applies autoFocus", () => {
  render(
    <Button autoFocus href="/">
      Go Home
    </Button>,
  );

  const link = screen.getByRole("link", { name: "Go Home" });

  expect(link.getAttribute("href")).toBe("/");
  expect(link.hasAttribute("type")).toBe(false);
  expect(document.activeElement).toBe(link);
});

test("both variants populate a caller-supplied ref, and the anchor still applies autoFocus", () => {
  const buttonRef: RefObject<HTMLButtonElement | null> = { current: null };
  const linkRef: RefObject<HTMLAnchorElement | null> = { current: null };

  render(
    <>
      <Button ref={buttonRef}>Button</Button>
      <Button ref={linkRef} autoFocus href="/">
        Anchor
      </Button>
    </>,
  );

  expect(buttonRef.current).toBe(screen.getByRole("button", { name: "Button" }));
  expect(linkRef.current).toBe(screen.getByRole("link", { name: "Anchor" }));
  expect(document.activeElement).toBe(linkRef.current);
});

test("a press plays a single click sound, on the press itself", () => {
  render(<Button>Press</Button>);

  const button = screen.getByRole("button", { name: "Press" });

  fireEvent.pointerDown(button, MOUSE);
  fireEvent.pointerUp(button, MOUSE);
  fireEvent.click(button, CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a tap whose touch pointer events do not reach the button still plays a click sound", () => {
  render(<Button>Press</Button>);

  fireEvent.click(screen.getByRole("button", { name: "Press" }), CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});
