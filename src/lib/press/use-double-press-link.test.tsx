import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { activateWithScreenReaderInChrome, activateWithScreenReaderInFirefox } from "#/test-utils/press.ts";

import { followLink } from "../link.ts";

import { useDoublePressLink } from "./use-double-press-link.ts";

const onOpen = vi.fn();

let isPressOpenable = true;

function Link() {
  return (
    <a href="/page" {...useDoublePressLink({ isPressOpenable: () => isPressOpenable, onOpen })}>
      Link
    </a>
  );
}

beforeEach(() => {
  onOpen.mockClear();
  isPressOpenable = true;
  render(<Link />);
});

const link = () => screen.getByRole("link", { name: "Link" });

describe("useDoublePressLink", () => {
  test("a modified or non-primary press prevents the `mousedown` default action", () => {
    expect(fireEvent.mouseDown(link(), { button: 0, metaKey: true })).toBe(false);
    expect(fireEvent.mouseDown(link(), { button: 1 })).toBe(false);
    expect(fireEvent.mouseDown(link(), { button: 0 })).toBe(true);
  });

  test("a plain click prevents the link's default action, and does not call `onOpen`", () => {
    expect(fireEvent.click(link(), { detail: 1 })).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("the first click of a modified press does not call `onOpen` or prevent the link's default action", () => {
    expect(fireEvent.click(link(), { detail: 1, metaKey: true })).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a repeated modified click prevents the link's default action, and does not call `onOpen`", () => {
    expect(fireEvent.click(link(), { detail: 2, metaKey: true })).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a `click` without a press prevents the link's default action, and calls `onOpen`", () => {
    expect(fireEvent.click(link(), { detail: 0 })).toBe(false);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("a screen reader's activate action in Chrome prevents the link's default action, and calls `onOpen` once", () => {
    expect(activateWithScreenReaderInChrome(link())).toBe(false);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("a screen reader's activate action in Firefox prevents the link's default action, and calls `onOpen` once", () => {
    expect(activateWithScreenReaderInFirefox(link())).toBe(false);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("a plain press after a screen reader's activate action in Chrome does not call `onOpen`", () => {
    activateWithScreenReaderInChrome(link());
    onOpen.mockClear();
    fireEvent.mouseDown(link(), { detail: 1 });
    fireEvent.click(link(), { detail: 1 });

    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a plain press from an input device prevents the link's default action, and does not call `onOpen`", () => {
    fireEvent.mouseDown(link(), { detail: 1 });

    expect(fireEvent.click(link(), { detail: 1 })).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a `click` dispatched by `followLink` does not call `onOpen` or prevent the link's default action", () => {
    const listener = vi.fn((event: Event) => event.defaultPrevented);

    document.addEventListener("click", listener, { once: true });
    followLink(link() as HTMLAnchorElement);

    expect(listener).toHaveReturnedWith(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a plain double click calls `onOpen`", () => {
    fireEvent.doubleClick(link());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("a modified double click does not call `onOpen`", () => {
    fireEvent.doubleClick(link(), { metaKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("while `isPressOpenable` returns `false`, a modified click prevents the link's default action, and neither a pointer click nor a double click calls `onOpen`", () => {
    isPressOpenable = false;

    expect(fireEvent.click(link(), { detail: 1, metaKey: true })).toBe(false);

    fireEvent.click(link(), { detail: 1 });
    fireEvent.doubleClick(link());

    expect(onOpen).not.toHaveBeenCalled();
  });

  test("while `isPressOpenable` returns `false`, a `click` without a press calls `onOpen`", () => {
    isPressOpenable = false;
    fireEvent.click(link(), { detail: 0 });

    expect(onOpen).toHaveBeenCalledOnce();
  });
});
