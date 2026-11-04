import { afterEach, describe, expect, test } from "vitest";

import { focusWithTabIndexUntilBlur } from "./focus.ts";

const appendedElement = (tagName: string) => document.body.appendChild(document.createElement(tagName));

afterEach(() => {
  document.body.replaceChildren();
});

describe("focusWithTabIndexUntilBlur", () => {
  test("focuses an element without a `tabindex` attribute, and sets its `tabindex` attribute to `-1` until the element loses the focus", () => {
    const element = appendedElement("div");
    const nextElement = appendedElement("button");

    expect(element.hasAttribute("tabindex")).toBe(false);

    focusWithTabIndexUntilBlur(element);

    expect(document.activeElement).toBe(element);
    expect(element.getAttribute("tabindex")).toBe("-1");

    nextElement.focus();

    expect(element.hasAttribute("tabindex")).toBe(false);
  });

  test("leaves the `tabindex` attribute of an element with one unchanged when the element loses the focus", () => {
    const element = appendedElement("div");
    const nextElement = appendedElement("button");

    element.tabIndex = 0;
    focusWithTabIndexUntilBlur(element);
    nextElement.focus();

    expect(element.getAttribute("tabindex")).toBe("0");
  });

  test("removes its temporary `tabindex` attribute from an element that does not take the focus", () => {
    const element = document.createElement("div"); // Outside the document, where `focus` does not move the focus.

    focusWithTabIndexUntilBlur(element);

    expect(document.activeElement).not.toBe(element);
    expect(element.hasAttribute("tabindex")).toBe(false);
  });
});
