import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Experience } from "#/lib/experience/career-timeline.ts";
import { RouterContext } from "#/test-utils/router-context.tsx";

import styles from "./career-timeline.module.css";
import { CareerTimeline } from "./career-timeline.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
});

afterEach(() => vi.useRealTimers());

const EXPERIENCE: Experience = {
  asOf: "2026-09",
  disciplines: [
    { id: "first", name: "First", accentColor: "blue" },
    { id: "second", name: "Second", accentColor: "magenta" },
  ],
  roles: [
    {
      title: "Newest Role",
      organization: "Newest Organization",
      disciplines: ["first"],
      start: "2024-03",
      end: null,
      summary: "A summary of the newest role.",
      highlights: ["A highlight of the newest role."],
      link: { label: "Read the entry", href: "/collection/entry" },
    },
    {
      title: "Middle Role",
      organization: "Middle Organization",
      disciplines: ["second", "first"],
      start: "2019-01",
      end: "2021-06",
      summary: "A summary of the middle role.",
    },
    {
      title: "Oldest Role",
      organization: "Oldest Organization",
      disciplines: ["second"],
      start: "2015-01",
      end: "2018-06",
      summary: "A summary of the oldest role.",
    },
  ],
};
const SCROLL_PANE_HEIGHT_PX = 500;
const LIST_TOP_PX = 400;
const ROLE_HEIGHT_PX = 300;
const ROLE_GAP_PX = 40;
const LIST_HEIGHT_PX = 3 * ROLE_HEIGHT_PX + 2 * ROLE_GAP_PX;
const MAXIMUM_SCROLL_TOP_PX = LIST_TOP_PX + LIST_HEIGHT_PX - SCROLL_PANE_HEIGHT_PX;
const CHART_STICKY_TOP_PX = 16;
const LANES_HEIGHT_PX = 400;
const LANES_CENTER_X_PX = 140;
const HORIZONTAL_CHART_COLUMN_HEIGHT_PX = 60;
const POINTER_ID = 1;
const FRAME_MS = 16;

const careerTimelineInScrollPane = () => (
  <div data-scroll-pane-viewport>
    <CareerTimeline {...EXPERIENCE} />
  </div>
);

const renderInScrollPane = () => render(careerTimelineInScrollPane(), { wrapper: RouterContext });

const roleTitles = () => screen.queryAllByRole("heading").map((heading) => heading.textContent);
const roleNamed = (title: string) => screen.getByRole("heading", { name: title }).closest("li");
const pressedFilterNamed = (name: string) => screen.getByRole("button", { name, pressed: true });
const paragraphWithText = (text: string) => (_content: string, element: Element | null) =>
  element?.tagName === "P" && element.textContent === text;
const rectOf = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
});

function layOutRolesInView() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this.tagName === "OL") {
      return rectOf(200, 0, 400, 300);
    }

    if (this.tagName === "LI") {
      return rectOf(200, 0, 400, 100);
    }

    return rectOf(0, 0, 100, 1000);
  });
}

function layOutChartBesideList(scrollPane: HTMLElement) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const listTop = LIST_TOP_PX - scrollPane.scrollTop;
    const chartTop = Math.max(CHART_STICKY_TOP_PX, listTop);

    if (this === scrollPane) {
      return rectOf(0, 0, 800, SCROLL_PANE_HEIGHT_PX);
    }

    if (this.matches(`.${styles.chartColumn}`)) {
      return rectOf(0, chartTop, 180, LANES_HEIGHT_PX);
    }

    if (this.matches(`.${styles.lanes}`)) {
      return rectOf(LANES_CENTER_X_PX - 40, chartTop, 80, LANES_HEIGHT_PX);
    }

    if (this.tagName === "OL") {
      return rectOf(200, listTop, 400, LIST_HEIGHT_PX);
    }

    if (this.parentElement?.tagName === "OL") {
      const index = [...this.parentElement.children].indexOf(this);

      return rectOf(200, listTop + index * (ROLE_HEIGHT_PX + ROLE_GAP_PX), 400, ROLE_HEIGHT_PX);
    }

    return rectOf(0, 0, 0, 0);
  });
}

function layOutChartAboveList(scrollPane: HTMLElement) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const listTop = LIST_TOP_PX - scrollPane.scrollTop;

    if (this === scrollPane) {
      return rectOf(0, 0, 600, SCROLL_PANE_HEIGHT_PX);
    }

    if (this.matches(`.${styles.chartColumn}`)) {
      return rectOf(0, 0, 600, HORIZONTAL_CHART_COLUMN_HEIGHT_PX);
    }

    if (this.matches(`.${styles.lanes}`)) {
      return rectOf(20, 20, 560, HORIZONTAL_CHART_COLUMN_HEIGHT_PX - 20);
    }

    if (this.tagName === "OL") {
      return rectOf(0, listTop, 600, LIST_HEIGHT_PX);
    }

    if (this.parentElement?.tagName === "OL") {
      const index = [...this.parentElement.children].indexOf(this);

      return rectOf(0, listTop + index * (ROLE_HEIGHT_PX + ROLE_GAP_PX), 600, ROLE_HEIGHT_PX);
    }

    return rectOf(0, 0, 0, 0);
  });
}

function renderChartBesideListScrolledTo(scrollTop: number) {
  const { container } = renderInScrollPane();
  const scrollPane = container.firstElementChild as HTMLElement;

  scrollPane.scrollTop = scrollTop;
  layOutChartBesideList(scrollPane);

  return { scrollPane, chart: container.querySelector(`.${styles.chart}`)! };
}

function visibleRangeFramePlacementIn(root: HTMLElement) {
  const visibleRangeFrame = root.querySelector<HTMLElement>(`.${styles.visibleRangeFrame}`)!;

  return {
    offset: Number(visibleRangeFrame.style.getPropertyValue("--career-timeline-placement-offset")),
    size: Number(visibleRangeFrame.style.getPropertyValue("--career-timeline-placement-size")),
  };
}

function measureVisibleRangeFrameEdges(scrollPane: HTMLElement) {
  fireEvent.scroll(scrollPane);
  vi.advanceTimersByTime(FRAME_MS);

  const { offset, size } = visibleRangeFramePlacementIn(scrollPane);
  const chartTop = Math.max(CHART_STICKY_TOP_PX, LIST_TOP_PX - scrollPane.scrollTop);

  return { top: chartTop + offset * LANES_HEIGHT_PX, bottom: chartTop + (offset + size) * LANES_HEIGHT_PX };
}

const press = (chart: Element, clientY: number) =>
  fireEvent.pointerDown(chart, { button: 0, pointerId: POINTER_ID, clientX: LANES_CENTER_X_PX, clientY });

function dragTo(clientY: number) {
  fireEvent.pointerMove(window, { buttons: 1, pointerId: POINTER_ID, clientX: LANES_CENTER_X_PX, clientY });
  vi.advanceTimersByTime(FRAME_MS);
}

const release = () => fireEvent.pointerUp(window, { pointerId: POINTER_ID });

describe("CareerTimeline", () => {
  test("lists every role, newest first", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(roleTitles()).toEqual(["Newest Role", "Middle Role", "Oldest Role"]);
  });

  test("marks the chart with the `aria-hidden` attribute", () => {
    const { container } = render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(container.querySelector(`.${styles.chart}`)?.getAttribute("aria-hidden")).toBe("true");
  });

  test("labels a role's dates from its first month to `Present` when its `end` is `null`", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(within(roleNamed("Newest Role")!).getByText(paragraphWithText("Mar 2024–Present"))).toBeTruthy();
  });

  test("labels a role's dates from its first month to its last month when it has ended", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(within(roleNamed("Oldest Role")!).getByText(paragraphWithText("Jan 2015–Jun 2018"))).toBeTruthy();
  });

  test("renders each month in a role's dates as a `<time>` with the month in its `datetime` attribute", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    const times = within(roleNamed("Oldest Role")!).getAllByText(/2015|2018/);

    expect(times.map((time) => [time.tagName, time.getAttribute("datetime")])).toEqual([
      ["TIME", "2015-01"],
      ["TIME", "2018-06"],
    ]);
  });

  test("marks each month with a `lang` attribute naming the browser's locale when its language differs from the document's", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    const months = within(roleNamed("Oldest Role")!).getAllByText(/2015|2018/);

    expect(months.map((month) => month.getAttribute("lang"))).toEqual(["de-DE", "de-DE"]);
  });

  test("does not set a `lang` attribute on a month when the browser's locale is in the document's language", () => {
    const { container } = render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(container.querySelector("time[lang]")).toBeNull();
  });

  test("labels a role with every discipline it lists, in the order it lists them", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(within(roleNamed("Middle Role")!).getByText("Second, First")).toBeTruthy();
  });

  test("renders a role's heading before its disciplines and dates in document order", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    const role = roleNamed("Middle Role")!;
    const heading = within(role).getByRole("heading", { name: "Middle Role" });

    for (const label of [
      within(role).getByText("Second, First"),
      within(role).getByText(paragraphWithText("Jan 2019–Jun 2021")),
    ]) {
      expect(heading.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  test("renders a role's highlights and its link", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    expect(screen.getByText("A highlight of the newest role.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read the entry" }).getAttribute("href")).toBe("/collection/entry");
  });

  test("renders a role's link inside an element whose `data-content-default-styles` attribute is `on`", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    expect(
      screen.getByRole("link", { name: "Read the entry" }).closest('[data-content-default-styles="on"]'),
    ).toBeTruthy();
  });

  test("renders a pressed filter for every discipline, in a group labeled `Show`", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    const group = screen.getByRole("group", { name: "Show" });

    expect(within(group).getByRole("button", { name: "First", pressed: true })).toBeTruthy();
    expect(within(group).getByRole("button", { name: "Second", pressed: true })).toBeTruthy();
  });

  test("omits a role from the list once the filter for every discipline it lists is toggled off", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    fireEvent.click(pressedFilterNamed("Second"));

    expect(roleTitles()).toEqual(["Newest Role", "Middle Role"]);
    expect(screen.getByRole("button", { name: "Second", pressed: false })).toBeTruthy();
  });

  test("lists a discipline's roles again when its filter is toggled back on", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });
    fireEvent.click(pressedFilterNamed("Second"));
    fireEvent.click(screen.getByRole("button", { name: "Second", pressed: false }));

    expect(roleTitles()).toHaveLength(3);
  });

  test("colors a listed role with the accent color of the first discipline it lists whose filter is pressed", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    const accentColorOfMiddleRole = () => roleNamed("Middle Role")?.style.getPropertyValue("--discipline-accent-color");

    expect(accentColorOfMiddleRole()).toBe("var(--accent-magenta)");

    fireEvent.click(pressedFilterNamed("Second"));

    expect(accentColorOfMiddleRole()).toBe("var(--accent-blue)");
  });

  test("renders the empty-state message when every filter is toggled off", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    expect(screen.getByRole("status").textContent).toBe("");

    fireEvent.click(pressedFilterNamed("First"));
    fireEvent.click(pressedFilterNamed("Second"));

    expect(screen.getByRole("status").textContent).toBe("No roles match the selected disciplines.");
  });

  test("reverses the order of the roles when the direction button is pressed", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    fireEvent.click(screen.getByRole("button", { name: "Newest first" }));

    expect(roleTitles()).toEqual(["Oldest Role", "Middle Role", "Newest Role"]);
  });

  test("names the direction button after the order the roles are listed in once it is pressed", () => {
    render(<CareerTimeline {...EXPERIENCE} />, { wrapper: RouterContext });

    fireEvent.click(screen.getByRole("button", { name: "Newest first" }));

    expect(screen.getByRole("button", { name: "Oldest first", description: "Orders the roles by date" })).toBeTruthy();
  });

  test("stops marking the visible-range frame with the `data-visible` attribute when every filter is toggled off", () => {
    layOutRolesInView();

    const { container } = renderInScrollPane();
    const visibleRangeFrame = container.querySelector(`.${styles.visibleRangeFrame}`);

    expect(visibleRangeFrame?.hasAttribute("data-visible")).toBe(true);

    fireEvent.click(pressedFilterNamed("First"));
    fireEvent.click(pressedFilterNamed("Second"));

    expect(visibleRangeFrame?.hasAttribute("data-visible")).toBe(false);
  });

  test("measures the visible-range frame again when the direction button is pressed", () => {
    const { container } = renderInScrollPane();
    const scrollPane = container.firstElementChild as HTMLElement;

    layOutChartAboveList(scrollPane);
    fireEvent.click(screen.getByRole("button", { name: "Newest first" }));

    expect(visibleRangeFramePlacementIn(container).offset).toBe(0);
  });

  test("adds one `scroll` listener to the scroll pane across renders that leave the direction and the filters unchanged", () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const { container, rerender } = renderInScrollPane();
    const scrollPane = container.firstElementChild;

    rerender(careerTimelineInScrollPane());
    rerender(careerTimelineInScrollPane());

    const scrollPaneScrollListenerCount = addEventListener.mock.calls.filter(
      ([type], index) => type === "scroll" && addEventListener.mock.contexts[index] === scrollPane,
    ).length;

    expect(scrollPaneScrollListenerCount).toBe(1);
  });

  test("starts the visible-range frame at the part of the roles below the chart when the chart is stuck above the list", () => {
    const { container } = renderInScrollPane();
    const scrollPane = container.firstElementChild as HTMLElement;
    const newestRoleSize = 31 / 141; // Newest first, the newest role's dates start the range, at `0`, and run 31 of its 141 months.

    scrollPane.scrollTop = LIST_TOP_PX;
    layOutChartAboveList(scrollPane);
    vi.useFakeTimers();
    fireEvent.scroll(scrollPane);
    vi.advanceTimersByTime(FRAME_MS);

    expect(visibleRangeFramePlacementIn(container).offset).toBeCloseTo(
      (HORIZONTAL_CHART_COLUMN_HEIGHT_PX / ROLE_HEIGHT_PX) * newestRoleSize,
      5,
    );
  });

  test("leaves the scroll pane's scroll position unchanged when the visible-range frame is pressed without the pointer moving", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartBesideListScrolledTo(MAXIMUM_SCROLL_TOP_PX);
    const frame = measureVisibleRangeFrameEdges(scrollPane);

    press(chart, (frame.top + frame.bottom) / 2);
    vi.advanceTimersByTime(FRAME_MS);
    release();

    expect(scrollPane.scrollTop).toBe(MAXIMUM_SCROLL_TOP_PX);
  });

  test("leaves the scroll pane scrolled to the end when the visible-range frame is dragged down from the end of the list", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartBesideListScrolledTo(MAXIMUM_SCROLL_TOP_PX);
    const frame = measureVisibleRangeFrameEdges(scrollPane);

    press(chart, frame.bottom - 2);
    dragTo(frame.bottom - 1);
    dragTo(frame.bottom + 20);

    expect(scrollPane.scrollTop).toBe(MAXIMUM_SCROLL_TOP_PX);

    release();
  });

  test("moves the visible-range frame by the pointer's travel when it is dragged before the chart sticks", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartBesideListScrolledTo(0);
    const frameAtPress = measureVisibleRangeFrameEdges(scrollPane);
    const pressY = (frameAtPress.top + frameAtPress.bottom) / 2;

    press(chart, pressY);
    dragTo(pressY + 10);

    const scrollTopAfterFirstMove = scrollPane.scrollTop;

    dragTo(pressY + 11);
    dragTo(pressY + 10);
    dragTo(pressY + 10);

    expect(scrollPane.scrollTop).toBe(scrollTopAfterFirstMove);

    const frameAfterDrag = measureVisibleRangeFrameEdges(scrollPane);
    const chartTravel = Math.min(scrollPane.scrollTop, LIST_TOP_PX - CHART_STICKY_TOP_PX);
    const centerTravel =
      (frameAfterDrag.top + frameAfterDrag.bottom) / 2 + chartTravel - (frameAtPress.top + frameAtPress.bottom) / 2;

    expect(centerTravel).toBeCloseTo(10, 1);

    release();
  });
});
