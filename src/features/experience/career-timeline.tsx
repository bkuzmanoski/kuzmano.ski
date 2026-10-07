import { useRef, useState } from "react";

import { Checkbox } from "#/components/checkbox.tsx";
import { PopupMenu } from "#/components/popup-menu.tsx";
import type { PopupMenuOption } from "#/components/popup-menu.tsx";
import { EXPERIENCE_MONTH_FORMAT } from "#/config/content.ts";
import { ContentLink } from "#/features/content/content-link.tsx";
import { accentColorVariable } from "#/lib/accent-colors.ts";
import { cx } from "#/lib/class-names.ts";
import { formatDate } from "#/lib/datetime.ts";
import {
  DEFAULT_CAREER_TIMELINE_DIRECTION,
  careerTimelineModelFrom,
  careerTimelinePlacementOf,
  firstMonthIndexOf,
  monthOffsetOf,
  orderedCareerTimelineRoles,
  roleDatesLabelPartsOf,
  roleDisciplinesLabelOf,
  roleKeyOf,
  yearsIn,
} from "#/lib/experience/career-timeline.ts";
import type { CareerTimelineDirection, Experience, MonthSpan } from "#/lib/experience/career-timeline.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import type { StyleWithVars } from "#/lib/style.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";

import { careerTimelinePlacementAttributesOf } from "./career-timeline-layout.ts";
import styles from "./career-timeline.module.css";
import { useCareerTimelineLastRoleHeight } from "./use-career-timeline-last-role-height.ts";
import { useCareerTimelineMinimap } from "./use-career-timeline-minimap.ts";

const CAREER_TIMELINE_DIRECTION_OPTIONS: ReadonlyArray<PopupMenuOption<CareerTimelineDirection>> = [
  { value: "newest-first", label: "Newest first" },
  { value: "oldest-first", label: "Oldest first" },
];
const TICK_INTERVAL_YEARS = 4;
const CHAR_WORD_JOINER = "\u2060";

const careerTimelinePlacementVariables = (
  span: MonthSpan,
  range: MonthSpan,
  direction: CareerTimelineDirection,
): StyleWithVars => {
  const { offset, size } = careerTimelinePlacementOf(span, range, direction);
  return { "--career-timeline-placement-offset": offset, "--career-timeline-placement-size": size };
};

const tickVariables = (monthIndex: number, range: MonthSpan, direction: CareerTimelineDirection): StyleWithVars => ({
  "--career-timeline-tick-offset": monthOffsetOf(monthIndex, range, direction),
});

export function CareerTimeline({ asOf, disciplines, roles }: Experience) {
  const [hiddenDisciplineIds, setHiddenDisciplineIds] = useState<ReadonlySet<string>>(() => new Set());
  const [direction, setDirection] = useState<CareerTimelineDirection>(DEFAULT_CAREER_TIMELINE_DIRECTION);
  const monthFormat = useDateFormat(EXPERIENCE_MONTH_FORMAT);
  const chartColumnRef = useRef<HTMLDivElement>(null);
  const careerTimelineRef = useRef<HTMLElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const visibleRangeFrameRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const chartDragHandlers = useCareerTimelineMinimap(
    { chartColumn: chartColumnRef, lanes: lanesRef, visibleRangeFrame: visibleRangeFrameRef, list: listRef },
    { direction, hiddenDisciplineIds },
  );

  useCareerTimelineLastRoleHeight(
    { careerTimeline: careerTimelineRef, list: listRef },
    { direction, hiddenDisciplineIds },
  );

  const monthTimeElementOf = (month: string) => (
    <time dateTime={month} lang={languageAttributeInDocumentFor(monthFormat)}>
      {formatDate(month, monthFormat)}
    </time>
  );

  const { range, lanes, careerTimelineRoles } = careerTimelineModelFrom({ asOf, disciplines, roles });
  const years = yearsIn(range, TICK_INTERVAL_YEARS);
  const visibleCareerTimelineRoles = orderedCareerTimelineRoles(careerTimelineRoles, direction).flatMap(
    (careerTimelineRole) => {
      const shownDiscipline = careerTimelineRole.disciplines.find(({ id }) => !hiddenDisciplineIds.has(id));
      return shownDiscipline ? [{ ...careerTimelineRole, shownDiscipline }] : [];
    },
  );
  const hasVisibleRoles = visibleCareerTimelineRoles.length > 0;

  const toggleDiscipline = (id: string) =>
    setHiddenDisciplineIds((hidden) => {
      const next = new Set(hidden);

      if (!next.delete(id)) {
        next.add(id);
      }

      return next;
    });

  return (
    <section
      ref={careerTimelineRef}
      className={styles.careerTimeline}
      data-content-default-styles="off"
      data-content-span="rail"
      data-content-space="relaxed"
    >
      <div className={styles.controls}>
        <ul className={styles.filters} aria-label="Disciplines">
          {disciplines.map(({ id, name }) => (
            <li key={id}>
              <Checkbox checked={!hiddenDisciplineIds.has(id)} onChange={() => toggleDiscipline(id)}>
                {name}
              </Checkbox>
            </li>
          ))}
        </ul>
        <PopupMenu
          value={direction}
          options={CAREER_TIMELINE_DIRECTION_OPTIONS}
          aria-label="Order"
          onChange={setDirection}
        />
      </div>
      <div ref={chartColumnRef} className={styles.chartColumn}>
        <div aria-hidden="true" className={styles.chart} {...chartDragHandlers}>
          <div className={styles.axis}>
            {years.map((year) => (
              <span key={year} className={styles.tick} style={tickVariables(firstMonthIndexOf(year), range, direction)}>
                {year}
              </span>
            ))}
            <span className={styles.tick} style={tickVariables(range.end, range, direction)}>
              Now
            </span>
          </div>
          <div ref={lanesRef} className={styles.lanes}>
            {lanes.map(({ discipline, spans }) => (
              <div
                key={discipline.id}
                className={styles.lane}
                data-hidden={hiddenDisciplineIds.has(discipline.id) || undefined}
                style={accentColorVariable("--career-timeline-discipline-accent-color", discipline.accentColor)}
              >
                {spans.map((span) => (
                  <span
                    key={span.start}
                    className={styles.spanBar}
                    style={careerTimelinePlacementVariables(span, range, direction)}
                  />
                ))}
              </div>
            ))}
            <span ref={visibleRangeFrameRef} className={styles.visibleRangeFrame} />
          </div>
        </div>
      </div>
      <p className={cx(styles.emptyState, hasVisibleRoles && styles.hidden)} role="status">
        {hasVisibleRoles ? null : "Select a discipline to view roles."}
      </p>
      {hasVisibleRoles && (
        <ol ref={listRef} className={styles.roles}>
          {visibleCareerTimelineRoles.map((careerTimelineRole) => {
            const { role, span, shownDiscipline } = careerTimelineRole;
            const [startMonth, dash, endMonth] = roleDatesLabelPartsOf(role, monthTimeElementOf);
            return (
              <li
                key={roleKeyOf(role)}
                className={styles.role}
                style={accentColorVariable("--career-timeline-discipline-accent-color", shownDiscipline.accentColor)}
                {...careerTimelinePlacementAttributesOf(careerTimelinePlacementOf(span, range, direction))}
                data-content-default-styles="on"
              >
                <h3>{role.title}</h3>
                <div className={styles.header}>
                  <p className={styles.disciplines}>{roleDisciplinesLabelOf(careerTimelineRole)}</p>
                </div>
                <p className={styles.organizationAndDates}>
                  {role.organization}, {startMonth}
                  {CHAR_WORD_JOINER}
                  {dash}
                  {CHAR_WORD_JOINER}
                  {endMonth}
                </p>
                <p className={styles.summary}>{role.summary}</p>
                {role.highlights && (
                  <ul className={styles.highlights}>
                    {role.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                )}
                {role.link && (
                  <ContentLink className={styles.link} href={role.link.href}>
                    {role.link.label}
                  </ContentLink>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
