import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClick } from "#/lib/audio/sounds.ts";

import { Button } from "./button.tsx";

import type { MouseEvent, RefObject } from "react";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => vi.mocked(playClick).mockClear());

const MOUSE = { pointerType: "mouse" };
const CLICK = { detail: 1 };

test("a button forwards the `disabled`, `autoFocus`, and `aria-describedby` props", () => {
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

test("a button applies a caller's class alongside its own", () => {
  render(
    <>
      <Button className="caller">Button</Button>
      <Button className="caller" href="/somewhere">
        Link
      </Button>
    </>,
  );

  for (const name of ["Button", "Link"]) {
    const control = screen.getByRole(name === "Link" ? "link" : "button", { name });

    expect(control.className).toContain("caller");
    expect(control.className.split(" ").length).toBeGreaterThan(1); // The component's own class is a CSS module hash.
  }
});

test("a button with an `href` prop renders an anchor, which still applies the `autoFocus` prop", () => {
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

test("both variants populate a caller-supplied ref", () => {
  const buttonRef: RefObject<HTMLButtonElement | null> = { current: null };
  const linkRef: RefObject<HTMLAnchorElement | null> = { current: null };

  render(
    <>
      <Button ref={buttonRef}>Button</Button>
      <Button ref={linkRef} href="/">
        Anchor
      </Button>
    </>,
  );

  expect(buttonRef.current).toBe(screen.getByRole("button", { name: "Button" }));
  expect(linkRef.current).toBe(screen.getByRole("link", { name: "Anchor" }));
});

test("an anchor with a caller-supplied ref still applies the `autoFocus` prop", () => {
  const linkRef: RefObject<HTMLAnchorElement | null> = { current: null };

  render(
    <Button ref={linkRef} autoFocus href="/">
      Anchor
    </Button>,
  );

  expect(document.activeElement).toBe(linkRef.current); // The anchor merges the caller's ref with the one that applies `autoFocus`.
});

test("a press and the click that follows it play a single click sound", () => {
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

test("a button and a link activated with the keyboard each play a click sound", () => {
  render(
    <>
      <Button>Button</Button>
      <Button href="/somewhere">Link</Button>
    </>,
  );

  const button = screen.getByRole("button", { name: "Button" });
  const link = screen.getByRole("link", { name: "Link" });

  fireEvent.keyDown(button, { key: " " });
  fireEvent.click(button);
  fireEvent.keyDown(link, { key: "Enter" });

  expect(playClick).toHaveBeenCalledTimes(2);
});

test("a button with an `href` prop is activated with the Enter or Space key", () => {
  const onClick = vi.fn((event: MouseEvent) => event.preventDefault());

  render(
    <Button href="/somewhere" onClick={onClick}>
      Link
    </Button>,
  );

  const link = screen.getByRole("link", { name: "Link" });

  expect(fireEvent.keyDown(link, { key: "Enter" })).toBe(false);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(fireEvent.keyDown(link, { key: " " })).toBe(false); // Default behavior is prevented to keep a Space key press from scrolling.
  expect(onClick).toHaveBeenCalledTimes(2);
});

test("a button with an `href` prop defers a repeated or modified activation key press to the browser", () => {
  const onClick = vi.fn((event: MouseEvent) => event.preventDefault());

  render(
    <Button href="/somewhere" onClick={onClick}>
      Link
    </Button>,
  );

  const link = screen.getByRole("link", { name: "Link" });

  fireEvent.keyDown(link, { key: "Enter", repeat: true });

  expect(fireEvent.keyDown(link, { key: "Enter", metaKey: true })).toBe(true);
  expect(onClick).not.toHaveBeenCalled();
});
