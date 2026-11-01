import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { FormattedDate } from "./formatted-date.tsx";

const DATE = "2024-01-02";
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

const timeElement = () => document.querySelector("time")!;

describe("FormattedDate", () => {
  test("renders the date formatted by its format in a `<time>` with the date as its `datetime` attribute", () => {
    const format = new Intl.DateTimeFormat("en-GB", DATE_FORMAT_OPTIONS);

    render(<FormattedDate date={DATE} format={format} />);

    expect(timeElement().textContent).toBe("2 January 2024");
    expect(timeElement().getAttribute("datetime")).toBe(DATE);
  });

  test("sets the `lang` attribute to the format's locale when its language differs from that of the document", () => {
    render(<FormattedDate date={DATE} format={new Intl.DateTimeFormat("de-DE", DATE_FORMAT_OPTIONS)} />);
    expect(timeElement().getAttribute("lang")).toBe("de-DE");
  });

  test("omits the `lang` attribute when the format's language is the same as that of the document", () => {
    render(<FormattedDate date={DATE} format={new Intl.DateTimeFormat("en-GB", DATE_FORMAT_OPTIONS)} />);
    expect(timeElement().hasAttribute("lang")).toBe(false);
  });

  test("hydrating over prerendered text that differs from the formatted date leaves the text unchanged and does not report a recoverable error", () => {
    const prerenderedText = "2 Jan. 2024";
    const container = document.createElement("div");

    container.innerHTML = `<time datetime="${DATE}">${prerenderedText}</time>`;
    document.body.append(container);

    const prerenderedTimeElement = timeElement();
    const onRecoverableError = vi.fn();

    render(<FormattedDate date={DATE} format={new Intl.DateTimeFormat("en-GB", DATE_FORMAT_OPTIONS)} />, {
      container,
      hydrate: true,
      onRecoverableError,
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(timeElement()).toBe(prerenderedTimeElement);
    expect(timeElement().textContent).toBe(prerenderedText);
  });
});
