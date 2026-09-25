import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ImageGrid } from "./image-grid.tsx";

describe("ImageGrid", () => {
  test("renders its children inside a `<figure>` and the `caption` prop as the `<figcaption>`", () => {
    const { container } = render(
      <ImageGrid caption="Fixture caption.">
        <img src="/first.gif" alt="First image" />
        <img src="/second.gif" alt="Second image" />
      </ImageGrid>,
    );
    const figure = container.querySelector("figure")!;

    expect(screen.getAllByRole("img").map((image) => image.closest("figure"))).toEqual([figure, figure]);
    expect(figure.querySelector("figcaption")?.textContent).toBe("Fixture caption.");
  });

  test("renders a `<figure>` without a `<figcaption>` when the `caption` prop is absent", () => {
    const { container } = render(
      <ImageGrid>
        <img src="/first.gif" alt="First image" />
      </ImageGrid>,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  test("marks the `<figure>` with the `data-image-grid` attribute, and sets the `data-content-default-styles` attribute of the element around the images to `off`", () => {
    const { container } = render(
      <ImageGrid caption="Fixture caption.">
        <img src="/first.gif" alt="First image" />
      </ImageGrid>,
    );
    const figure = container.querySelector("figure")!;

    expect(figure.hasAttribute("data-image-grid")).toBe(true);
    expect(figure.hasAttribute("data-content-default-styles")).toBe(false);
    expect(screen.getByRole("img").parentElement?.getAttribute("data-content-default-styles")).toBe("off");
    expect(figure.querySelector("figcaption")?.closest('[data-content-default-styles="off"]')).toBeNull();
  });
});
