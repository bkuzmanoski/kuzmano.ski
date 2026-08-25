import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, expect, test, vi } from "vitest";

import { mergeHandlers } from "../merge-handlers";

import { useListNavigation } from "./use-list-navigation";

import type { MouseEvent, ReactNode } from "react";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());
const playHover = vi.hoisted(() => vi.fn());

vi.mock("../audio/scroll", () => ({ scrollIntoViewSilently }));
vi.mock("../audio/sounds", () => ({ playHover }));

function List({
  count,
  activeIndex,
  guardedIndex,
  label = "Item",
  children,
}: {
  count: number;
  activeIndex: number;
  guardedIndex?: number; // An item with its own onMouseDown, merged ahead of the hook's.
  label?: string;
  children?: ReactNode; // A nested list, rendered inside the first item as a sublist would be.
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const itemProps = useListNavigation(listRef, { count, activeIndex, onActivate: vi.fn() });

  return (
    <ul ref={listRef}>
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <a
            href="#"
            {...(index === guardedIndex
              ? mergeHandlers({ onMouseDown: (event: MouseEvent) => event.preventDefault() }, itemProps(index))
              : itemProps(index))}
          >
            {label} {index}
          </a>
          {index === 0 ? children : null}
        </li>
      ))}
    </ul>
  );
}

function renderList(props: Parameters<typeof List>[0]) {
  const { rerender } = render(<List {...props} />);
  return { links: screen.getAllByRole("link"), rerender };
}

beforeEach(() => {
  scrollIntoViewSilently.mockClear();
  playHover.mockClear();
});

test("the active entry is brought into view on mount, and the scroll is silent", () => {
  const { links } = renderList({ count: 3, activeIndex: 1 });

  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
});

test("an arrow key focuses the next item without the browser's own scroll, then brings it into view", () => {
  const { links } = renderList({ count: 3, activeIndex: 0 });
  const focus = vi.spyOn(links[1]!, "focus");

  links[0]!.focus();
  scrollIntoViewSilently.mockClear(); // The mount effect already claimed the active entry's own scroll.
  fireEvent.keyDown(links[0]!, { key: "ArrowDown" });

  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(document.activeElement).toBe(links[1]);
  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[1]);
  expect(playHover).toHaveBeenCalled();
});

test("a press takes over the browser's own focus-scroll", () => {
  const { links } = renderList({ count: 3, activeIndex: 0 });
  const focus = vi.spyOn(links[2]!, "focus");

  scrollIntoViewSilently.mockClear();

  expect(fireEvent.mouseDown(links[2]!, { button: 0 })).toBe(false); // The default was prevented.
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(scrollIntoViewSilently).toHaveBeenCalledWith(links[2]);
});

test("a press a merged handler has already opted out of is left alone", () => {
  const { links } = renderList({ count: 3, activeIndex: 0, guardedIndex: 2 });
  const focus = vi.spyOn(links[2]!, "focus");

  scrollIntoViewSilently.mockClear();

  expect(fireEvent.mouseDown(links[2]!, { button: 0 })).toBe(false); // Prevented by the guard, not this hook.
  expect(focus).not.toHaveBeenCalled();
  expect(scrollIntoViewSilently).not.toHaveBeenCalled();
});

test("the tab stop stays on the list once it shrinks past the focused entry", () => {
  const { links, rerender } = renderList({ count: 3, activeIndex: 0 });

  fireEvent.focus(links.at(-1)!);
  rerender(<List count={1} activeIndex={0} />);

  const remaining = screen.getAllByRole("link");

  expect(remaining.filter((link) => link.tabIndex === 0)).toEqual([remaining[0]]);
});

test("navigation follows the rendered list after it shrinks", () => {
  const { links, rerender } = renderList({ count: 4, activeIndex: 0 });

  links[0]!.focus();
  rerender(<List count={2} activeIndex={0} />);

  const remaining = screen.getAllByRole("link");

  fireEvent.keyDown(remaining[0]!, { key: "End" });

  expect(remaining).toHaveLength(2);
  expect(document.activeElement).toBe(remaining[1]);
});

test("a list navigates its own items, not those of a list nested inside it", () => {
  render(
    <List count={2} activeIndex={0}>
      <List count={3} activeIndex={0} label="Inner" />
    </List>,
  );

  const outer = screen.getAllByRole("link", { name: /^Item/ });
  const inner = screen.getAllByRole("link", { name: /^Inner/ });

  outer[0]!.focus();
  fireEvent.keyDown(outer[0]!, { key: "End" }); // The outer list's own last item, not the sublist's first.

  expect(document.activeElement).toBe(outer[1]);
  expect(inner.map((item) => item.textContent)).toEqual(["Inner 0", "Inner 1", "Inner 2"]);
});
