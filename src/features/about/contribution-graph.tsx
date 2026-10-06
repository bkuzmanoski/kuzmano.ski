import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { GITHUB_PROFILE_LINK_TEXT, GITHUB_PROFILE_URL, GITHUB_USERNAME, SITE_LOCALE } from "#/config/site.ts";
import { ContentLink } from "#/features/content/content-link.tsx";
import { SCROLL_PANE_VIEWPORT_SELECTOR } from "#/features/window-manager/scroll-pane.tsx";
import type { DateFormat } from "#/lib/datetime.ts";
import { intersectionOf, intersectionRatioOf } from "#/lib/geometry.ts";
import { busiestCountIn, contributionLevelOf, monthLabelsFor, weekdayOf } from "#/lib/github/contributions.ts";
import { useContributionCalendar } from "#/lib/github/use-contribution-calendar.ts";
import { useDateFormat } from "#/lib/hooks/use-date-format.ts";
import { useElementResize } from "#/lib/hooks/use-element-size.ts";
import { useNumberFormat } from "#/lib/hooks/use-number-format.ts";
import { usePrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import type { StyleWithVars } from "#/lib/style.ts";
import { languageAttributeInDocumentFor } from "#/site/language.ts";

import styles from "./contribution-graph.module.css";

const PLACEHOLDER_WEEK_COUNT = 53; // The number of weeks GitHub's calendar spans in most years, rendered by the placeholder grid.
const DAYS_PER_WEEK = 7;
const MONTH_FORMAT: DateFormat = {
  locale: SITE_LOCALE,
  options: { month: "short", timeZone: "UTC" },
};
const REVEAL_START_VISIBLE_FRACTION = 0.2;
const REVEAL_END_ROUNDING_ALLOWANCE_PX = 1;
const REVEAL_END_MAX_PROPERTY = "--contribution-graph-reveal-end-max";
const VIEW_TIMELINE_CONDITION = "view-timeline: --contribution-graph block"; // The condition of the `@supports` rule that reveals the weeks on scroll.

const doesOverflow = (scrollContainer: HTMLElement | null) =>
  scrollContainer !== null && scrollContainer.scrollWidth > scrollContainer.clientWidth;

function visibleFractionOf(figure: HTMLElement): number {
  const viewportRect = { x: 0, y: 0, width: innerWidth, height: innerHeight };
  const paneRect = figure.closest(SCROLL_PANE_VIEWPORT_SELECTOR)?.getBoundingClientRect();
  const visibleRect = paneRect ? intersectionOf(paneRect, viewportRect) : viewportRect;

  return visibleRect ? intersectionRatioOf(figure.getBoundingClientRect(), visibleRect) : 0;
}

function reachableCoverOffsetOf(figure: HTMLElement, scrollPane: HTMLElement): number {
  const figureTopInContent =
    figure.getBoundingClientRect().top -
    scrollPane.getBoundingClientRect().top -
    scrollPane.clientTop +
    scrollPane.scrollTop;
  const scrollPaddingBottom = Number.parseFloat(getComputedStyle(scrollPane).scrollPaddingBottom) || 0;

  return scrollPane.scrollHeight - scrollPaddingBottom - figureTopInContent;
}

export function ContributionGraph() {
  const captionId = useId();
  const contributionCalendar = useContributionCalendar();
  const monthFormat = useDateFormat(MONTH_FORMAT);
  const totalFormat = useNumberFormat(SITE_LOCALE);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isFigureInView, setIsFigureInView] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);

  const isCalendarPending = contributionCalendar === undefined;

  useLayoutEffect(() => setIsOverflowing(doesOverflow(scrollContainerRef.current)), [contributionCalendar]);

  useElementResize(scrollContainerRef, () => setIsOverflowing(doesOverflow(scrollContainerRef.current)));

  useLayoutEffect(() => {
    const figure = figureRef.current;

    if (!isCalendarPending && figure) {
      setIsFigureInView(visibleFractionOf(figure) >= REVEAL_START_VISIBLE_FRACTION);
    }
  }, [isCalendarPending]);

  useEffect(() => {
    const figure = figureRef.current;
    const scrollPane = figure?.closest<HTMLElement>(SCROLL_PANE_VIEWPORT_SELECTOR);

    if (!figure || !scrollPane || prefersReducedMotion || !CSS.supports(VIEW_TIMELINE_CONDITION)) {
      return;
    }

    const limitRevealEnd = () => {
      const revealEndMax = `${reachableCoverOffsetOf(figure, scrollPane) - REVEAL_END_ROUNDING_ALLOWANCE_PX}px`;

      if (figure.style.getPropertyValue(REVEAL_END_MAX_PROPERTY) !== revealEndMax) {
        figure.style.setProperty(REVEAL_END_MAX_PROPERTY, revealEndMax);
      }
    };
    const resizeObserver = new ResizeObserver(limitRevealEnd);

    resizeObserver.observe(scrollPane);

    for (const child of scrollPane.children) {
      resizeObserver.observe(child);
    }

    return () => resizeObserver.disconnect();
  }, [prefersReducedMotion]);

  if (contributionCalendar === null) {
    return (
      <p>
        <ContentLink href={GITHUB_PROFILE_URL}>{GITHUB_PROFILE_LINK_TEXT}</ContentLink>
      </p>
    );
  }

  const weekCount = contributionCalendar?.weeks.length ?? PLACEHOLDER_WEEK_COUNT;
  const graphStyle: StyleWithVars = { "--contribution-graph-reveal-start": `${REVEAL_START_VISIBLE_FRACTION * 100}%` };
  const plotStyle: StyleWithVars = { "--contribution-graph-week-count": weekCount };
  const revealTimeline = contributionCalendar && (isFigureInView ? "document" : "view");
  const busiestCount = contributionCalendar ? busiestCountIn(contributionCalendar.weeks) : 0;
  const monthLabels = contributionCalendar ? monthLabelsFor(contributionCalendar.weeks, monthFormat) : [];

  return (
    <figure ref={figureRef} className={styles.graph} style={graphStyle} data-reveal-timeline={revealTimeline}>
      <div className={styles.scrollContainerFrame}>
        {/* A keyboard scrolls the year only through a focusable scroll container, which needs a role and a name. */}
        <div
          ref={scrollContainerRef}
          className={styles.scrollContainer}
          tabIndex={contributionCalendar && isOverflowing ? 0 : undefined}
          role={contributionCalendar ? "img" : undefined}
          aria-label={contributionCalendar ? "Contributions by day" : undefined}
          aria-describedby={contributionCalendar ? captionId : undefined}
        >
          <div className={styles.track}>
            <div className={styles.plot} style={plotStyle}>
              <div aria-hidden="true" className={styles.placeholder}>
                <div className={styles.weeks}>
                  {/* Match the calendar's week count so both animate in sync. */}
                  {Array.from({ length: weekCount }, (_week, weekIndex) => (
                    <div key={weekIndex} className={styles.week}>
                      {Array.from({ length: DAYS_PER_WEEK }, (_day, weekday) => (
                        <span key={weekday} className={styles.day} data-level={0} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {contributionCalendar && (
                <div aria-hidden="true" className={styles.grid}>
                  <div className={styles.weeks}>
                    {contributionCalendar.weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className={styles.week}>
                        {week.map(({ date, count }) => (
                          <span
                            key={date}
                            className={styles.day}
                            style={{ gridRow: weekdayOf(date) + 1 }}
                            data-level={contributionLevelOf(count, busiestCount)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div aria-hidden="true" className={styles.axis} lang={languageAttributeInDocumentFor(monthFormat)}>
              {monthLabels.map(({ weekIndex, label }) => (
                <span
                  key={weekIndex}
                  className={styles.month}
                  style={{ gridColumn: `${weekIndex + 1} / ${weekCount + 1}` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption id={captionId}>
        {contributionCalendar && (
          <>
            <span lang={languageAttributeInDocumentFor(totalFormat)}>
              {totalFormat.format(contributionCalendar.total)}
            </span>{" "}
            contributions in the last year, as{" "}
          </>
        )}
        <ContentLink href={GITHUB_PROFILE_URL}>
          {contributionCalendar ? `@${GITHUB_USERNAME}` : GITHUB_PROFILE_LINK_TEXT}
        </ContentLink>
        {contributionCalendar && "."}
      </figcaption>
    </figure>
  );
}
