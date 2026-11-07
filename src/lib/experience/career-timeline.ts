// Imports only leaf modules because `/vite.config.ts` loads this module through `/build`.
import { formatDate } from "../datetime.ts";

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
  /** The first discipline determines the accent color. */
  disciplines: ReadonlyArray<string>;
  /** `YYYY-MM`, inclusive. */
  start: string;
  /** `YYYY-MM`, inclusive, or `null` if the role is current. */
  end: string | null;
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
    throw new Error("The record names no roles, so the chart has no range to render.");
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
