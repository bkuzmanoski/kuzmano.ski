import { act, render } from "@testing-library/react";
import { expect, test } from "vitest";

import { useForm } from "./use-form.ts";
import { emailAddress, required } from "./validation.ts";

import type { Form } from "./use-form.ts";
import type { Schema } from "./validation.ts";
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
  const formHarness = renderForm();

  expect(formHarness.form.visibleErrors).toEqual({});

  act(() => {
    formHarness.form.handlers.name.onBlur();
  });

  expect(formHarness.form.visibleErrors).toEqual({ name: "Enter a name." });
});

test("`isValid` is `false` while a new form's errors are withheld", () => {
  expect(renderForm().form.isValid).toBe(false);
});

test("revealing errors makes every error visible at once and returns them", () => {
  const formHarness = renderForm();

  let reportedErrors: unknown;

  act(() => {
    reportedErrors = formHarness.form.revealErrors();
  });

  expect(reportedErrors).toEqual({ name: "Enter a name.", emailAddress: "Enter an email address." });
  expect(formHarness.form.visibleErrors).toEqual({ name: "Enter a name.", emailAddress: "Enter an email address." });
});

test("revealing errors returns `null` when every field is valid, and `isValid` is `true`", () => {
  const formHarness = renderForm();

  act(() => {
    formHarness.form.setValue("name", "Test");
    formHarness.form.setValue("emailAddress", "test@example.com");
  });

  let reportedErrors: unknown = "unset";

  act(() => {
    reportedErrors = formHarness.form.revealErrors();
  });

  expect(reportedErrors).toBeNull();
  expect(formHarness.form.isValid).toBe(true);
});

test("a visible error updates as the value changes and is cleared once the value is valid, without a second submission", () => {
  const formHarness = renderForm();

  act(() => {
    formHarness.form.revealErrors();
  });

  expect(formHarness.form.visibleErrors.emailAddress).toBe("Enter an email address.");

  act(() => {
    formHarness.form.setValue("emailAddress", "nope");
  });
  expect(formHarness.form.visibleErrors.emailAddress).toBe("Not an email address.");

  act(() => {
    formHarness.form.setValue("emailAddress", "test@example.com");
  });

  expect(formHarness.form.visibleErrors.emailAddress).toBeUndefined();
});

test("`isDirty` is `true` once a value differs from its initial value", () => {
  const formHarness = renderForm();

  expect(formHarness.form.isDirty).toBe(false);

  act(() => {
    formHarness.form.setValue("name", "A name");
  });

  expect(formHarness.form.isDirty).toBe(true);
});

test("`reset` restores the initial values and hides visible errors", () => {
  const formHarness = renderForm();

  act(() => {
    formHarness.form.setValue("name", "A name");
  });
  act(() => {
    formHarness.form.revealErrors();
  });
  act(() => {
    formHarness.form.reset();
  });

  expect(formHarness.form.values).toEqual(INITIAL_VALUES);
  expect(formHarness.form.visibleErrors).toEqual({});
  expect(formHarness.form.isDirty).toBe(false);
});

test("a field's handlers are fixed while its value changes", () => {
  const formHarness = renderForm();
  const nameHandlers = formHarness.form.handlers.name;
  const emailHandlers = formHarness.form.handlers.emailAddress;

  act(() => {
    formHarness.form.setValue("emailAddress", "test@example.com");
  });

  expect(formHarness.form.handlers.name).toBe(nameHandlers);
  expect(formHarness.form.handlers.emailAddress).toBe(emailHandlers);
  expect(formHarness.form.values.emailAddress).toBe("test@example.com");
});

test("a change handler writes to its own field", () => {
  const formHarness = renderForm();

  act(() => {
    formHarness.form.handlers.name.onChange({
      currentTarget: { value: "A name" },
    } as ChangeEvent<HTMLInputElement>);
  });

  expect(formHarness.form.values).toEqual({ name: "A name", emailAddress: "" });
});
