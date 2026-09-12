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
  const fieldHarness = renderInputField();

  expect(fieldHarness.inputFieldBinding.control["aria-invalid"]).toBeUndefined();
  expect(fieldHarness.inputFieldBinding.control["aria-describedby"]).toBeUndefined();

  fieldHarness.show("Validation error.");

  expect(fieldHarness.inputFieldBinding.control["aria-invalid"]).toBe(true);
  expect(fieldHarness.inputFieldBinding.control["aria-describedby"]).toBe(fieldHarness.inputFieldBinding.errorId);
});

test("the error is carried to the input field that reports it", () => {
  const fieldHarness = renderInputField();

  fieldHarness.show("Validation error.");

  expect(fieldHarness.inputFieldBinding.error).toBe("Validation error.");
});

test("a control keeps its attributes across renders that don't change the error", () => {
  const fieldHarness = renderInputField();
  const unchangedBinding = fieldHarness.inputFieldBinding.control;

  fieldHarness.show();

  expect(fieldHarness.inputFieldBinding.control).toBe(unchangedBinding);

  fieldHarness.show("Validation error.");

  expect(fieldHarness.inputFieldBinding.control).not.toBe(unchangedBinding);
});
