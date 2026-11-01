import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { RootDocument } from "./root-document.tsx";

vi.mock("@tanstack/react-router", () => ({ HeadContent: () => null, Scripts: () => null }));

const DOCUMENT_CUSTOM_PROPERTIES = [
  "--layout-window-layer-padding",
  "--theme-hue",
  "--theme-chroma-scale",
  "--color-accent",
];

test("the document sets the window layer padding and default theme tint custom properties of `<html>`", () => {
  const markup = renderToStaticMarkup(<RootDocument>{null}</RootDocument>);
  const documentElement = new DOMParser().parseFromString(markup, "text/html").documentElement;

  for (const property of DOCUMENT_CUSTOM_PROPERTIES) {
    expect(documentElement.style.getPropertyValue(property), property).not.toBe("");
  }
});
