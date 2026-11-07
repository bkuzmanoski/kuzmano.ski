import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { ShareButton } from "./share-button.tsx";

const share = vi.fn<(data: ShareData) => Promise<void>>();

beforeEach(() => {
  share.mockReset();
  share.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, share });
});

async function clickShare() {
  render(<ShareButton url="https://example.com/collection/entry" title="Entry" />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));

  await act(async () => {
    await Promise.resolve();
  });
}

test("clicking the button shares the URL and title", async () => {
  await clickShare();

  expect(share).toHaveBeenCalledWith({ url: "https://example.com/collection/entry", title: "Entry" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("a canceled share shows no alert", async () => {
  share.mockRejectedValue(new DOMException("Share canceled.", "AbortError"));
  await clickShare();

  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("shows a permissions hint when the browser denies sharing", async () => {
  share.mockRejectedValue(new DOMException("Permission denied.", "NotAllowedError"));
  await clickShare();

  expect(screen.getByRole("alertdialog").textContent).toContain(
    "The link couldn’t be shared. Check your browser permissions.",
  );

  fireEvent.click(screen.getByRole("button", { name: "OK" }));

  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("a non-permission share failure shows an alert without the permissions hint", async () => {
  share.mockRejectedValue(new TypeError("Invalid share data."));
  await clickShare();

  expect(screen.getByRole("alertdialog").textContent).toContain("The link couldn’t be shared.");
  expect(screen.getByRole("alertdialog").textContent).not.toContain("permissions");
});
