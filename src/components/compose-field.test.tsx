import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ComposeField } from "./compose-field";

test("the label names the control", () => {
  render(<ComposeField label="From:">{(control) => <input {...control} />}</ComposeField>);
  expect(screen.getByLabelText("From:").tagName).toBe("INPUT");
});

test("a hidden label names the control", () => {
  render(
    <ComposeField label="Label:" labelHidden>
      {(control) => <textarea {...control} />}
    </ComposeField>,
  );
  expect(screen.getByLabelText("Label:").tagName).toBe("TEXTAREA");
});

test("an error marks the control invalid and describes it", () => {
  render(
    <ComposeField label="Label:" error="Error message.">
      {(control) => <input {...control} />}
    </ComposeField>,
  );

  const field = screen.getByLabelText("Label:");
  const describedBy = field.getAttribute("aria-describedby");

  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(describedBy).not.toBeNull();
  expect(document.getElementById(describedBy!)?.textContent).toBe("Error message.");
});

test("a field without an error is neither invalid nor described", () => {
  render(<ComposeField label="From:">{(control) => <input {...control} />}</ComposeField>);

  const field = screen.getByLabelText("From:");

  expect(field.hasAttribute("aria-invalid")).toBe(false);
  expect(field.hasAttribute("aria-describedby")).toBe(false);
});

test("an error is described without creating a second live region", () => {
  const { container } = render(
    <ComposeField label="From:" error="Not an address.">
      {(control) => <input {...control} />}
    </ComposeField>,
  );

  expect(container.querySelector("[aria-live]")).toBeNull();
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test("each field gets its own id", () => {
  render(
    <>
      <ComposeField label="From:">{(control) => <input {...control} />}</ComposeField>
      <ComposeField label="To:">{(control) => <input {...control} />}</ComposeField>
    </>,
  );
  expect(screen.getByLabelText("From:").id).not.toBe(screen.getByLabelText("To:").id);
});
