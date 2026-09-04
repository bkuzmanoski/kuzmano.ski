import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClick } from "#/lib/audio/sounds.ts";
import { useInputField } from "#/lib/forms/use-input-field.ts";
import type { InputFieldControl } from "#/lib/forms/use-input-field.ts";

import { InputField } from "./input-field.tsx";

import type { ReactNode } from "react";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => vi.mocked(playClick).mockClear());

const CLICK = { detail: 1 }; // A pointer click, as opposed to keyboard activation.
const FORWARDED_CLICK = { detail: 0 }; // The click a label sends to the control it names.

function Harness({
  label,
  error,
  labelHidden,
  control,
}: {
  label: string;
  error?: string;
  labelHidden?: boolean;
  control?: (props: InputFieldControl) => ReactNode;
}) {
  const binding = useInputField(error);
  return (
    <InputField label={label} binding={binding} labelHidden={labelHidden}>
      {control ? control(binding.control) : <input {...binding.control} />}
    </InputField>
  );
}

test("the label names the control", () => {
  render(<Harness label="From:" />);
  expect(screen.getByLabelText("From:").tagName).toBe("INPUT");
});

test("a hidden label names the control", () => {
  render(<Harness label="Label:" labelHidden control={(props) => <textarea {...props} />} />);
  expect(screen.getByLabelText("Label:").tagName).toBe("TEXTAREA");
});

test("an error marks the control invalid and describes it", () => {
  render(<Harness label="Label:" error="Error message." />);

  const inputField = screen.getByLabelText("Label:");
  const describedBy = inputField.getAttribute("aria-describedby");

  expect(inputField.getAttribute("aria-invalid")).toBe("true");
  expect(describedBy).not.toBeNull();
  expect(document.getElementById(describedBy!)?.textContent).toBe("Error message.");
});

test("an input field without an error is neither invalid nor described", () => {
  render(<Harness label="From:" />);

  const inputField = screen.getByLabelText("From:");

  expect(inputField.hasAttribute("aria-invalid")).toBe(false);
  expect(inputField.hasAttribute("aria-describedby")).toBe(false);
});

test("an error is described without creating a second live region", () => {
  const { container } = render(<Harness label="From:" error="Not an email address." />);

  expect(container.querySelector("[aria-live]")).toBeNull();
  expect(container.querySelector('[role="status"]')).toBeNull();
});

test("each input field gets its own id", () => {
  render(
    <>
      <Harness label="From:" />
      <Harness label="To:" />
    </>,
  );
  expect(screen.getByLabelText("From:").id).not.toBe(screen.getByLabelText("To:").id);
});

test("a press on the control plays one click", () => {
  render(<Harness label="From:" />);

  const control = screen.getByLabelText("From:");

  fireEvent.pointerDown(control);
  fireEvent.pointerUp(control);
  fireEvent.click(control, CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a press on the label plays one click, and the click it forwards does not play another", () => {
  render(<Harness label="From:" />);

  fireEvent.pointerDown(screen.getByText("From:"));

  expect(playClick).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByLabelText("From:"), FORWARDED_CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a press on a control that plays its own sound is left to that control", () => {
  render(
    <Harness
      label="Message:"
      control={(props) => (
        <>
          <textarea {...props} />
          <div data-testid="scrollbar" />
        </>
      )}
    />,
  );

  const scrollbar = screen.getByTestId("scrollbar");

  fireEvent.pointerDown(scrollbar);
  fireEvent.pointerUp(scrollbar);
  fireEvent.click(scrollbar, CLICK);

  expect(playClick).not.toHaveBeenCalled();
});
