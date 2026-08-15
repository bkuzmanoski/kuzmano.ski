import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "./button";

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
