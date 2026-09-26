import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen } from "@testing-library/react";
import postcss from "postcss";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GITHUB_LOGIN, GITHUB_PROFILE_URL } from "#/config/site.ts";
import { SCROLL_PANE_VIEWPORT_SELECTOR } from "#/features/window-manager/scroll-pane.tsx";
import { CONTRIBUTION_LEVEL_COUNT } from "#/lib/github/contributions.ts";
import type { ContributionCalendar } from "#/lib/github/contributions.ts";

import styles from "./contribution-graph.module.css";
import { ContributionGraph } from "./contribution-graph.tsx";

import type { AtRule, Node } from "postcss";

const useContributionCalendar = vi.hoisted(() => vi.fn<() => ContributionCalendar | null | undefined>());

vi.mock("#/lib/github/use-contribution-calendar.ts", () => ({ useContributionCalendar }));

let resizeObserverCallbacks: Set<() => void>;

class FakeResizeObserver {
  readonly #report: () => void;

  constructor(callback: ResizeObserverCallback) {
    this.#report = () => callback([], this as never);
  }

  observe() {
    resizeObserverCallbacks.add(this.#report);
  }

  disconnect() {
    resizeObserverCallbacks.delete(this.#report);
  }
}

beforeEach(() => {
  useContributionCalendar.mockReset();
  resizeObserverCallbacks = new Set();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const WEEKS = [
  [
    { date: "2026-01-07", count: 0 },
    { date: "2026-01-08", count: 1 },
    { date: "2026-01-09", count: 2 },
    { date: "2026-01-10", count: 3 },
  ],
  Array.from({ length: 7 }, (_, index) => ({ date: `2026-01-${String(index + 11)}`, count: index + 4 })),
]; // A partial first week that starts on a Wednesday, then a whole week from Sunday.
const SCROLL_PANE_HEIGHT_PX = 600;
const FIGURE_HEIGHT_PX = 200;

const contributionGraphInScrollPane = () => (
  <div data-scroll-pane-viewport>
    <ContributionGraph />
  </div>
);
const contributionCalendar = (overrides: Partial<ContributionCalendar> = {}): ContributionCalendar => ({
  total: 1234,
  weeks: WEEKS,
  ...overrides,
});
const cellsIn = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>(`.${styles.grid} [data-level]`),
];
const placeholderCellsIn = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>(`.${styles.placeholder} [data-level]`),
];
const placeholderWeeksIn = (container: HTMLElement) => container.querySelector(`.${styles.placeholder}`)!.children;

function placeFigure(topPx: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.matches(SCROLL_PANE_VIEWPORT_SELECTOR)) {
      return new DOMRect(0, 0, 800, SCROLL_PANE_HEIGHT_PX);
    }

    return this.tagName === "FIGURE" ? new DOMRect(0, topPx, 800, FIGURE_HEIGHT_PX) : new DOMRect();
  });
}

function resizeScrollContainer(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
  act(() => resizeObserverCallbacks.forEach((report) => report()));
}

describe("ContributionGraph", () => {
  test("draws a placeholder grid of 53 weeks of 7 days, every day at level 0, while the calendar is being read", () => {
    useContributionCalendar.mockReturnValue(undefined);

    const { container } = render(<ContributionGraph />);
    const placeholderLevels = placeholderCellsIn(container).map((cell) => cell.getAttribute("data-level"));

    expect(placeholderWeeksIn(container)).toHaveLength(53);
    expect(placeholderLevels).toEqual(Array.from({ length: 53 * 7 }, () => "0"));
    expect(cellsIn(container)).toHaveLength(0);
  });

  test("links to the profile from the caption while the calendar is being read", () => {
    useContributionCalendar.mockReturnValue(undefined);

    render(<ContributionGraph />);

    expect(screen.getByRole("link").getAttribute("href")).toBe(GITHUB_PROFILE_URL);
    expect(screen.getByRole("link").closest("figcaption")).toBeTruthy();
  });

  test("does not expose the placeholder grid as an image while the calendar is being read", () => {
    useContributionCalendar.mockReturnValue(undefined);

    render(<ContributionGraph />);

    expect(screen.queryByRole("img")).toBeNull();
  });

  test("renders the `<figcaption>` alone, with the profile link inside it, when the calendar cannot be read", () => {
    useContributionCalendar.mockReturnValue(null);

    const { container } = render(<ContributionGraph />);

    expect(screen.getByRole("link").getAttribute("href")).toBe(GITHUB_PROFILE_URL);
    expect([...container.querySelector("figure")!.children].map((child) => child.tagName)).toEqual(["FIGCAPTION"]);
  });

  test.each([
    ["arrives", contributionCalendar()],
    ["cannot be read", null],
  ])("leaves the profile link focused, as the same element, when the calendar %s", (_label, calendarAfterReading) => {
    useContributionCalendar.mockReturnValue(undefined);

    const { rerender } = render(<ContributionGraph />);
    const link = screen.getByRole("link");

    link.focus();
    useContributionCalendar.mockReturnValue(calendarAfterReading);
    rerender(<ContributionGraph />);

    expect(screen.getByRole("link")).toBe(link);
    expect(document.activeElement).toBe(link);
  });

  test("draws a cell for every day in the calendar", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);

    expect(cellsIn(container)).toHaveLength(WEEKS.flat().length);
  });

  test("draws the placeholder grid with the calendar's week count once the calendar is read", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);

    expect(placeholderWeeksIn(container)).toHaveLength(WEEKS.length);
  });

  test("places each day in the grid row of its weekday, counting from Sunday", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);
    const rows = cellsIn(container).map((cell) => cell.style.gridRow);

    expect(rows.slice(0, 4)).toEqual(["4", "5", "6", "7"]);
    expect(rows.slice(4)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  test("formats the total in the caption in the browser's locale, marked with a `lang` attribute naming that locale", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
    useContributionCalendar.mockReturnValue(contributionCalendar({ total: 2850 }));

    const { container } = render(<ContributionGraph />);

    expect(container.querySelector("figcaption")?.textContent).toBe(
      `2.850 contributions in the last year, as @${GITHUB_LOGIN}.`,
    );
    expect(screen.getByText("2.850").getAttribute("lang")).toBe("de-DE");
  });

  test("formats the month labels in the browser's locale, marked with a `lang` attribute naming that locale", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("fr-FR");
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);
    const axis = container.querySelector(`.${styles.axis}`);

    expect(axis?.textContent).toBe("janv.");
    expect(axis?.getAttribute("lang")).toBe("fr-FR");
  });

  test("does not set a `lang` attribute on the total or the month labels when the browser's locale is in the document's language", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);

    expect(container.querySelector("figure [lang]")).toBeNull();
  });

  test("renders the `<figcaption>` as the last child of the `<figure>`, with the profile link inside it", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);
    const figcaption = container.querySelector("figure > figcaption:last-child");

    expect(figcaption?.querySelector("a")?.getAttribute("href")).toBe(GITHUB_PROFILE_URL);
  });

  test("gives a day without contributions the lowest level and the busiest day the highest", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);
    const levels = cellsIn(container).map((cell) => cell.getAttribute("data-level"));

    expect(levels.at(0)).toBe("0");
    expect(levels.at(-1)).toBe(String(CONTRIBUTION_LEVEL_COUNT - 1));
  });

  test("hides the grid from the accessibility tree", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);

    expect(cellsIn(container)[0]?.closest("[aria-hidden='true']")).toBeTruthy();
  });

  test("exposes the contribution graph as an image named `Contributions by day` and described by the caption", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    render(<ContributionGraph />);

    expect(
      screen.getByRole("img", {
        name: "Contributions by day",
        description: `1,234 contributions in the last year, as @${GITHUB_LOGIN}.`,
      }),
    ).toBeTruthy();
  });

  test("makes the contribution graph focusable when its weeks overflow its width", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);

    render(<ContributionGraph />);

    expect(screen.getByRole("img", { name: "Contributions by day" }).getAttribute("tabindex")).toBe("0");
  });

  test("does not make the contribution graph focusable when its weeks fit within its width", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);

    render(<ContributionGraph />);

    expect(screen.getByRole("img", { name: "Contributions by day" }).hasAttribute("tabindex")).toBe(false);
  });

  test("makes the contribution graph focusable when a resize makes its weeks overflow its width", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());
    resizeScrollContainer(300, 300);

    render(<ContributionGraph />);
    resizeScrollContainer(600, 300);

    expect(screen.getByRole("img", { name: "Contributions by day" }).getAttribute("tabindex")).toBe("0");
  });

  test("stops making the contribution graph focusable when a resize makes its weeks fit within its width", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());
    resizeScrollContainer(600, 300);

    render(<ContributionGraph />);
    resizeScrollContainer(600, 600);

    expect(screen.getByRole("img", { name: "Contributions by day" }).hasAttribute("tabindex")).toBe(false);
  });

  test("sets the `--contribution-graph-draw-start` custom property of the `<figure>` to `20%`", () => {
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(<ContributionGraph />);

    expect(container.querySelector("figure")?.style.getPropertyValue("--contribution-graph-draw-start")).toBe("20%");
  });

  test("does not set the `data-draw-timeline` attribute while the calendar is being read", () => {
    useContributionCalendar.mockReturnValue(undefined);

    const { container } = render(<ContributionGraph />);

    expect(container.querySelector("figure")?.hasAttribute("data-draw-timeline")).toBe(false);
  });

  test("sets the `data-draw-timeline` attribute to `view` when less than 20% of the figure is in view as the calendar arrives", () => {
    useContributionCalendar.mockReturnValue(undefined);

    const { container, rerender } = render(contributionGraphInScrollPane());

    placeFigure(SCROLL_PANE_HEIGHT_PX - 0.1 * FIGURE_HEIGHT_PX);
    useContributionCalendar.mockReturnValue(contributionCalendar());
    rerender(contributionGraphInScrollPane());

    expect(container.querySelector("figure")?.getAttribute("data-draw-timeline")).toBe("view");
  });

  test("sets the `data-draw-timeline` attribute to `document` when 20% or more of the figure is in view as the calendar arrives", () => {
    useContributionCalendar.mockReturnValue(undefined);

    const { container, rerender } = render(contributionGraphInScrollPane());

    placeFigure(SCROLL_PANE_HEIGHT_PX - 0.2 * FIGURE_HEIGHT_PX);
    useContributionCalendar.mockReturnValue(contributionCalendar());
    rerender(contributionGraphInScrollPane());

    expect(container.querySelector("figure")?.getAttribute("data-draw-timeline")).toBe("document");
  });

  test("sets the `data-draw-timeline` attribute to `document` when the figure mounts in view with the calendar already read", () => {
    placeFigure(0);
    useContributionCalendar.mockReturnValue(contributionCalendar());

    const { container } = render(contributionGraphInScrollPane());

    expect(container.querySelector("figure")?.getAttribute("data-draw-timeline")).toBe("document");
  });

  test("sets the `data-draw-timeline` attribute to `view` when the figure is within the viewport but below the scroll pane as the calendar arrives", () => {
    useContributionCalendar.mockReturnValue(undefined);

    const { container, rerender } = render(contributionGraphInScrollPane());

    placeFigure(SCROLL_PANE_HEIGHT_PX);
    useContributionCalendar.mockReturnValue(contributionCalendar());
    rerender(contributionGraphInScrollPane());

    expect(container.querySelector("figure")?.getAttribute("data-draw-timeline")).toBe("view");
  });

  test("leaves the `data-draw-timeline` attribute at `view` when the figure scrolls into view after the calendar arrives", () => {
    useContributionCalendar.mockReturnValue(undefined);

    const { container, rerender } = render(contributionGraphInScrollPane());

    placeFigure(SCROLL_PANE_HEIGHT_PX);
    useContributionCalendar.mockReturnValue(contributionCalendar());
    rerender(contributionGraphInScrollPane());
    placeFigure(0);
    rerender(contributionGraphInScrollPane());

    expect(container.querySelector("figure")?.getAttribute("data-draw-timeline")).toBe("view");
  });
});

describe("contribution-graph.module.css", () => {
  const stylesheet = postcss.parse(
    readFileSync(join(process.cwd(), "src/features/about/contribution-graph.module.css"), "utf8"),
  );
  const isInForcedColorsQuery = (node: Node): boolean =>
    node.parent !== undefined &&
    ((node.parent.type === "atrule" && (node.parent as AtRule).params === "(forced-colors: active)") ||
      isInForcedColorsQuery(node.parent));
  const levelsInRules = (isForcedColors: boolean) => {
    const levels: Array<number> = [];

    stylesheet.walkRules((rule) => {
      if (isInForcedColorsQuery(rule) === isForcedColors) {
        levels.push(...[...rule.selector.matchAll(/\[data-level="(\d+)"\]/g)].map((match) => Number(match[1])));
      }
    });

    return levels;
  };
  const everyLevel = Array.from({ length: CONTRIBUTION_LEVEL_COUNT }, (_, level) => level);

  test("names each contribution level once in the rules outside `forced-colors` queries", () => {
    expect(levelsInRules(false)).toEqual(everyLevel);
  });

  test("names each contribution level once in the rules inside `forced-colors` queries", () => {
    expect(levelsInRules(true)).toEqual(everyLevel);
  });
});
