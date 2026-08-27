import { NavigationButton } from "#/components/navigation-button";
import { ENTRY_DATE_FORMAT } from "#/config/content";
import { entrySiblings } from "#/content/entry-navigation";
import type { EntryTarget } from "#/content/window-registry";
import { formatDate } from "#/lib/date";
import { useDateFormat } from "#/lib/hooks/use-date-format";

import styles from "./entry-toolbar.module.css";

export function EntryToolbar({ target }: { target: EntryTarget }) {
  const dateFormat = useDateFormat(ENTRY_DATE_FORMAT);

  if (target.collectionRoute === null) {
    return null; // Standalone entries have no collection to step through, so they render no toolbar.
  }

  const { contentIndex, slug } = target;
  const frontmatter = contentIndex.frontmatterOf(slug);
  const { previous, next } = entrySiblings(contentIndex, slug);

  return (
    <div className={styles.toolbar}>
      <nav aria-label="Entry" className={styles.controls}>
        <NavigationButton variant="previous" label="Previous entry" route={previous} />
        <NavigationButton variant="next" label="Next entry" route={next} />
      </nav>
      <div className={styles.meta}>
        {frontmatter?.category && <span className={styles.category}>{frontmatter.category}</span>}
        {frontmatter && (
          <time className={styles.date} dateTime={frontmatter.date}>
            {formatDate(frontmatter.date, dateFormat)}
          </time>
        )}
      </div>
    </div>
  );
}
