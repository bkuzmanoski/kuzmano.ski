import { Fragment, useId, useRef, useState } from "react";

import { Button } from "#/components/button.tsx";
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
import { useCareerTimelineMinimap } from "./use-career-timeline-minimap.ts";

import type { ReactNode } from "react";

const TICK_INTERVAL_YEARS = 4;
const CAREER_TIMELINE_DIRECTION_LABELS: Record<CareerTimelineDirection, string> = {
  "newest-first": "Newest first",
  "oldest-first": "Oldest first",
};

const oppositeDirectionOf = (direction: CareerTimelineDirection): CareerTimelineDirection =>
  direction === "newest-first" ? "oldest-first" : "newest-first";

const careerTimelinePlacementVariables = (
  span: MonthSpan,
  range: MonthSpan,
  direction: CareerTimelineDirection,
): StyleWithVars => {
  const { offset, size } = careerTimelinePlacementOf(span, range, direction);
  return { "--career-timeline-placement-offset": offset, "--career-timeline-placement-size": size };
};

const tickVariables = (year: number, range: MonthSpan, direction: CareerTimelineDirection): StyleWithVars => ({
  "--tick-at": monthOffsetOf(firstMonthIndexOf(year), range, direction),
});

const labelFrom = (parts: ReadonlyArray<ReactNode>) =>
  parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);

export function CareerTimeline({ asOf, disciplines, roles }: Experience) {
  const filtersLabelId = useId();
  const directionDescriptionId = useId();
  const [hiddenDisciplineIds, setHiddenDisciplineIds] = useState<ReadonlySet<string>>(() => new Set());
  const [direction, setDirection] = useState<CareerTimelineDirection>(DEFAULT_CAREER_TIMELINE_DIRECTION);
  const monthFormat = useDateFormat(EXPERIENCE_MONTH_FORMAT);
  const chartColumnRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const visibleRangeFrameRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const chartDragHandlers = useCareerTimelineMinimap(
    { chartColumn: chartColumnRef, lanes: lanesRef, visibleRangeFrame: visibleRangeFrameRef, list: listRef },
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
    <section className={styles.careerTimeline} data-content-default-styles="off" data-content-span="rail">
      <div className={styles.controls}>
        <div className={styles.filterGroup} role="group" aria-labelledby={filtersLabelId}>
          <p id={filtersLabelId} className={styles.controlsLabel}>
            Show
          </p>
          <ul className={styles.filters}>
            {disciplines.map(({ id, name, accentColor }) => (
              <li key={id}>
                <Button
                  aria-pressed={!hiddenDisciplineIds.has(id)}
                  className={styles.filter}
                  style={accentColorVariable("--discipline-accent-color", accentColor)}
                  onClick={() => toggleDiscipline(id)}
                >
                  {name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <Button
          className={styles.directionButton}
          data-direction={direction}
          aria-describedby={directionDescriptionId}
          onClick={() => setDirection(oppositeDirectionOf)}
        >
          {CAREER_TIMELINE_DIRECTION_LABELS[direction]}
        </Button>
        <span id={directionDescriptionId} hidden>
          Orders the roles by date
        </span>
      </div>
      <div ref={chartColumnRef} className={styles.chartColumn}>
        <div aria-hidden="true" className={styles.chart} {...chartDragHandlers}>
          <div className={styles.axis}>
            {years.map((year) => (
              <span key={year} className={styles.tick} style={tickVariables(year, range, direction)}>
                {year}
              </span>
            ))}
          </div>
          <div ref={lanesRef} className={styles.lanes}>
            {lanes.map(({ discipline, spans }) => (
              <div
                key={discipline.id}
                className={styles.lane}
                data-hidden={hiddenDisciplineIds.has(discipline.id) || undefined}
                style={accentColorVariable("--discipline-accent-color", discipline.accentColor)}
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
      <p className={cx(styles.empty, hasVisibleRoles && styles.hidden)} role="status">
        {hasVisibleRoles ? null : "No roles match the selected disciplines."}
      </p>
      {hasVisibleRoles && (
        <ol ref={listRef} className={styles.roles}>
          {visibleCareerTimelineRoles.map((careerTimelineRole) => {
            const { role, span, shownDiscipline } = careerTimelineRole;
            return (
              <li
                key={roleKeyOf(role)}
                className={styles.role}
                style={accentColorVariable("--discipline-accent-color", shownDiscipline.accentColor)}
                {...careerTimelinePlacementAttributesOf(careerTimelinePlacementOf(span, range, direction))}
              >
                <h2 className={styles.roleTitle}>{role.title}</h2>
                <div className={styles.roleHeader}>
                  <p className={styles.roleDisciplines}>{roleDisciplinesLabelOf(careerTimelineRole)}</p>
                  <p className={styles.roleDates}>{labelFrom(roleDatesLabelPartsOf(role, monthTimeElementOf))}</p>
                </div>
                <p className={styles.roleOrganization}>{role.organization}</p>
                <p className={styles.roleSummary}>{role.summary}</p>
                {role.highlights && (
                  <ul className={styles.highlights}>
                    {role.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                )}
                {role.link && (
                  <p data-content-default-styles="on">
                    <ContentLink href={role.link.href}>{role.link.label}</ContentLink>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
