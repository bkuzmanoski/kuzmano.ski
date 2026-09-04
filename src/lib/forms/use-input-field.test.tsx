import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { useInputField } from "./use-input-field.ts";

import type { InputFieldBinding } from "./use-input-field.ts";

function renderInputField() {
  let binding!: InputFieldBinding;

  function Harness({ error }: { error?: string }) {
    binding = useInputField(error);
    return null;
  }

  const { rerender } = render(<Harness />);

  return {
    get inputFieldBinding() {
      return binding;
    },
    show: (error?: string) => rerender(<Harness error={error} />),
  };
}

test("an input control is described by the error and marked invalid only while there is one", () => {
  const harness = renderInputField();

  expect(harness.inputFieldBinding.control["aria-invalid"]).toBeUndefined();
  expect(harness.inputFieldBinding.control["aria-describedby"]).toBeUndefined();

  harness.show("Validation error.");

  expect(harness.inputFieldBinding.control["aria-invalid"]).toBe(true);
  expect(harness.inputFieldBinding.control["aria-describedby"]).toBe(harness.inputFieldBinding.errorId);
});

test("the error is carried to the input field that reports it", () => {
  const harness = renderInputField();

  harness.show("Validation error.");

  expect(harness.inputFieldBinding.error).toBe("Validation error.");
});

test("a control keeps its attributes across renders that don't change the error", () => {
  const harness = renderInputField();
  const unchanged = harness.inputFieldBinding.control;

  harness.show();

  expect(harness.inputFieldBinding.control).toBe(unchanged);

  harness.show("Validation error.");

  expect(harness.inputFieldBinding.control).not.toBe(unchanged);
});
