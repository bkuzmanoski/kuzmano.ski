import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button } from "./button";

test("forwards native disabled and accessibility props", () => {
  render(<Button children="Save" autoFocus disabled aria-describedby="save-description" />);

  const button = screen.getByRole("button", { name: "Save" });

  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.getAttribute("aria-describedby")).toBe("save-description");
  expect(button.getAttribute("type")).toBe("button");
  expect(document.activeElement).toBe(button);
});
