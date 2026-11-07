import { describe, expect, test } from "vitest";

import {
  careerTimelineModelFrom,
  careerTimelinePlacementOf,
  firstMonthIndexOf,
  mergeMonthSpans,
  monthIndexOf,
  monthOffsetOf,
  monthSpanOf,
  orderedCareerTimelineRoles,
  roleDatesLabelOf,
  roleDatesLabelPartsOf,
  roleDisciplinesLabelOf,
  yearsIn,
} from "./career-timeline.ts";

import type { CareerTimelineDirection, Experience, MonthSpan, Role } from "./career-timeline.ts";

const AS_OF = "2026-09";
const MONTH_FORMAT = new Intl.DateTimeFormat("en-AU", { year: "numeric", month: "short", timeZone: "UTC" });

const role = (overrides: Partial<Role> = {}): Role => ({
  title: "Role",
  organization: "Organization",
  disciplines: ["first"],
  start: "2020-01",
  end: "2021-12",
  summary: "A summary.",
  ...overrides,
});

const EXPERIENCE: Experience = {
  asOf: AS_OF,
  disciplines: [
    { id: "first", name: "First", accentColor: "blue" },
    { id: "second", name: "Second", accentColor: "pink" },
  ],
  roles: [
    role({ title: "Current", disciplines: ["first"], start: "2024-03", end: null }),
    role({ title: "Middle", disciplines: ["second", "first"], start: "2018-06", end: "2022-02" }),
    role({ title: "Earliest", disciplines: ["second"], start: "2015-01", end: "2016-08" }),
  ],
};

const experienceWith = (roles: ReadonlyArray<Role>): Experience => ({ ...EXPERIENCE, roles });

describe("monthIndexOf", () => {
  test("returns the number of months since January of year 0", () => {
    expect(monthIndexOf("2020-01")).toBe(2020 * 12);
    expect(monthIndexOf("2020-12")).toBe(2020 * 12 + 11);
  });

  test("throws when the month is not authored as `YYYY-MM`, naming the value", () => {
    expect(() => monthIndexOf("2020")).toThrow('Expected a month as "YYYY-MM", but received "2020".');
    expect(() => monthIndexOf("2020-13")).toThrow('"2020-13"');
    expect(() => monthIndexOf("2020-1")).toThrow('"2020-1"');
  });
});

describe("roleDatesLabelPartsOf", () => {
  test("returns the label's parts, with each month produced by `monthPart`", () => {
    expect(roleDatesLabelPartsOf(role({ start: "2015-01", end: "2018-06" }), (month) => ({ month }))).toEqual([
      { month: "2015-01" },
      "–",
      { month: "2018-06" },
    ]);
  });

  test("returns `Present` in place of the last month when the role's `end` is `null`", () => {
    expect(roleDatesLabelPartsOf(role({ start: "2024-03", end: null }), (month) => ({ month }))).toEqual([
      { month: "2024-03" },
      "–",
      "Present",
    ]);
  });
});

describe("roleDatesLabelOf", () => {
  // en-AU abbreviates a month to three letters, except June and July, which it writes in full, and September, which it
  // writes as "Sept".

  test("formats a role's dates from its first month to its last month when it has ended", () => {
    expect(roleDatesLabelOf(role({ start: "2015-01", end: "2018-06" }), MONTH_FORMAT)).toBe("Jan 2015–June 2018");
  });

  test("formats a role's dates from its first month to `Present` when its `end` is `null`", () => {
    expect(roleDatesLabelOf(role({ start: "2024-03", end: null }), MONTH_FORMAT)).toBe("Mar 2024–Present");
  });
});

describe("roleDisciplinesLabelOf", () => {
  test("joins the names of a role's disciplines with commas, in the order the role lists them", () => {
    const middle = careerTimelineModelFrom(EXPERIENCE).careerTimelineRoles.find(
      ({ role: { title } }) => title === "Middle",
    );
    expect(middle && roleDisciplinesLabelOf(middle)).toBe("Second, First");
  });
});

describe("monthSpanOf", () => {
  test("returns a span from a role's start month to the month after its end month", () => {
    expect(monthSpanOf(role({ start: "2020-01", end: "2020-03" }), monthIndexOf("2026-09"))).toEqual({
      start: monthIndexOf("2020-01"),
      end: monthIndexOf("2020-04"),
    });
  });

  test("returns a span from a role's start month to the month after the `asOf` month when its `end` is `null`", () => {
    const asOfMonthIndex = monthIndexOf("2026-09");
    expect(monthSpanOf(role({ start: "2024-03", end: null }), asOfMonthIndex)).toEqual({
      start: monthIndexOf("2024-03"),
      end: asOfMonthIndex + 1,
    });
  });
});

describe("mergeMonthSpans", () => {
  const span = (start: number, end: number): MonthSpan => ({ start, end });

  test("merges month spans that overlap", () => {
    expect(mergeMonthSpans([span(0, 10), span(5, 15)])).toEqual([span(0, 15)]);
  });

  test("merges month spans where one ends as the next starts", () => {
    expect(mergeMonthSpans([span(0, 10), span(10, 20)])).toEqual([span(0, 20)]);
  });

  test("returns month spans separated by a gap unmerged", () => {
    expect(mergeMonthSpans([span(0, 10), span(12, 20)])).toEqual([span(0, 10), span(12, 20)]);
  });

  test("orders the month spans it returns by start, whatever order it receives them in", () => {
    expect(mergeMonthSpans([span(30, 40), span(0, 10)])).toEqual([span(0, 10), span(30, 40)]);
  });

  test("returns an empty array when given an empty array", () => {
    expect(mergeMonthSpans([])).toEqual([]);
  });
});

describe("careerTimelineModelFrom", () => {
  test("starts the range at the first month of the year the earliest role starts in, and ends it the month after the `asOf` month", () => {
    expect(careerTimelineModelFrom(EXPERIENCE).range).toEqual({
      start: firstMonthIndexOf(2015),
      end: monthIndexOf("2026-10"),
    });
  });

  test("ends the range the month after the `asOf` month even when every role has ended", () => {
    const { range } = careerTimelineModelFrom(experienceWith([role({ start: "2015-01", end: "2020-06" })]));
    expect(range.end).toBe(monthIndexOf("2026-10"));
  });

  test("gives each lane one span per unbroken run of months covered by the roles that list its discipline", () => {
    const { lanes } = careerTimelineModelFrom(EXPERIENCE);
    const first = lanes.find(({ discipline }) => discipline.id === "first");

    expect(first?.spans).toEqual([
      { start: monthIndexOf("2018-06"), end: monthIndexOf("2022-03") },
      { start: monthIndexOf("2024-03"), end: monthIndexOf("2026-10") },
    ]);
  });

  test("resolves every discipline a role lists, in the order it lists them", () => {
    const { careerTimelineRoles } = careerTimelineModelFrom(EXPERIENCE);
    const middle = careerTimelineRoles.find(({ role: { title } }) => title === "Middle");

    expect(middle?.disciplines.map(({ id }) => id)).toEqual(["second", "first"]);
  });

  test("returns a lane without spans for a discipline that no role lists", () => {
    const careerTimelineModel = careerTimelineModelFrom({
      asOf: AS_OF,
      disciplines: [...EXPERIENCE.disciplines, { id: "third", name: "Third", accentColor: "green" }],
      roles: EXPERIENCE.roles,
    });
    expect(careerTimelineModel.lanes.find(({ discipline }) => discipline.id === "third")?.spans).toEqual([]);
  });

  test("throws when a discipline ID is declared more than once, naming the ID", () => {
    expect(() =>
      careerTimelineModelFrom({
        ...EXPERIENCE,
        disciplines: [...EXPERIENCE.disciplines, { id: "first", name: "Again", accentColor: "green" }],
      }),
    ).toThrow('The discipline "first" is declared more than once.');
  });

  test("throws when the record has no roles", () => {
    expect(() => careerTimelineModelFrom(experienceWith([]))).toThrow("The record names no roles");
  });

  test("throws when two roles start at the same organization in the same month, naming both roles", () => {
    expect(() =>
      careerTimelineModelFrom(
        experienceWith([role({ title: "First", start: "2020-01" }), role({ title: "Second", start: "2020-01" })]),
      ),
    ).toThrow('"First" and "Second" both start at Organization in 2020-01');
  });

  test("throws when a role lists a discipline that is not declared, naming the role and the discipline", () => {
    expect(() => careerTimelineModelFrom(experienceWith([role({ title: "Stray", disciplines: ["absent"] })]))).toThrow(
      '"Stray" names the discipline "absent", which is not declared.',
    );
  });

  test("throws when a role's `disciplines` is empty, naming the role", () => {
    expect(() => careerTimelineModelFrom(experienceWith([role({ title: "Stray", disciplines: [] })]))).toThrow(
      '"Stray" names no discipline.',
    );
  });

  test("throws when a role ends before it starts, naming the role and both months", () => {
    expect(() =>
      careerTimelineModelFrom(experienceWith([role({ title: "Stray", start: "2021-01", end: "2020-06" })])),
    ).toThrow('"Stray" ends in 2020-06, before it starts in 2021-01.');
  });

  test("throws when a role starts after the `asOf` month, naming the role and both months", () => {
    expect(() =>
      careerTimelineModelFrom(experienceWith([role({ title: "Stray", start: "2027-01", end: null })])),
    ).toThrow('"Stray" starts in 2027-01, after the record\'s `asOf` month, 2026-09.');
  });

  test("throws when a role ends after the `asOf` month, naming the role and both months", () => {
    expect(() =>
      careerTimelineModelFrom(experienceWith([role({ title: "Stray", start: "2026-01", end: "2026-12" })])),
    ).toThrow('"Stray" ends in 2026-12, after the record\'s `asOf` month, 2026-09.');
  });
});

describe("yearsIn", () => {
  test("lists every year whose first month is in the range", () => {
    expect(yearsIn({ start: firstMonthIndexOf(2019), end: firstMonthIndexOf(2022) })).toEqual([2019, 2020, 2021]);
  });

  test("lists a year every `intervalYears` years from the year the range starts in", () => {
    expect(yearsIn({ start: firstMonthIndexOf(2010), end: firstMonthIndexOf(2020) }, 4)).toEqual([2010, 2014, 2018]);
  });

  test("includes the year the range ends partway through", () => {
    expect(yearsIn({ start: firstMonthIndexOf(2019), end: monthIndexOf("2021-09") })).toEqual([2019, 2020, 2021]);
  });
});

describe("careerTimelinePlacementOf", () => {
  const range = { start: firstMonthIndexOf(2020), end: firstMonthIndexOf(2030) };

  test("places a month span from the start of the range when the direction is `oldest-first`", () => {
    const placement = careerTimelinePlacementOf(
      { start: firstMonthIndexOf(2021), end: firstMonthIndexOf(2023) },
      range,
      "oldest-first",
    );
    expect(placement).toEqual({ offset: 0.1, size: 0.2 });
  });

  test("places a month span from the end of the range when the direction is `newest-first`", () => {
    const placement = careerTimelinePlacementOf(
      { start: firstMonthIndexOf(2021), end: firstMonthIndexOf(2023) },
      range,
      "newest-first",
    );
    expect(placement).toEqual({ offset: 0.7, size: 0.2 });
  });

  test("gives a month span the same size in either direction", () => {
    const span = { start: firstMonthIndexOf(2022), end: firstMonthIndexOf(2025) };
    expect(careerTimelinePlacementOf(span, range, "oldest-first").size).toBe(
      careerTimelinePlacementOf(span, range, "newest-first").size,
    );
  });
});

describe("monthOffsetOf", () => {
  test("places the start of the range at `0` when the direction is `oldest-first` and at `1` when it is `newest-first`", () => {
    const range = { start: firstMonthIndexOf(2020), end: firstMonthIndexOf(2030) };

    expect(monthOffsetOf(firstMonthIndexOf(2020), range, "oldest-first")).toBe(0);
    expect(monthOffsetOf(firstMonthIndexOf(2020), range, "newest-first")).toBe(1);
  });
});

describe("orderedCareerTimelineRoles", () => {
  const titlesOf = (experience: Experience, direction: CareerTimelineDirection) =>
    orderedCareerTimelineRoles(careerTimelineModelFrom(experience).careerTimelineRoles, direction).map(
      ({ role: { title } }) => title,
    );

  test("orders roles by start month, newest first", () => {
    expect(titlesOf(EXPERIENCE, "newest-first")).toEqual(["Current", "Middle", "Earliest"]);
  });

  test("orders roles by start month, oldest first", () => {
    expect(titlesOf(EXPERIENCE, "oldest-first")).toEqual(["Earliest", "Middle", "Current"]);
  });

  test("orders roles that start in the same month by their end month, in reverse when newest first", () => {
    const experience = experienceWith([
      role({ title: "Longer", organization: "First organization", start: "2020-01", end: "2022-06" }),
      role({ title: "Shorter", organization: "Second organization", start: "2020-01", end: "2020-06" }),
    ]);

    expect(titlesOf(experience, "oldest-first")).toEqual(["Shorter", "Longer"]);
    expect(titlesOf(experience, "newest-first")).toEqual(["Longer", "Shorter"]);
  });

  test("leaves the array it receives in its original order", () => {
    const { careerTimelineRoles } = careerTimelineModelFrom(EXPERIENCE);
    const titles = careerTimelineRoles.map(({ role: { title } }) => title);

    orderedCareerTimelineRoles(careerTimelineRoles, "oldest-first");

    expect(careerTimelineRoles.map(({ role: { title } }) => title)).toEqual(titles);
  });
});
