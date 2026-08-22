import { act, render } from "@testing-library/react";
import { expect, test } from "vitest";

import { useForm } from "./use-form";
import { emailAddress, required } from "./validation";

import type { Form } from "./use-form";
import type { Schema } from "./validation";

interface Fields {
  name: string;
  email: string;
}

const SCHEMA: Schema<Fields> = {
  name: [required("Enter a name.")],
  email: [required("Enter an address."), emailAddress("Not an address.")],
};

const INITIAL: Fields = { name: "", email: "" };

function renderForm() {
  let form!: Form<Fields>;

  function Harness() {
    form = useForm({ initialValues: INITIAL, schema: SCHEMA });
    return null;
  }

  render(<Harness />);

  return {
    get form() {
      return form;
    },
  };
}

test("a field's error is withheld until the field has been visited", () => {
  const harness = renderForm();

  expect(harness.form.visibleErrors).toEqual({});

  act(() => {
    harness.form.fieldProps("name").onBlur();
  });

  expect(harness.form.visibleErrors).toEqual({ name: "Enter a name." });
});

test("revealing errors shows all errors at once and reports them to the caller", () => {
  const harness = renderForm();

  let reported: unknown;

  act(() => {
    reported = harness.form.revealErrors();
  });

  expect(reported).toEqual({ name: "Enter a name.", email: "Enter an address." });
  expect(harness.form.visibleErrors).toEqual({ name: "Enter a name.", email: "Enter an address." });
});

test("a submission with no errors reports null", () => {
  const harness = renderForm();

  act(() => {
    harness.form.setValue("name", "Test");
    harness.form.setValue("email", "test@example.com");
  });

  let reported: unknown = "unset";

  act(() => {
    reported = harness.form.revealErrors();
  });

  expect(reported).toBeNull();
  expect(harness.form.isValid).toBe(true);
});

test("an error is cleared as soon as the value stops failing, with no second submission", () => {
  const harness = renderForm();

  act(() => {
    harness.form.revealErrors();
  });

  expect(harness.form.visibleErrors.email).toBe("Enter an address.");

  act(() => {
    harness.form.setValue("email", "nope");
  });
  expect(harness.form.visibleErrors.email).toBe("Not an address.");

  act(() => {
    harness.form.setValue("email", "test@example.com");
  });

  expect(harness.form.visibleErrors.email).toBeUndefined();
});

test("`isDirty` tracks whether anything has been entered, and a reset clears the form", () => {
  const harness = renderForm();

  expect(harness.form.isDirty).toBe(false);

  act(() => {
    harness.form.setValue("name", "Ada");
  });

  expect(harness.form.isDirty).toBe(true);

  act(() => {
    harness.form.revealErrors();
  });
  act(() => {
    harness.form.reset();
  });

  expect(harness.form.isDirty).toBe(false);
  expect(harness.form.values).toEqual(INITIAL);
  expect(harness.form.visibleErrors).toEqual({});
});

test("an untouched form shows no errors but is still invalid", () => {
  const harness = renderForm();

  expect(harness.form.visibleErrors).toEqual({});
  expect(harness.form.isValid).toBe(false);
});
