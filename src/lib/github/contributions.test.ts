import { describe, expect, test } from "vitest";

import {
  CONTRIBUTION_LEVEL_COUNT,
  busiestCountIn,
  contributionLevelOf,
  monthLabelsFor,
  weekdayOf,
} from "./contributions.ts";

import type { ContributionDay } from "./contributions.ts";

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

const day = (date: string, count = 0): ContributionDay => ({ date, count });
const weeksStarting = (...sundays: Array<string>) => sundays.map((sunday) => [day(sunday)]);

describe("contributionLevelOf", () => {
  test("returns `0` for a count of `0`", () => {
    expect(contributionLevelOf(0, 20)).toBe(0);
  });

  test("returns `CONTRIBUTION_LEVEL_COUNT - 1` for the busiest count", () => {
    expect(contributionLevelOf(20, 20)).toBe(CONTRIBUTION_LEVEL_COUNT - 1);
  });

  test("returns `1` for a count of `1` against a busiest count of `400`", () => {
    expect(contributionLevelOf(1, 400)).toBe(1);
  });

  test("returns the same level for counts in the same proportion to the busiest count", () => {
    expect(contributionLevelOf(5, 20)).toBe(contributionLevelOf(50, 200));
  });

  test("returns `0` when the busiest count is `0`", () => {
    expect(contributionLevelOf(0, 0)).toBe(0);
    expect(contributionLevelOf(3, 0)).toBe(0);
  });

  test("returns `CONTRIBUTION_LEVEL_COUNT - 1` for a count above the busiest count", () => {
    expect(contributionLevelOf(500, 20)).toBe(CONTRIBUTION_LEVEL_COUNT - 1);
  });
});

describe("busiestCountIn", () => {
  test("returns the largest count across every week", () => {
    expect(busiestCountIn([[day("2026-01-03", 3)], [day("2026-01-04", 11), day("2026-01-05", 0)]])).toBe(11);
  });

  test("returns `0` for an empty list", () => {
    expect(busiestCountIn([])).toBe(0);
  });
});

describe("weekdayOf", () => {
  test.each([
    ["2026-01-04", 0],
    ["2026-01-07", 3],
    ["2026-01-10", 6],
  ])("returns the weekday of `%s` as `%i`, counting from Sunday", (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });
});

describe("monthLabelsFor", () => {
  test("labels the first week and each week whose first day is in a new month", () => {
    const weeks = weeksStarting("2026-01-04", "2026-01-11", "2026-01-18", "2026-01-25", "2026-02-01", "2026-02-08");
    expect(monthLabelsFor(weeks, MONTH_LABEL_FORMAT)).toEqual([
      { weekIndex: 0, label: "Jan" },
      { weekIndex: 4, label: "Feb" },
    ]);
  });

  test("labels a partial first week with its month when the second week starts in the same month", () => {
    const weeks = [
      [day("2026-01-07"), day("2026-01-08"), day("2026-01-09"), day("2026-01-10")],
      ...weeksStarting("2026-01-11", "2026-01-18", "2026-01-25", "2026-02-01"),
    ];
    expect(monthLabelsFor(weeks, MONTH_LABEL_FORMAT)).toEqual([
      { weekIndex: 0, label: "Jan" },
      { weekIndex: 4, label: "Feb" },
    ]);
  });

  test("omits the first week's label when the next label is fewer than three weeks after it", () => {
    const weeks = weeksStarting("2026-01-18", "2026-01-25", "2026-02-01", "2026-02-08");
    expect(monthLabelsFor(weeks, MONTH_LABEL_FORMAT)).toEqual([{ weekIndex: 2, label: "Feb" }]);
  });

  test("labels a month again when it recurs a year later", () => {
    const weeks = weeksStarting("2025-09-28", "2025-10-05", "2025-10-12", "2026-09-27");
    expect(monthLabelsFor(weeks, MONTH_LABEL_FORMAT).map(({ label }) => label)).toEqual(["Oct", "Sep"]);
  });

  test("returns an empty array for an empty list", () => {
    expect(monthLabelsFor([], MONTH_LABEL_FORMAT)).toEqual([]);
  });
});
