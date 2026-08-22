import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { useField } from "./use-field";

import type { FieldBinding } from "./use-field";

function renderField() {
  let field!: FieldBinding;

  function Harness({ error }: { error?: string }) {
    field = useField(error);
    return null;
  }

  const { rerender } = render(<Harness />);

  return {
    get field() {
      return field;
    },
    show: (error?: string) => rerender(<Harness error={error} />),
  };
}

test("a control is described by the error and marked invalid only while there is one", () => {
  const harness = renderField();

  expect(harness.field.control["aria-invalid"]).toBeUndefined();
  expect(harness.field.control["aria-describedby"]).toBeUndefined();

  harness.show("Not an email address.");

  expect(harness.field.control["aria-invalid"]).toBe(true);
  expect(harness.field.control["aria-describedby"]).toBe(harness.field.errorId);
});

test("the error is carried to the field that reports it", () => {
  const harness = renderField();

  harness.show("Not an email address.");

  expect(harness.field.error).toBe("Not an email address.");
});

test("a control keeps its attributes across renders that don't change the error", () => {
  const harness = renderField();
  const unchanged = harness.field.control;

  harness.show();

  expect(harness.field.control).toBe(unchanged);

  harness.show("Not an email address.");

  expect(harness.field.control).not.toBe(unchanged);
});
