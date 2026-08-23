import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "./button";

import type { RefObject } from "react";

test("forwards native disabled, autofocus, and accessibility props", () => {
  render(
    <>
      <Button children="Disabled" disabled aria-describedby="disabled-description" />
      <Button children="Focused" autoFocus aria-describedby="focused-description" />
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
  render(<Button children="Go Home" autoFocus href="/" />);

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
      <Button ref={buttonRef} children="Button" />
      <Button ref={linkRef} children="Anchor" autoFocus href="/" />
    </>,
  );

  expect(buttonRef.current).toBe(screen.getByRole("button", { name: "Button" }));
  expect(linkRef.current).toBe(screen.getByRole("link", { name: "Anchor" }));
  expect(document.activeElement).toBe(linkRef.current);
});
