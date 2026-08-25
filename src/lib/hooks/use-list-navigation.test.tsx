import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { mergeHandlers } from "../merge-handlers";

import { useListNavigation } from "./use-list-navigation";

import type { MouseEvent } from "react";

const scrollIntoViewSilently = vi.hoisted(() => vi.fn());
const playHover = vi.hoisted(() => vi.fn());

vi.mock("../audio/scroll", () => ({ scrollIntoViewSilently }));
vi.mock("../audio/sounds", () => ({ playHover }));

function List({
  count,
  activeIndex,
  guardedIndex,
}: {
  count: number;
  activeIndex: number;
  guardedIndex?: number; // An item with its own onMouseDown, merged ahead of the hook's.
}) {
  const itemProps = useListNavigation({ count, activeIndex, onActivate: vi.fn() });

  return (
    <ul>
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <a
            href="#"
            {...(index === guardedIndex
              ? mergeHandlers({ onMouseDown: (event: MouseEvent) => event.preventDefault() }, itemProps(index))
              : itemProps(index))}
          >
            Item {index}
          </a>
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
