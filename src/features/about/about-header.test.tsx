import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { startDitherBackdropAnimation } from "#/lib/dither/backdrop-animation.ts";
import type { startDitherBackdropAnimation as StartDitherBackdropAnimation } from "#/lib/dither/backdrop-animation.ts";

import { AboutHeader } from "./about-header.tsx";

vi.mock("#/lib/dither/backdrop-animation.ts", () => ({
  startDitherBackdropAnimation: vi.fn<typeof StartDitherBackdropAnimation>(() => () => undefined),
}));

const renderAboutHeader = () =>
  render(
    <AboutHeader speech="A line of speech.">
      <p>A statement.</p>
    </AboutHeader>,
  );

describe("AboutHeader", () => {
  test("renders a `<header>` with the avatar before its children", () => {
    const { container } = renderAboutHeader();

    const header = container.querySelector("header")!;
    const avatar = screen.getByRole("img");
    const statement = screen.getByText("A statement.");

    expect(header.contains(avatar)).toBe(true);
    expect(header.contains(statement)).toBe(true);
    expect(avatar.compareDocumentPosition(statement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("passes the `speech` prop to the avatar", () => {
    renderAboutHeader();
    expect(screen.queryByRole("img", { description: "A line of speech." })).not.toBeNull();
  });

  test("spans the pane of the content body", () => {
    const { container } = renderAboutHeader();
    expect(container.querySelector("header")?.getAttribute("data-content-span")).toBe("pane");
  });

  test("centers the backdrop's highlight on the avatar's graphic", () => {
    renderAboutHeader();
    expect(startDitherBackdropAnimation).toHaveBeenLastCalledWith(
      expect.objectContaining({ highlightCenterElement: screen.getByRole("img") }),
    );
  });
});
