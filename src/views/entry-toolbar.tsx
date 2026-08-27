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
      <NavigationButton variant="previous" label="Previous entry" route={previous} />
      {frontmatter && (
        <time className={styles.date} dateTime={frontmatter.date}>
          {formatDate(frontmatter.date, dateFormat)}
        </time>
      )}
      <NavigationButton variant="next" label="Next entry" route={next} />
    </div>
  );
}
