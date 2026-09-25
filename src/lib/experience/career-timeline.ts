import { formatDate } from "../datetime.ts";
import { clamp } from "../math.ts";

import type { AccentColorName } from "../accent-colors.ts";

export interface Discipline {
  id: string;
  name: string;
  accentColor: AccentColorName;
}

export interface RoleLink {
  label: string;
  href: string;
}

export interface Role {
  title: string;
  organization: string;
  disciplines: ReadonlyArray<string>; // The first discipline determines the accent color.
  start: string; // `YYYY-MM`, inclusive.
  end: string | null; // `YYYY-MM`, inclusive, or `null` if the role is current.
  summary: string;
  highlights?: ReadonlyArray<string>;
  link?: RoleLink;
}

export interface Experience {
  asOf: string;
  disciplines: ReadonlyArray<Discipline>;
  roles: ReadonlyArray<Role>;
}

/** A half-open range of months, as indices. */
export interface MonthSpan {
  start: number;
  end: number;
}

export interface Lane {
  discipline: Discipline;
  spans: ReadonlyArray<MonthSpan>;
}

export interface CareerTimelineRole {
  role: Role;
  span: MonthSpan;
  disciplines: ReadonlyArray<Discipline>;
}

export interface CareerTimelineModel {
  range: MonthSpan;
  lanes: ReadonlyArray<Lane>;
  careerTimelineRoles: ReadonlyArray<CareerTimelineRole>;
}

export type CareerTimelineDirection = "newest-first" | "oldest-first";

export const DEFAULT_CAREER_TIMELINE_DIRECTION: CareerTimelineDirection = "newest-first";

export interface CareerTimelinePlacement {
  offset: number;
  size: number;
}

export interface LaidOutRole {
  top: number;
  height: number;
  placement: CareerTimelinePlacement;
}

export interface CareerTimelineViewport {
  roles: ReadonlyArray<LaidOutRole>;
  scrollTop: number;
  viewTopOffset: number;
  viewBottomOffset: number;
  minimumViewTop: number | null;
}

export interface CareerTimelineScrollRange {
  minimumScrollTop: number;
  maximumScrollTop: number;
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS_PER_YEAR = 12;

export function monthIndexOf(month: string): number {
  const monthMatch = MONTH_PATTERN.exec(month);

  if (!monthMatch) {
    throw new Error(`Expected a month as "YYYY-MM", but received "${month}".`);
  }

  const [, yearDigits, monthOfYearDigits] = monthMatch;

  return Number(yearDigits) * MONTHS_PER_YEAR + (Number(monthOfYearDigits) - 1);
}

export const firstMonthIndexOf = (year: number): number => year * MONTHS_PER_YEAR;

const yearOf = (monthIndex: number): number => Math.floor(monthIndex / MONTHS_PER_YEAR);

export const monthSpanOf = (role: Role, asOfMonthIndex: number): MonthSpan => ({
  start: monthIndexOf(role.start),
  end: (role.end === null ? asOfMonthIndex : monthIndexOf(role.end)) + 1,
});

export function mergeMonthSpans(monthSpans: ReadonlyArray<MonthSpan>): Array<MonthSpan> {
  const mergedMonthSpans: Array<MonthSpan> = [];

  for (const monthSpan of [...monthSpans].sort((a, b) => a.start - b.start)) {
    const lastMergedMonthSpan = mergedMonthSpans.at(-1);

    if (lastMergedMonthSpan && monthSpan.start <= lastMergedMonthSpan.end) {
      lastMergedMonthSpan.end = Math.max(lastMergedMonthSpan.end, monthSpan.end);
    } else {
      mergedMonthSpans.push({ ...monthSpan });
    }
  }

  return mergedMonthSpans;
}

export const roleKeyOf = ({ organization, start }: Role): string => `${organization}-${start}`;

export const roleDatesLabelPartsOf = <TMonthPart>({ start, end }: Role, monthPart: (month: string) => TMonthPart) =>
  [monthPart(start), "–", end === null ? "Present" : monthPart(end)] as const;
export const roleDatesLabelOf = (role: Role, monthFormat: Intl.DateTimeFormat): string =>
  roleDatesLabelPartsOf(role, (month) => formatDate(month, monthFormat)).join("");
export const roleDisciplinesLabelOf = ({ disciplines }: CareerTimelineRole): string =>
  disciplines.map(({ name }) => name).join(", ");

function assertRoleDatesInOrder(role: Role, asOf: string, asOfMonthIndex: number) {
  const startMonthIndex = monthIndexOf(role.start);
  const endMonthIndex = role.end === null ? null : monthIndexOf(role.end);

  if (endMonthIndex !== null && endMonthIndex < startMonthIndex) {
    throw new Error(`"${role.title}" ends in ${role.end}, before it starts in ${role.start}.`);
  }

  if (startMonthIndex > asOfMonthIndex) {
    throw new Error(`"${role.title}" starts in ${role.start}, after the record's \`asOf\` month, ${asOf}.`);
  }

  if (endMonthIndex !== null && endMonthIndex > asOfMonthIndex) {
    throw new Error(`"${role.title}" ends in ${role.end}, after the record's \`asOf\` month, ${asOf}.`);
  }
}

export function careerTimelineModelFrom({ asOf, disciplines, roles }: Experience): CareerTimelineModel {
  const asOfMonthIndex = monthIndexOf(asOf);
  const disciplinesById = new Map<string, Discipline>();

  for (const discipline of disciplines) {
    if (disciplinesById.has(discipline.id)) {
      throw new Error(`The discipline "${discipline.id}" is declared more than once.`);
    }

    disciplinesById.set(discipline.id, discipline);
  }

  if (roles.length === 0) {
    throw new Error("The record names no roles, so the chart has no range to draw.");
  }

  const rolesByKey = new Map<string, Role>();

  for (const role of roles) {
    const roleWithSameKey = rolesByKey.get(roleKeyOf(role));

    if (roleWithSameKey) {
      throw new Error(
        `"${roleWithSameKey.title}" and "${role.title}" both start at ${role.organization} in ${role.start}, so the timeline cannot tell them apart.`,
      );
    }

    rolesByKey.set(roleKeyOf(role), role);
  }

  const careerTimelineRoles = roles.map((role): CareerTimelineRole => {
    const roleDisciplines = role.disciplines.map((disciplineId) => {
      const discipline = disciplinesById.get(disciplineId);

      if (!discipline) {
        throw new Error(`"${role.title}" names the discipline "${disciplineId}", which is not declared.`);
      }

      return discipline;
    });

    if (roleDisciplines.length === 0) {
      throw new Error(`"${role.title}" names no discipline.`);
    }

    assertRoleDatesInOrder(role, asOf, asOfMonthIndex);

    return { role, span: monthSpanOf(role, asOfMonthIndex), disciplines: roleDisciplines };
  });

  const lanes = disciplines.map((discipline): Lane => {
    const disciplineMonthSpans = careerTimelineRoles
      .filter(({ role }) => role.disciplines.includes(discipline.id))
      .map(({ span }) => span);

    return { discipline, spans: mergeMonthSpans(disciplineMonthSpans) };
  });

  const earliestStartMonthIndex = Math.min(...careerTimelineRoles.map(({ span }) => span.start));

  return {
    range: { start: firstMonthIndexOf(yearOf(earliestStartMonthIndex)), end: asOfMonthIndex + 1 },
    lanes,
    careerTimelineRoles,
  };
}

export function yearsIn(range: MonthSpan, intervalYears = 1): Array<number> {
  const years: Array<number> = [];

  for (let year = yearOf(range.start); firstMonthIndexOf(year) < range.end; year += intervalYears) {
    years.push(year);
  }

  return years;
}

export function careerTimelinePlacementOf(
  span: MonthSpan,
  range: MonthSpan,
  direction: CareerTimelineDirection,
): CareerTimelinePlacement {
  const rangeMonthCount = range.end - range.start;
  const size = (span.end - span.start) / rangeMonthCount;
  const offsetFromRangeStart = (span.start - range.start) / rangeMonthCount;

  return { offset: direction === "oldest-first" ? offsetFromRangeStart : 1 - offsetFromRangeStart - size, size };
}

export const monthOffsetOf = (monthIndex: number, range: MonthSpan, direction: CareerTimelineDirection): number =>
  careerTimelinePlacementOf({ start: monthIndex, end: monthIndex }, range, direction).offset;

export const careerTimelinePlacementCenterOf = ({ offset, size }: CareerTimelinePlacement): number => offset + size / 2;

export const orderedCareerTimelineRoles = (
  careerTimelineRoles: ReadonlyArray<CareerTimelineRole>,
  direction: CareerTimelineDirection,
): Array<CareerTimelineRole> => {
  const directionSign = direction === "oldest-first" ? 1 : -1;
  return [...careerTimelineRoles].sort(
    (a, b) => directionSign * (a.span.start - b.span.start || a.span.end - b.span.end),
  );
};

export function visibleCareerTimelinePlacementOf(
  roles: ReadonlyArray<LaidOutRole>,
  viewTop: number,
  viewBottom: number,
): CareerTimelinePlacement | null {
  let frameStartOffset = Number.POSITIVE_INFINITY;
  let frameEndOffset = Number.NEGATIVE_INFINITY;

  for (const { top, height, placement } of roles) {
    if (height <= 0) {
      continue;
    }

    const visibleStartFraction = clamp((viewTop - top) / height, 0, 1);
    const visibleEndFraction = clamp((viewBottom - top) / height, 0, 1);

    if (visibleEndFraction <= visibleStartFraction) {
      continue;
    }

    frameStartOffset = Math.min(frameStartOffset, placement.offset + visibleStartFraction * placement.size);
    frameEndOffset = Math.max(frameEndOffset, placement.offset + visibleEndFraction * placement.size);
  }

  return frameEndOffset > frameStartOffset
    ? { offset: frameStartOffset, size: frameEndOffset - frameStartOffset }
    : null;
}

export const visibleCareerTimelinePlacementAt = (
  { roles, viewTopOffset, viewBottomOffset, minimumViewTop }: CareerTimelineViewport,
  scrollTop: number,
): CareerTimelinePlacement | null =>
  visibleCareerTimelinePlacementOf(
    roles,
    Math.max(minimumViewTop ?? Number.NEGATIVE_INFINITY, scrollTop + viewTopOffset),
    scrollTop + viewBottomOffset,
  );

export const visibleCareerTimelineCenterAfterTravel = (
  pressCenter: number,
  pointerTravelPx: number,
  axisLengthPx: number,
): number => pressCenter + pointerTravelPx / axisLengthPx;

export function careerTimelineScrollRangeOf({
  roles,
  scrollTop,
  viewTopOffset,
  viewBottomOffset,
}: CareerTimelineViewport): CareerTimelineScrollRange | null {
  const firstRole = roles[0];
  const lastRole = roles.at(-1);

  if (!firstRole || !lastRole) {
    return null;
  }

  const listStartScrollTop = firstRole.top - viewTopOffset;
  const listEndScrollTop = Math.max(listStartScrollTop, lastRole.top + lastRole.height - viewBottomOffset);

  return {
    minimumScrollTop: Math.min(scrollTop, listStartScrollTop),
    maximumScrollTop: Math.max(scrollTop, listEndScrollTop),
  };
}

export function scrollTopForVisibleCareerTimelineCenter(
  viewport: CareerTimelineViewport,
  targetCenter: number,
): number | null {
  const scrollRange = careerTimelineScrollRangeOf(viewport);

  if (!scrollRange) {
    return null;
  }

  const { minimumScrollTop, maximumScrollTop } = scrollRange;
  const frameCenterAt = (scrollTop: number) => {
    const visiblePlacement = visibleCareerTimelinePlacementAt(viewport, scrollTop);
    return visiblePlacement && careerTimelinePlacementCenterOf(visiblePlacement);
  };

  const frameCenterAtMinimum = frameCenterAt(minimumScrollTop);
  const frameCenterAtMaximum = frameCenterAt(maximumScrollTop);

  if (frameCenterAtMinimum === null || targetCenter <= frameCenterAtMinimum) {
    return minimumScrollTop;
  }

  if (frameCenterAtMaximum === null || targetCenter >= frameCenterAtMaximum) {
    return maximumScrollTop;
  }

  let scrollTopBeforeTarget = minimumScrollTop;
  let scrollTopAtOrPastTarget = maximumScrollTop;

  const iterationCount = 32;

  for (let iteration = 0; iteration < iterationCount; iteration++) {
    const middleScrollTop = (scrollTopBeforeTarget + scrollTopAtOrPastTarget) / 2;
    const frameCenterAtMiddle = frameCenterAt(middleScrollTop);

    if (frameCenterAtMiddle !== null && frameCenterAtMiddle >= targetCenter) {
      scrollTopAtOrPastTarget = middleScrollTop;
    } else {
      scrollTopBeforeTarget = middleScrollTop;
    }
  }

  return scrollTopAtOrPastTarget;
}
