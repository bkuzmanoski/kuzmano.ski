import { act, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useLocale } from "./use-locale.ts";

const PRERENDER_LOCALE = "en-AU";

const LocaleProbe = () => <output>{useLocale(PRERENDER_LOCALE)}</output>;

beforeEach(() => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
});

describe("useLocale", () => {
  test("returns the prerender locale on the server", () => {
    expect(renderToString(<LocaleProbe />)).toBe("<output>en-AU</output>");
  });

  test("returns the prerender locale during hydration, then the browser's locale", () => {
    const container = document.createElement("div");

    container.innerHTML = renderToString(<LocaleProbe />);
    document.body.append(container);

    // A hydration render in the browser's locale would not match the prerendered markup,
    // which React recovers from and reports here.
    const onRecoverableError = vi.fn();

    act(() => {
      hydrateRoot(container, <LocaleProbe />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("fr-FR");

    container.remove();
  });

  test("returns the browser's locale on a client render that is not a hydration", () => {
    const { container } = render(<LocaleProbe />);
    expect(container.textContent).toBe("fr-FR");
  });

  test("returns the prerender locale when `navigator.language` is empty", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("");

    const { container } = render(<LocaleProbe />);

    expect(container.textContent).toBe("en-AU");
  });
});
