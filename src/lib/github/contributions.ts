import { formatDate, isIsoDate } from "../datetime.ts";
import { isRecord } from "../guards.ts";

/** The number of levels a count is drawn at, from no contributions to the busiest day. */
export const CONTRIBUTION_LEVEL_COUNT = 5;

const MINIMUM_WEEKS_BETWEEN_MONTH_LABELS = 3; // A leading label for the first, partial month overlaps the next label when it is closer than this.

export interface ContributionDay {
  date: string; // `YYYY-MM-DD`.
  count: number;
}

export interface ContributionCalendar {
  total: number;
  weeks: ReadonlyArray<ReadonlyArray<ContributionDay>>;
}

export interface MonthLabel {
  weekIndex: number;
  label: string;
}

function contributionWeekFrom(value: unknown): Array<ContributionDay> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const week: Array<ContributionDay> = [];

  for (const day of value) {
    if (!isRecord(day) || !isIsoDate(day.date) || typeof day.count !== "number") {
      return null;
    }

    week.push({ date: day.date, count: day.count });
  }

  return week;
}

/**
 * Checks untyped JSON against `ContributionCalendar`, returning the calendar or `null` when any
 * part of it does not match.
 */
export function contributionCalendarFrom(value: unknown): ContributionCalendar | null {
  if (!isRecord(value) || typeof value.total !== "number" || !Array.isArray(value.weeks)) {
    return null;
  }

  const weeks: Array<Array<ContributionDay>> = [];

  for (const weekValue of value.weeks) {
    const week = contributionWeekFrom(weekValue);

    if (!week) {
      return null;
    }

    weeks.push(week);
  }

  return { total: value.total, weeks };
}

export function contributionLevelOf(count: number, busiestCount: number): number {
  if (count <= 0 || busiestCount <= 0) {
    return 0;
  }

  const highestLevel = CONTRIBUTION_LEVEL_COUNT - 1;

  return Math.max(1, Math.min(highestLevel, Math.ceil((count / busiestCount) * highestLevel)));
}

export const busiestCountIn = (weeks: ContributionCalendar["weeks"]): number =>
  weeks.flat().reduce((busiest, { count }) => Math.max(busiest, count), 0);

/** The day of the week `date` falls on, from 0 for Sunday to 6 for Saturday. */
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * Labels each week whose first day starts a new month, in `format`.
 *
 * The first week is labeled with its own month, unless the next label is fewer than
 * `MINIMUM_WEEKS_BETWEEN_MONTH_LABELS` weeks after it.
 */
export function monthLabelsFor(weeks: ContributionCalendar["weeks"], format: Intl.DateTimeFormat): Array<MonthLabel> {
  const labels: Array<MonthLabel> = [];

  let previousMonth: string | null = null;

  weeks.forEach((week, weekIndex) => {
    const firstDay = week[0];

    if (!firstDay) {
      return;
    }

    const month = firstDay.date.slice(0, 7);

    if (month !== previousMonth) {
      labels.push({ weekIndex, label: formatDate(firstDay.date, format) });
    }

    previousMonth = month;
  });

  const [leadingLabel, nextLabel] = labels;

  if (leadingLabel && nextLabel && nextLabel.weekIndex - leadingLabel.weekIndex < MINIMUM_WEEKS_BETWEEN_MONTH_LABELS) {
    labels.shift();
  }

  return labels;
}
