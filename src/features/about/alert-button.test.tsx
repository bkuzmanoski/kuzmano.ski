import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";

import { AlertButton } from "./alert-button.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => {
  vi.mocked(playClickSound).mockClear();
});

const renderAlertButton = () =>
  render(
    <p>
      <AlertButton message="Fixture message.">
        <img src="/first.gif" alt="First image" />
      </AlertButton>
    </p>,
  );

describe("AlertButton", () => {
  test("renders its children inside a button named by them", () => {
    renderAlertButton();
    expect(screen.getByRole("button", { name: "First image" }).contains(screen.getByRole("img"))).toBe(true);
  });

  test("opens a modal alert showing the `message` prop when the button is pressed", () => {
    renderAlertButton();
    fireEvent.click(screen.getByRole("button", { name: "First image" }));

    expect(screen.getByRole("alertdialog").textContent).toContain("Fixture message.");
  });

  test("renders the alert into `<body>`, outside the paragraph around the button", () => {
    renderAlertButton();
    fireEvent.click(screen.getByRole("button", { name: "First image" }));

    expect(screen.getByRole("alertdialog").parentElement).toBe(document.body);
  });

  test("plays the click sound when the button is pressed with the mouse", () => {
    renderAlertButton();
    fireEvent.pointerDown(screen.getByRole("button", { name: "First image" }), { pointerType: "mouse" });

    expect(playClickSound).toHaveBeenCalledTimes(1);
  });

  test("closes the alert when its `OK` button is pressed", () => {
    renderAlertButton();
    fireEvent.click(screen.getByRole("button", { name: "First image" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
