import { act, render } from "@testing-library/react";
import { expect, test } from "vitest";

import { useForm } from "./use-form";
import { emailAddress, required } from "./validation";

import type { Form } from "./use-form";
import type { Schema } from "./validation";
import type { ChangeEvent } from "react";

interface Fields {
  name: string;
  emailAddress: string;
}

const SCHEMA: Schema<Fields> = {
  name: [required("Enter a name.")],
  emailAddress: [required("Enter an email address."), emailAddress("Not an email address.")],
};

const INITIAL_VALUES: Fields = { name: "", emailAddress: "" };

function renderForm() {
  let form!: Form<Fields>;

  function Harness() {
    form = useForm({ initialValues: INITIAL_VALUES, schema: SCHEMA });
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
    harness.form.handlers.name.onBlur();
  });

  expect(harness.form.visibleErrors).toEqual({ name: "Enter a name." });
});

test("revealing errors shows all errors at once and reports them to the caller", () => {
  const harness = renderForm();

  let reported: unknown;

  act(() => {
    reported = harness.form.revealErrors();
  });

  expect(reported).toEqual({ name: "Enter a name.", emailAddress: "Enter an email address." });
  expect(harness.form.visibleErrors).toEqual({ name: "Enter a name.", emailAddress: "Enter an email address." });
});

test("a submission with no errors reports null", () => {
  const harness = renderForm();

  act(() => {
    harness.form.setValue("name", "Test");
    harness.form.setValue("emailAddress", "test@example.com");
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

  expect(harness.form.visibleErrors.emailAddress).toBe("Enter an email address.");

  act(() => {
    harness.form.setValue("emailAddress", "nope");
  });
  expect(harness.form.visibleErrors.emailAddress).toBe("Not an email address.");

  act(() => {
    harness.form.setValue("emailAddress", "test@example.com");
  });

  expect(harness.form.visibleErrors.emailAddress).toBeUndefined();
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
  expect(harness.form.values).toEqual(INITIAL_VALUES);
  expect(harness.form.visibleErrors).toEqual({});
});

test("a field's handlers are fixed while its value changes", () => {
  const harness = renderForm();
  const nameHandlers = harness.form.handlers.name;
  const emailHandlers = harness.form.handlers.emailAddress;

  act(() => {
    harness.form.setValue("emailAddress", "test@example.com");
  });

  expect(harness.form.handlers.name).toBe(nameHandlers);
  expect(harness.form.handlers.emailAddress).toBe(emailHandlers);
  expect(harness.form.values.emailAddress).toBe("test@example.com");
});

test("a change handler writes to its own field", () => {
  const harness = renderForm();

  act(() => {
    harness.form.handlers.name.onChange({
      currentTarget: { value: "Ada" },
    } as ChangeEvent<HTMLInputElement>);
  });

  expect(harness.form.values).toEqual({ name: "Ada", emailAddress: "" });
});

test("an unedited form does not show errors but is still invalid", () => {
  const harness = renderForm();

  expect(harness.form.visibleErrors).toEqual({});
  expect(harness.form.isValid).toBe(false);
});
