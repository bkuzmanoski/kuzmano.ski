import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { TextArea, TextInput, TextInputFrame } from "./text-input.tsx";

test("a text input defaults to text unless given another type", () => {
  render(
    <>
      <TextInput aria-label="Name" />
      <TextInput type="email" aria-label="Email address" />
    </>,
  );

  expect(screen.getByLabelText("Name").getAttribute("type")).toBe("text");
  expect(screen.getByLabelText("Email address").getAttribute("type")).toBe("email");
});

test.each([
  ["a text input", <TextInput key="input" className="caller" aria-label="Field" />],
  ["a text area", <TextArea key="area" className="caller" aria-label="Field" />],
])("%s keeps a caller's class alongside its own", (_label, control) => {
  render(control);

  const field = screen.getByLabelText("Field");

  expect(field.className).toContain("caller");
  expect(field.className.split(" ").length).toBeGreaterThan(1); // The component's own class is a CSS module hash.
});

test("a text input frame keeps its class on the element wrapping the control", () => {
  render(
    <TextInputFrame className="caller">
      <TextInput aria-label="Field" />
    </TextInputFrame>,
  );

  const frame = screen.getByLabelText("Field").parentElement;

  expect(frame?.className).toContain("caller");
  expect(frame?.className.split(" ").length).toBeGreaterThan(1);
});
