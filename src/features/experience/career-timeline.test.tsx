import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { playClickSound } from "#/lib/audio/sounds.ts";
import type { Experience } from "#/lib/experience/career-timeline.ts";
import { DRAG_THRESHOLD_PX } from "#/lib/press/use-pointer-drag.ts";
import { runActivationFlash } from "#/test-utils/menu.ts";
import { MOUSE_PRESS_INIT, TOUCH_PRESS_INIT } from "#/test-utils/press.ts";
import { renderInRouterContext } from "#/test-utils/router-context.tsx";

import styles from "./career-timeline.module.css";
import { CareerTimeline } from "./career-timeline.tsx";

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => {
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  vi.mocked(playClickSound).mockClear();
});

afterEach(() => vi.useRealTimers());

const EXPERIENCE: Experience = {
  asOf: "2026-09",
  disciplines: [
    { id: "first", name: "First", accentColor: "blue" },
    { id: "second", name: "Second", accentColor: "pink" },
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
const HORIZONTAL_LANES_LEFT_PX = 20;
const HORIZONTAL_LANES_TOP_PX = 20;
const HORIZONTAL_LANES_WIDTH_PX = 560;
const POINTER_ID = MOUSE_PRESS_INIT.pointerId;
const FRAME_MS = 16;

const careerTimelineInScrollPane = () => (
  <div data-scroll-pane-viewport>
    <CareerTimeline {...EXPERIENCE} />
  </div>
);

const renderInScrollPane = () => renderInRouterContext(careerTimelineInScrollPane());

const roleTitles = () => screen.queryAllByRole("heading").map((heading) => heading.textContent);
const roleNamed = (title: string) => screen.getByRole("heading", { name: title }).closest("li");
const checkedFilterNamed = (name: string) => screen.getByRole("checkbox", { name, checked: true });

function chooseOrder(label: string) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(screen.getByRole("button", { name: /^Order / }));

  const options = screen.getByRole("listbox", { name: "Order" });

  fireEvent.keyDown(options, { key: label[0]!.toLowerCase() });
  fireEvent.keyDown(options, { key: "Enter" });
  void runActivationFlash();
}

// Returns `element`'s text with elements matching `selector` removed.
function textWithout(element: Element, selector: string): string {
  const copy = element.cloneNode(true) as Element;

  copy.querySelectorAll(selector).forEach((excluded) => excluded.remove());

  return copy.textContent;
}

// Visible text of `element`, excluding text rendered only for assistive technology.
const displayedTextOf = (element: Element) => textWithout(element, `.${styles.spokenText}`);

// Text exposed to assistive technology, excluding `aria-hidden` elements.
const spokenTextOf = (element: Element) => textWithout(element, '[aria-hidden="true"]');

const paragraphWithText = (text: string) => (_content: string, element: Element | null) =>
  element?.tagName === "P" && displayedTextOf(element) === text;
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
      return rectOf(200, 0, 400, this === this.parentElement?.lastElementChild ? 80 : 100); // The last role is shorter, so its height differs from every other role's.
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
      return rectOf(
        HORIZONTAL_LANES_LEFT_PX,
        HORIZONTAL_LANES_TOP_PX,
        HORIZONTAL_LANES_WIDTH_PX,
        HORIZONTAL_CHART_COLUMN_HEIGHT_PX - HORIZONTAL_LANES_TOP_PX,
      );
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

function renderChartScrolledTo(scrollTop: number, layOutChart: (scrollPane: HTMLElement) => void) {
  const { container } = renderInScrollPane();
  const scrollPane = container.firstElementChild as HTMLElement;

  scrollPane.scrollTop = scrollTop;
  layOutChart(scrollPane);

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

// Pointer position over the chart; `clientX`/`clientY` default to the lanes beside/above the list so tests only set the
// axis under test (or both for cross-axis swipes).
interface ChartPoint {
  clientX?: number;
  clientY?: number;
}

const clientPositionAt = ({ clientX = LANES_CENTER_X_PX, clientY = HORIZONTAL_LANES_TOP_PX }: ChartPoint) => ({
  clientX,
  clientY,
});

const press = (chart: Element, point: ChartPoint, init: PointerEventInit = MOUSE_PRESS_INIT) =>
  fireEvent.pointerDown(chart, { ...init, ...clientPositionAt(point) });

function movePointerTo(point: ChartPoint) {
  fireEvent.pointerMove(window, { buttons: 1, pointerId: POINTER_ID, ...clientPositionAt(point) });
  vi.advanceTimersByTime(FRAME_MS);
}

const release = () => fireEvent.pointerUp(window, { pointerId: POINTER_ID });

// Returns the x-coordinate on the horizontal chart at `fraction` along its axis.
const horizontalChartXAt = (fraction: number) => HORIZONTAL_LANES_LEFT_PX + fraction * HORIZONTAL_LANES_WIDTH_PX;

const FRACTION_AMONG_OLDEST_ROLES = 0.9; // Away from the visible-range frame when scrolled to the newest role.

const cancelPointer = () => fireEvent.pointerCancel(window, { pointerId: POINTER_ID }); // Simulates browser scroll claim.

describe("CareerTimeline", () => {
  test("lists every role, newest first", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(roleTitles()).toEqual(["Newest Role", "Middle Role", "Oldest Role"]);
  });

  test("marks the chart with the `aria-hidden` attribute", () => {
    const { container } = renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(container.querySelector(`.${styles.chart}`)?.getAttribute("aria-hidden")).toBe("true");
  });

  test("labels a role's dates from its first month to `Present` when its `end` is `null`", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(
      within(roleNamed("Newest Role")!).getByText(
        paragraphWithText("Newest Organization, Mar 2024\u2060–\u2060Present"),
      ),
    ).toBeTruthy();
  });

  test("labels a role's dates from its first month to its last month when it has ended", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(
      within(roleNamed("Oldest Role")!).getByText(
        paragraphWithText("Oldest Organization, Jan 2015\u2060–\u2060Jun 2018"),
      ),
    ).toBeTruthy();
  });

  test('writes each month in a role\'s dates in full, and joins the dates with "to", in the text that assistive technology reads', () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    const datesParagraph = within(roleNamed("Oldest Role")!).getByText(
      paragraphWithText("Oldest Organization, Jan 2015\u2060–\u2060Jun 2018"),
    );

    expect(spokenTextOf(datesParagraph)).toBe("Oldest Organization, January 2015 to June 2018");
  });

  test("renders a role's dates once, without hiding them from assistive technology, when the browser's locale writes the month as a number", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("ja-JP");

    const { container } = renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    expect(container.querySelector(`.${styles.spokenText}, .${styles.organizationAndDates} [aria-hidden]`)).toBeNull();
    expect(
      within(roleNamed("Oldest Role")!).getByText(
        paragraphWithText("Oldest Organization, 2015年1月\u2060–\u20602018年6月"),
      ),
    ).toBeTruthy();
  });

  test("renders each month in a role's dates as a `<time>` with the month in its `datetime` attribute", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    const times = [...roleNamed("Oldest Role")!.querySelectorAll("time")];

    expect(times.map((time) => [time.tagName, time.getAttribute("datetime")])).toEqual([
      ["TIME", "2015-01"],
      ["TIME", "2018-06"],
    ]);
  });

  test("sets a `lang` attribute naming the browser's locale on each displayed and spoken month when the locale is in a language other than that of the document", () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("de-DE");
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    const role = roleNamed("Oldest Role")!;
    const spokenText = role.querySelector(`.${styles.spokenText}`)!;
    const localizedElements = [...role.querySelectorAll("time"), ...spokenText.querySelectorAll("[lang]")];

    expect(spokenText.getAttribute("lang")).toBeNull();
    expect(localizedElements.map((element) => [element.textContent, element.getAttribute("lang")])).toEqual([
      ["Jan. 2015", "de-DE"],
      ["Juni 2018", "de-DE"],
      ["Januar 2015", "de-DE"],
      ["Juni 2018", "de-DE"],
    ]);
  });

  test("does not set a `lang` attribute on a month when the browser's locale is in the document's language", () => {
    const { container } = renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(container.querySelector("time[lang]")).toBeNull();
  });

  test("labels a role with every discipline it lists, in the order it lists them", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(within(roleNamed("Middle Role")!).getByText("Second, First")).toBeTruthy();
  });

  test("renders a role's heading before its disciplines and dates in document order", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    const role = roleNamed("Middle Role")!;
    const heading = within(role).getByRole("heading", { name: "Middle Role" });

    for (const label of [
      within(role).getByText("Second, First"),
      within(role).getByText(paragraphWithText("Middle Organization, Jan 2019\u2060–\u2060Jun 2021")),
    ]) {
      expect(heading.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  test("renders a role's highlights and its link", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    expect(screen.getByText("A highlight of the newest role.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read the entry" }).getAttribute("href")).toBe("/collection/entry");
  });

  test("renders a checked filter for every discipline, in a list labeled `Disciplines` that sets the `role` attribute to `list`", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    const list = screen.getByRole("list", { name: "Disciplines" });

    expect(list.getAttribute("role")).toBe("list");
    expect(within(list).getByRole("checkbox", { name: "First", checked: true })).toBeTruthy();
    expect(within(list).getByRole("checkbox", { name: "Second", checked: true })).toBeTruthy();
  });

  test("renders the roles in an `<ol>` that sets the `role` attribute to `list`", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    expect(document.querySelector("ol")?.getAttribute("role")).toBe("list");
  });

  test("omits a role from the list once the filter for every discipline it lists is unchecked", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    fireEvent.click(checkedFilterNamed("Second"));

    expect(roleTitles()).toEqual(["Newest Role", "Middle Role"]);
    expect(screen.getByRole("checkbox", { name: "Second", checked: false })).toBeTruthy();
  });

  test("lists a discipline's roles again when its filter is checked again", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    fireEvent.click(checkedFilterNamed("Second"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Second", checked: false }));

    expect(roleTitles()).toHaveLength(3);
  });

  test("colors a listed role with the accent color of the first of its disciplines with a checked filter", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    const accentColorOfMiddleRole = () =>
      roleNamed("Middle Role")?.style.getPropertyValue("--career-timeline-discipline-accent-color");

    expect(accentColorOfMiddleRole()).toBe("var(--accent-pink)");

    fireEvent.click(checkedFilterNamed("Second"));

    expect(accentColorOfMiddleRole()).toBe("var(--accent-blue)");
  });

  test("renders the empty-state message when every filter is unchecked", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    expect(screen.getByRole("status").textContent).toBe("");

    fireEvent.click(checkedFilterNamed("First"));
    fireEvent.click(checkedFilterNamed("Second"));

    expect(screen.getByRole("status").textContent).toBe("Select a discipline to view roles.");
  });

  test("lists the roles newest first by default, with `Newest first` chosen in the order menu", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);

    expect(roleTitles()).toEqual(["Newest Role", "Middle Role", "Oldest Role"]);
    expect(screen.getByRole("button", { name: "Order Newest first" })).toBeTruthy();
  });

  test("reverses the order of the roles when `Oldest first` is chosen from the order menu", () => {
    renderInRouterContext(<CareerTimeline {...EXPERIENCE} />);
    chooseOrder("Oldest first");

    expect(roleTitles()).toEqual(["Oldest Role", "Middle Role", "Newest Role"]);
  });

  test("sets the `--career-timeline-last-role-height` custom property of the career timeline to the last role's height", () => {
    layOutRolesInView();

    const { container } = renderInScrollPane();

    expect(
      container
        .querySelector<HTMLElement>(`.${styles.careerTimeline}`)
        ?.style.getPropertyValue("--career-timeline-last-role-height"),
    ).toBe("80px");
  });

  test("removes the `--career-timeline-last-role-height` custom property from the career timeline when every filter is unchecked", () => {
    layOutRolesInView();

    const { container } = renderInScrollPane();
    const careerTimeline = container.querySelector<HTMLElement>(`.${styles.careerTimeline}`);

    expect(careerTimeline?.style.getPropertyValue("--career-timeline-last-role-height")).toBe("80px");

    fireEvent.click(checkedFilterNamed("First"));
    fireEvent.click(checkedFilterNamed("Second"));

    expect(careerTimeline?.style.getPropertyValue("--career-timeline-last-role-height")).toBe("");
  });

  test("stops marking the visible-range frame with the `data-visible` attribute when every filter is unchecked", () => {
    layOutRolesInView();

    const { container } = renderInScrollPane();
    const visibleRangeFrame = container.querySelector(`.${styles.visibleRangeFrame}`);

    expect(visibleRangeFrame?.hasAttribute("data-visible")).toBe(true);

    fireEvent.click(checkedFilterNamed("First"));
    fireEvent.click(checkedFilterNamed("Second"));

    expect(visibleRangeFrame?.hasAttribute("data-visible")).toBe(false);
  });

  test("measures the visible-range frame again when another order is chosen", () => {
    const { container } = renderInScrollPane();
    const scrollPane = container.firstElementChild as HTMLElement;

    layOutChartAboveList(scrollPane);
    chooseOrder("Oldest first");

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

    const { scrollPane, chart } = renderChartScrolledTo(MAXIMUM_SCROLL_TOP_PX, layOutChartBesideList);
    const frame = measureVisibleRangeFrameEdges(scrollPane);

    press(chart, { clientY: (frame.top + frame.bottom) / 2 });
    vi.advanceTimersByTime(FRAME_MS);
    release();

    expect(scrollPane.scrollTop).toBe(MAXIMUM_SCROLL_TOP_PX);
  });

  test("leaves the scroll pane scrolled to the end when the visible-range frame is dragged down from the end of the list", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(MAXIMUM_SCROLL_TOP_PX, layOutChartBesideList);
    const frame = measureVisibleRangeFrameEdges(scrollPane);

    press(chart, { clientY: frame.bottom - 2 });
    movePointerTo({ clientY: frame.bottom - 1 });
    movePointerTo({ clientY: frame.bottom + 20 });

    expect(scrollPane.scrollTop).toBe(MAXIMUM_SCROLL_TOP_PX);

    release();
  });

  test("moves the visible-range frame by the pointer's travel when it is dragged before the chart sticks", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(0, layOutChartBesideList);
    const frameAtPress = measureVisibleRangeFrameEdges(scrollPane);
    const pressY = (frameAtPress.top + frameAtPress.bottom) / 2;

    press(chart, { clientY: pressY });
    movePointerTo({ clientY: pressY + 10 });

    const scrollTopAfterFirstMove = scrollPane.scrollTop;

    movePointerTo({ clientY: pressY + 11 });
    movePointerTo({ clientY: pressY + 10 });
    movePointerTo({ clientY: pressY + 10 });

    expect(scrollPane.scrollTop).toBe(scrollTopAfterFirstMove);

    const frameAfterDrag = measureVisibleRangeFrameEdges(scrollPane);
    const chartTravel = Math.min(scrollPane.scrollTop, LIST_TOP_PX - CHART_STICKY_TOP_PX);
    const centerTravel =
      (frameAfterDrag.top + frameAfterDrag.bottom) / 2 + chartTravel - (frameAtPress.top + frameAtPress.bottom) / 2;

    expect(centerTravel).toBeCloseTo(10, 1);

    release();
  });

  test("scrolls the list to the point of a mouse press on the chart and plays the click sound before the pointer moves", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(LIST_TOP_PX, layOutChartAboveList);

    press(chart, { clientX: horizontalChartXAt(FRACTION_AMONG_OLDEST_ROLES) });

    expect(scrollPane.scrollTop).toBeGreaterThan(LIST_TOP_PX);
    expect(playClickSound).toHaveBeenCalledOnce();

    release();
  });

  test("does not scroll the list or play the click sound for a touch press on the chart until it travels along the chart's axis past the drag threshold", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(LIST_TOP_PX, layOutChartAboveList);
    const pressX = horizontalChartXAt(FRACTION_AMONG_OLDEST_ROLES);

    press(chart, { clientX: pressX }, TOUCH_PRESS_INIT);
    movePointerTo({ clientX: pressX + DRAG_THRESHOLD_PX, clientY: HORIZONTAL_LANES_TOP_PX + 40 }); // A vertical swipe that the browser can claim.

    expect(scrollPane.scrollTop).toBe(LIST_TOP_PX);
    expect(playClickSound).not.toHaveBeenCalled();

    movePointerTo({ clientX: pressX + DRAG_THRESHOLD_PX + 1 });

    expect(scrollPane.scrollTop).toBeGreaterThan(LIST_TOP_PX);
    expect(playClickSound).toHaveBeenCalledOnce();

    release();
  });

  test("does not scroll the list or play the click sound for a touch press on the chart that travels further across the chart's axis than along it", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(LIST_TOP_PX, layOutChartAboveList);
    const pressX = horizontalChartXAt(FRACTION_AMONG_OLDEST_ROLES);

    press(chart, { clientX: pressX }, TOUCH_PRESS_INIT);
    movePointerTo({ clientX: pressX + DRAG_THRESHOLD_PX + 2, clientY: HORIZONTAL_LANES_TOP_PX + 20 }); // A diagonal swipe that the browser can claim.

    expect(scrollPane.scrollTop).toBe(LIST_TOP_PX);
    expect(playClickSound).not.toHaveBeenCalled();
  });

  test("does not scroll the list or play the click sound for a touch press on the chart canceled by the browser before it travels past the drag threshold", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(LIST_TOP_PX, layOutChartAboveList);
    const pressX = horizontalChartXAt(FRACTION_AMONG_OLDEST_ROLES);

    press(chart, { clientX: pressX }, TOUCH_PRESS_INIT);
    movePointerTo({ clientX: pressX, clientY: HORIZONTAL_LANES_TOP_PX + 40 });
    cancelPointer();

    expect(scrollPane.scrollTop).toBe(LIST_TOP_PX);
    expect(playClickSound).not.toHaveBeenCalled();
  });

  test("returns the scroll pane to its scroll position at the press when the browser cancels a touch drag on the chart", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(LIST_TOP_PX, layOutChartAboveList);
    const pressX = horizontalChartXAt(FRACTION_AMONG_OLDEST_ROLES);

    press(chart, { clientX: pressX }, TOUCH_PRESS_INIT);
    movePointerTo({ clientX: pressX + 20 });

    expect(scrollPane.scrollTop).toBeGreaterThan(LIST_TOP_PX);

    cancelPointer();

    expect(scrollPane.scrollTop).toBe(LIST_TOP_PX);
  });

  test("scrolls the list to the point of a tap on the chart and plays the click sound on its `click` event", () => {
    vi.useFakeTimers();

    const { scrollPane, chart } = renderChartScrolledTo(LIST_TOP_PX, layOutChartAboveList);

    press(chart, { clientX: horizontalChartXAt(FRACTION_AMONG_OLDEST_ROLES) }, TOUCH_PRESS_INIT);

    expect(scrollPane.scrollTop).toBe(LIST_TOP_PX);
    expect(playClickSound).not.toHaveBeenCalled();

    fireEvent.pointerUp(chart, { pointerId: POINTER_ID, button: 0 });

    expect(scrollPane.scrollTop).toBe(LIST_TOP_PX);

    fireEvent.click(chart, { detail: 1 });

    expect(scrollPane.scrollTop).toBeGreaterThan(LIST_TOP_PX);
    expect(playClickSound).toHaveBeenCalledOnce();
  });
});
