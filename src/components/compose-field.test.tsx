import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { useField } from "#/lib/forms/use-field";
import type { FieldControl } from "#/lib/forms/use-field";

import { ComposeField } from "./compose-field";

import type { ReactNode } from "react";

function Field({
  label,
  error,
  labelHidden,
  control,
}: {
  label: string;
  error?: string;
  labelHidden?: boolean;
  control?: (props: FieldControl) => ReactNode;
}) {
  const field = useField(error);

  return (
    <ComposeField label={label} field={field} labelHidden={labelHidden}>
      {control ? control(field.control) : <input {...field.control} />}
    </ComposeField>
  );
}

test("the label names the control", () => {
  render(<Field label="From:" />);
  expect(screen.getByLabelText("From:").tagName).toBe("INPUT");
});

test("a hidden label names the control", () => {
  render(<Field label="Label:" labelHidden control={(props) => <textarea {...props} />} />);
  expect(screen.getByLabelText("Label:").tagName).toBe("TEXTAREA");
});

test("an error marks the control invalid and describes it", () => {
  render(<Field label="Label:" error="Error message." />);

  const field = screen.getByLabelText("Label:");
  const describedBy = field.getAttribute("aria-describedby");

  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(describedBy).not.toBeNull();
  expect(document.getElementById(describedBy!)?.textContent).toBe("Error message.");
});

test("a field without an error is neither invalid nor described", () => {
  render(<Field label="From:" />);

  const field = screen.getByLabelText("From:");

  expect(field.hasAttribute("aria-invalid")).toBe(false);
  expect(field.hasAttribute("aria-describedby")).toBe(false);
});

test("an error is described without creating a second live region", () => {
  const { container } = render(<Field label="From:" error="Not an address." />);

  expect(container.querySelector("[aria-live]")).toBeNull();
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test("each field gets its own id", () => {
  render(
    <>
      <Field label="From:" />
      <Field label="To:" />
    </>,
  );
  expect(screen.getByLabelText("From:").id).not.toBe(screen.getByLabelText("To:").id);
});
