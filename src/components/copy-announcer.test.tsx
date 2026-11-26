import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";

import { CopyAnnouncer } from "./copy-announcer.tsx";

const PADDED_CONFIRMATION = "Copied\u00A0";

/**
 * Renders `CopyAnnouncer` with each of `confirmedClipboardCopyNumbers` in turn, returning the status region's text
 * after each.
 */
function statusTextsAcross(confirmedClipboardCopyNumbers: Array<number | null>, { isStrict = false } = {}) {
  const announcerOf = (confirmedClipboardCopyNumber: number | null) =>
    isStrict ? (
      <StrictMode>
        <CopyAnnouncer confirmedClipboardCopyNumber={confirmedClipboardCopyNumber} />
      </StrictMode>
    ) : (
      <CopyAnnouncer confirmedClipboardCopyNumber={confirmedClipboardCopyNumber} />
    );
  const [firstConfirmedClipboardCopyNumber, ...laterConfirmedClipboardCopyNumbers] = confirmedClipboardCopyNumbers;
  const { rerender } = render(announcerOf(firstConfirmedClipboardCopyNumber ?? null));
  const statusTexts = [screen.getByRole("status").textContent];

  for (const confirmedClipboardCopyNumber of laterConfirmedClipboardCopyNumbers) {
    rerender(announcerOf(confirmedClipboardCopyNumber));
    statusTexts.push(screen.getByRole("status").textContent);
  }

  return statusTexts;
}

test("the server render contains an empty status region", () => {
  const container = document.createElement("div");

  container.innerHTML = renderToString(<CopyAnnouncer confirmedClipboardCopyNumber={null} />);

  expect(container.querySelector('[role="status"]')?.textContent).toBe("");
});

test("the status region renders the `confirmation` prop unchanged for the first confirmed copy", () => {
  render(<CopyAnnouncer confirmedClipboardCopyNumber={1} confirmation="Link copied" />);
  expect(screen.getByRole("status").textContent).toBe("Link copied");
});

test("the status region ends every second confirmation in a no-break space", () => {
  expect(statusTextsAcross([1, 2, 3])).toEqual(["Copied", PADDED_CONFIRMATION, "Copied"]);
});

test("the status region alternates the confirmations when it empties between them", () => {
  // VoiceOver skips a message with the same text as the previous one, even after the region is emptied.
  expect(statusTextsAcross([1, null, 2, null, 3])).toEqual(["Copied", "", PADDED_CONFIRMATION, "", "Copied"]);
});

test("the status region alternates the confirmations in `StrictMode`", () => {
  expect(statusTextsAcross([1, 2, 3], { isStrict: true })).toEqual(["Copied", PADDED_CONFIRMATION, "Copied"]);
});

test("re-rendering with the same confirmed copy number reuses the confirmation element and leaves its text unchanged", () => {
  const { rerender } = render(<CopyAnnouncer confirmedClipboardCopyNumber={1} />);
  const confirmationElement = screen.getByRole("status").firstElementChild;

  rerender(<CopyAnnouncer confirmedClipboardCopyNumber={1} />);

  expect(screen.getByRole("status").firstElementChild).toBe(confirmationElement);
  expect(screen.getByRole("status").textContent).toBe("Copied");
});

test("a new confirmed copy number replaces the confirmation element", () => {
  // A screen reader announces an inserted node, so a new element makes each copy an announcement of its own.
  const { rerender } = render(<CopyAnnouncer confirmedClipboardCopyNumber={1} />);
  const firstConfirmationElement = screen.getByRole("status").firstElementChild;

  rerender(<CopyAnnouncer confirmedClipboardCopyNumber={2} />);

  expect(screen.getByRole("status").firstElementChild).not.toBe(firstConfirmationElement);
});
